import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CREDENTIAL_BATCH_SIZE = 500;
const USER_BATCH_SIZE = 100;
const PHASE_C_BATCH_SIZE = 500;

export type RetentionResult = Readonly<{
  sessionsPurged: number;
  usersAnonymized: number;
  apiKeysPurged: number;
  notificationsPurged: number;
  alertsPurged: number;
  idempotencyClaimsPurged: number;
}>;

@Injectable()
export class RetentionService {
  constructor(private readonly prisma: PrismaService) {}

  async run(now: Date, requestId: string): Promise<RetentionResult> {
    const sessionCutoff = new Date(now.getTime() - 30 * DAY_MS);
    const anonymizationCutoff = new Date(now.getTime() - 90 * DAY_MS);
    const apiKeyCutoff = new Date(now.getTime() - 90 * DAY_MS);
    const notificationCutoff = new Date(now.getTime() - 180 * DAY_MS);
    const alertCutoff = new Date(now.getTime() - 365 * DAY_MS);

    return this.prisma.$transaction(
      async (transaction) => {
        const [sessionRows, apiKeyRows, userRows, notificationRows, alertRows, claimRows] =
          await Promise.all([
            transaction.session.findMany({
              where: {
                OR: [{ expiresAt: { lt: sessionCutoff } }, { revokedAt: { lt: sessionCutoff } }],
              },
              select: { id: true },
              take: CREDENTIAL_BATCH_SIZE,
            }),
            transaction.apiKey.findMany({
              where: {
                OR: [{ expiresAt: { lt: apiKeyCutoff } }, { revokedAt: { lt: apiKeyCutoff } }],
              },
              select: { id: true },
              take: CREDENTIAL_BATCH_SIZE,
            }),
            transaction.user.findMany({
              where: {
                deletionRequestedAt: { lt: anonymizationCutoff },
                anonymizedAt: null,
                heldAuthority: null,
              },
              select: { id: true },
              take: USER_BATCH_SIZE,
            }),
            transaction.inAppNotification.findMany({
              where: { createdAt: { lt: notificationCutoff } },
              select: { id: true },
              take: PHASE_C_BATCH_SIZE,
            }),
            transaction.alert.findMany({
              where: { status: 'RESOLVED', resolvedAt: { lt: alertCutoff } },
              select: { id: true },
              take: PHASE_C_BATCH_SIZE,
            }),
            transaction.idempotencyClaim.findMany({
              where: { expiresAt: { lt: now } },
              select: { id: true },
              take: PHASE_C_BATCH_SIZE,
            }),
          ]);

        const notificationsPurged = await transaction.inAppNotification.deleteMany({
          where: { id: { in: notificationRows.map((row) => row.id) } },
        });
        const [sessionsPurged, apiKeysPurged, alertsPurged, idempotencyClaimsPurged] =
          await Promise.all([
            transaction.session.deleteMany({
              where: { id: { in: sessionRows.map((row) => row.id) } },
            }),
            transaction.apiKey.deleteMany({
              where: { id: { in: apiKeyRows.map((row) => row.id) } },
            }),
            transaction.alert.deleteMany({
              where: { id: { in: alertRows.map((row) => row.id) } },
            }),
            transaction.idempotencyClaim.deleteMany({
              where: { id: { in: claimRows.map((row) => row.id) } },
            }),
          ]);

        for (const user of userRows) {
          await Promise.all([
            transaction.session.deleteMany({ where: { userId: user.id } }),
            transaction.apiKey.deleteMany({ where: { ownerUserId: user.id } }),
            transaction.farmMembership.deleteMany({ where: { userId: user.id } }),
            transaction.clientStationGrant.deleteMany({ where: { userId: user.id } }),
          ]);
          await transaction.user.update({
            where: { id: user.id },
            data: {
              email: `anonymous-${user.id}@deleted.invalid`,
              displayName: 'Deleted user',
              passwordHash: '$anonymized$',
              status: 'DISABLED',
              failedLoginCount: 0,
              lockedUntil: null,
              anonymizedAt: now,
            },
          });
        }

        const result = {
          sessionsPurged: sessionsPurged.count,
          usersAnonymized: userRows.length,
          apiKeysPurged: apiKeysPurged.count,
          notificationsPurged: notificationsPurged.count,
          alertsPurged: alertsPurged.count,
          idempotencyClaimsPurged: idempotencyClaimsPurged.count,
        };
        await transaction.securityAuditEvent.create({
          data: {
            action: 'RETENTION_COMPLETED',
            targetType: 'IdentityRetention',
            result: 'SUCCESS',
            requestId,
            metadata: result,
          },
        });
        return result;
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
