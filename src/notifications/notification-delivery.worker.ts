import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { OperationsMetrics } from '../operations/operations-signals.js';

const RECIPIENT_BATCH_SIZE = 100;
const BATCHES_PER_RUN = 10;
const POLL_INTERVAL_MS = 5_000;

@Injectable()
export class NotificationDeliveryWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDeliveryWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly metrics?: OperationsMetrics,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.VITEST) return;
    this.timer = setInterval(() => {
      void this.runOnce().catch((error: unknown) => {
        this.logger.warn({
          event: 'notification_delivery_failed',
          errorCode: error instanceof Error ? error.name : 'UNKNOWN',
        });
      });
    }, POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let batches = 0;
    try {
      for (; batches < BATCHES_PER_RUN; batches += 1) {
        const outcome = await this.deliverBatch();
        if (!outcome) break;
        this.metrics?.recordNotificationDelivery(outcome);
      }
      return batches;
    } catch (error) {
      this.metrics?.recordNotificationDelivery('failed');
      throw error;
    } finally {
      this.running = false;
    }
  }

  private async deliverBatch(): Promise<'delivered' | 'skipped' | null> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ lifecycleEventId: string }>>`
        SELECT "lifecycleEventId" FROM "NotificationDeliveryJob"
        WHERE "deliveredAt" IS NULL
        ORDER BY "createdAt", "lifecycleEventId"
        LIMIT 1 FOR UPDATE SKIP LOCKED
      `;
      const id = locked[0]?.lifecycleEventId;
      if (!id) return null;
      const job = await tx.notificationDeliveryJob.findUniqueOrThrow({
        where: { lifecycleEventId: id },
      });
      if (!job.recipientSnapshotAt) {
        // The job lock and snapshot insert share one transaction. Later batches never
        // re-evaluate mutable roles or memberships for this lifecycle event.
        await tx.$executeRaw`
          INSERT INTO "NotificationDeliveryRecipient" ("lifecycleEventId", "recipientUserId")
          SELECT ${id}::uuid, eligible."id" FROM (
            SELECT users."id" FROM "User" AS users
            WHERE users."status" = 'ACTIVE'
              AND (
                users."role" = 'ADMIN'
                OR (users."role" = 'FARMER' AND EXISTS (
                  SELECT 1 FROM "FarmMembership" AS membership
                  WHERE membership."userId" = users."id"
                    AND membership."farmId" = ${job.farmId}::uuid
                ))
              )
            UNION
            SELECT notification."recipientUserId" AS "id"
            FROM "InAppNotification" AS notification
            WHERE notification."lifecycleEventId" = ${id}::uuid
          ) AS eligible
          ON CONFLICT DO NOTHING
        `;
        await tx.notificationDeliveryJob.update({
          where: { lifecycleEventId: id },
          data: { recipientSnapshotAt: new Date() },
        });
      }
      const recipients = await tx.notificationDeliveryRecipient.findMany({
        where: {
          lifecycleEventId: id,
          ...(job.cursorUserId ? { recipientUserId: { gt: job.cursorUserId } } : {}),
        },
        select: { recipientUserId: true },
        orderBy: { recipientUserId: 'asc' },
        take: RECIPIENT_BATCH_SIZE,
      });
      if (recipients.length > 0) {
        await tx.inAppNotification.createMany({
          data: recipients.map(({ recipientUserId }) => ({
            lifecycleEventId: id,
            recipientUserId,
          })),
          skipDuplicates: true,
        });
      }
      await tx.notificationDeliveryJob.update({
        where: { lifecycleEventId: id },
        data: {
          cursorUserId: recipients.at(-1)?.recipientUserId ?? job.cursorUserId,
          ...(recipients.length < RECIPIENT_BATCH_SIZE ? { deliveredAt: new Date() } : {}),
        },
      });
      return recipients.length === 0 ? 'skipped' : 'delivered';
    });
  }
}
