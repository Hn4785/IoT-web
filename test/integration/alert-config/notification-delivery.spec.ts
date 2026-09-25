import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { queueLifecycleNotifications } from '../../../src/notifications/notification-delivery.js';
import { NotificationDeliveryWorker } from '../../../src/notifications/notification-delivery.worker.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDb('durable notification delivery', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let prisma: ReturnType<typeof createTestPrismaClient>;
  let worker: NotificationDeliveryWorker;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await prepareTestDatabase();
    app = await createApp(makeTestRuntimeConfig());
    worker = app.get(NotificationDeliveryWorker);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('delivers more than one recipient batch exactly once and excludes inactive roles', async () => {
    const farm = await prisma.farm.create({ data: { name: 'Delivery Farm' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Delivery Plot' } });
    const station = await prisma.station.create({
      data: { plotId: plot.id, name: 'Delivery Station', upstreamCode: 'DELIVERY01' },
    });
    const rule = await prisma.alertRule.create({
      data: {
        stationId: station.id,
        field: 'MOISTURE',
        unit: '%',
        metadataRevision: 'test:v1',
        condition: { operator: 'BELOW', threshold: 20 },
        severity: 'WARNING',
        isEnabled: false,
        evaluationStatus: 'DISABLED',
      },
    });
    const alert = await prisma.alert.create({
      data: {
        ruleId: rule.id,
        unresolvedRuleId: rule.id,
        status: 'OPEN',
        openedValue: 10,
        latestValue: 10,
        openedObservedAt: new Date(),
        latestObservedAt: new Date(),
      },
    });
    const users = Array.from({ length: 205 }, (_, index) => ({
      email: `delivery-admin-${index.toString()}@example.test`,
      displayName: `Admin ${index.toString()}`,
      passwordHash: 'test',
      role: 'ADMIN' as const,
      status: 'ACTIVE' as const,
    }));
    await prisma.user.createMany({ data: users });
    await prisma.user.createMany({
      data: [
        {
          email: 'delivery-disabled@example.test',
          displayName: 'Disabled',
          passwordHash: 'test',
          role: 'ADMIN',
          status: 'DISABLED',
        },
        {
          email: 'delivery-client@example.test',
          displayName: 'Client',
          passwordHash: 'test',
          role: 'CLIENT_DEVELOPER',
          status: 'ACTIVE',
        },
      ],
    });
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.alertLifecycleEvent.create({
        data: { alertId: alert.id, type: 'OPENED', revision: 1, requestId: 'delivery-batch' },
      });
      await queueLifecycleNotifications(tx, created.id, farm.id);
      return created;
    });
    expect(await prisma.inAppNotification.count()).toBe(0);
    expect(await worker.runOnce()).toBe(3);
    expect(await prisma.inAppNotification.count({ where: { lifecycleEventId: event.id } })).toBe(
      205,
    );
    const job = await prisma.notificationDeliveryJob.findUniqueOrThrow({
      where: { lifecycleEventId: event.id },
    });
    expect(job.deliveredAt).toBeInstanceOf(Date);
    expect(await worker.runOnce()).toBe(0);
    expect(await prisma.inAppNotification.count()).toBe(205);
  });

  it('freezes recipient eligibility before later delivery batches', async () => {
    const farm = await prisma.farm.create({ data: { name: 'Snapshot Farm' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Snapshot Plot' } });
    const station = await prisma.station.create({
      data: { plotId: plot.id, name: 'Snapshot Station', upstreamCode: 'SNAPSHOT01' },
    });
    const rule = await prisma.alertRule.create({
      data: {
        stationId: station.id,
        field: 'MOISTURE',
        unit: '%',
        metadataRevision: 'test:v1',
        condition: { operator: 'BELOW', threshold: 20 },
        severity: 'WARNING',
        isEnabled: false,
        evaluationStatus: 'DISABLED',
      },
    });
    const alert = await prisma.alert.create({
      data: {
        ruleId: rule.id,
        unresolvedRuleId: rule.id,
        status: 'OPEN',
        openedValue: 10,
        latestValue: 10,
        openedObservedAt: new Date(),
        latestObservedAt: new Date(),
      },
    });
    await prisma.user.createMany({
      data: Array.from({ length: 1000 }, (_, index) => ({
        email: `snapshot-admin-${index.toString()}@example.test`,
        displayName: `Snapshot Admin ${index.toString()}`,
        passwordHash: 'test',
        role: 'ADMIN' as const,
        status: 'ACTIVE' as const,
      })),
    });
    const initiallyEligibleId = 'ffffffff-ffff-4fff-8fff-fffffffffffe';
    const newlyEligibleId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    await prisma.user.createMany({
      data: [initiallyEligibleId, newlyEligibleId].map((id, index) => ({
        id,
        email: `snapshot-farmer-${index.toString()}@example.test`,
        displayName: `Snapshot Farmer ${index.toString()}`,
        passwordHash: 'test',
        role: 'FARMER' as const,
        status: 'ACTIVE' as const,
      })),
    });
    await prisma.farmMembership.create({
      data: { farmId: farm.id, userId: initiallyEligibleId },
    });
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.alertLifecycleEvent.create({
        data: { alertId: alert.id, type: 'OPENED', revision: 1, requestId: 'delivery-snapshot' },
      });
      await queueLifecycleNotifications(tx, created.id, farm.id);
      return created;
    });

    expect(await worker.runOnce()).toBe(10);
    await prisma.farmMembership.delete({
      where: { userId_farmId: { userId: initiallyEligibleId, farmId: farm.id } },
    });
    await prisma.farmMembership.create({ data: { farmId: farm.id, userId: newlyEligibleId } });
    expect(await worker.runOnce()).toBeGreaterThan(0);
    expect(
      await prisma.inAppNotification.count({
        where: { lifecycleEventId: event.id, recipientUserId: initiallyEligibleId },
      }),
    ).toBe(1);
    expect(
      await prisma.inAppNotification.count({
        where: { lifecycleEventId: event.id, recipientUserId: newlyEligibleId },
      }),
    ).toBe(0);
  });
});
