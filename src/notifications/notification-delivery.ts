import { Prisma } from '../generated/prisma/client.js';
import type { OperationsMetrics } from '../operations/operations-signals.js';

export async function deliverLifecycleNotifications(
  transaction: Prisma.TransactionClient,
  lifecycleEventId: string,
  farmId: string,
  metrics?: OperationsMetrics,
): Promise<void> {
  try {
    const recipients = await transaction.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ role: 'ADMIN' }, { role: 'FARMER', farmMemberships: { some: { farmId } } }],
      },
      select: { id: true },
    });
    if (recipients.length === 0) {
      metrics?.recordNotificationDelivery('skipped');
      return;
    }
    await transaction.inAppNotification.createMany({
      data: recipients.map(({ id }) => ({ lifecycleEventId, recipientUserId: id })),
      skipDuplicates: true,
    });
    metrics?.recordNotificationDelivery('delivered');
  } catch (error) {
    metrics?.recordNotificationDelivery('failed');
    throw error;
  }
}
