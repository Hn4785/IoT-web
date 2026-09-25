import { Prisma } from '../generated/prisma/client.js';

/** Runs inside the lifecycle transaction without scanning recipients. */
export async function queueLifecycleNotifications(
  transaction: Prisma.TransactionClient,
  lifecycleEventId: string,
  farmId: string,
): Promise<void> {
  const event = await transaction.alertLifecycleEvent.findUniqueOrThrow({
    where: { id: lifecycleEventId },
    include: { alert: { include: { rule: { include: { station: true } } } } },
  });
  const { alert } = event;
  await transaction.notificationDeliveryJob.create({
    data: {
      lifecycleEventId,
      farmId,
      stationId: alert.rule.station.id,
      stationCode: alert.rule.station.upstreamCode,
      stationName: alert.rule.station.name,
      field: alert.rule.field,
      severity: alert.rule.severity,
      alertStatus: alert.status,
    },
  });
}
