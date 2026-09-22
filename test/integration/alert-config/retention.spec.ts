import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { RetentionService } from '../../../src/identity/retention.service.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const now = new Date('2026-09-18T00:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60_000);

describeDb('Phase C retention', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let prisma: ReturnType<typeof createTestPrismaClient>;
  let retention: RetentionService;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await prepareTestDatabase();
    app = await createApp(makeTestRuntimeConfig());
    retention = app.get(RetentionService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('purges old notifications and resolved alerts but preserves unresolved evidence', async () => {
    const recipient = await prisma.user.create({
      data: {
        email: 'phase-c-retention@example.test',
        displayName: 'Retention User',
        passwordHash: 'test',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    const farm = await prisma.farm.create({ data: { name: 'Retention Farm' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Retention Plot' } });
    const station = await prisma.station.create({
      data: { plotId: plot.id, upstreamCode: 'RETENTION01', name: 'Retention Station' },
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
        evaluationState: { create: {} },
      },
    });
    const unresolved = await prisma.alert.create({
      data: {
        ruleId: rule.id,
        unresolvedRuleId: rule.id,
        status: 'OPEN',
        openedValue: 10,
        latestValue: 10,
        openedObservedAt: daysAgo(400),
        latestObservedAt: daysAgo(400),
        openedAt: daysAgo(400),
      },
    });
    const unresolvedEvent = await prisma.alertLifecycleEvent.create({
      data: {
        alertId: unresolved.id,
        type: 'OPENED',
        revision: 1,
        requestId: 'retention-unresolved',
        createdAt: daysAgo(400),
      },
    });
    const oldUnresolvedNotification = await prisma.inAppNotification.create({
      data: {
        lifecycleEventId: unresolvedEvent.id,
        recipientUserId: recipient.id,
        createdAt: daysAgo(181),
      },
    });
    const currentEvent = await prisma.alertLifecycleEvent.create({
      data: {
        alertId: unresolved.id,
        type: 'ACKNOWLEDGED',
        revision: 2,
        requestId: 'retention-current',
        createdAt: daysAgo(179),
      },
    });
    const currentNotification = await prisma.inAppNotification.create({
      data: {
        lifecycleEventId: currentEvent.id,
        recipientUserId: recipient.id,
        createdAt: daysAgo(179),
      },
    });
    const resolved = await prisma.alert.create({
      data: {
        ruleId: rule.id,
        status: 'RESOLVED',
        openedValue: 11,
        latestValue: 30,
        openedObservedAt: daysAgo(500),
        latestObservedAt: daysAgo(366),
        openedAt: daysAgo(500),
        resolvedAt: daysAgo(366),
        resolutionReason: 'RECOVERED',
      },
    });
    await prisma.alertLifecycleEvent.create({
      data: {
        alertId: resolved.id,
        type: 'RESOLVED',
        revision: 1,
        requestId: 'retention-resolved',
        createdAt: daysAgo(366),
      },
    });
    const expiredClaim = await prisma.idempotencyClaim.create({
      data: {
        operation: 'RETENTION_TEST',
        key: 'expired',
        requestFingerprint: 'a'.repeat(64),
        status: 'COMPLETED',
        response: { ok: true },
        expiresAt: daysAgo(1),
      },
    });
    const currentClaim = await prisma.idempotencyClaim.create({
      data: {
        operation: 'RETENTION_TEST',
        key: 'current',
        requestFingerprint: 'b'.repeat(64),
        status: 'COMPLETED',
        response: { ok: true },
        expiresAt: new Date(now.getTime() + 60_000),
      },
    });

    const result = await retention.run(now, 'phase-c-retention');

    expect(result.notificationsPurged).toBe(1);
    expect(result.alertsPurged).toBe(1);
    expect(result.idempotencyClaimsPurged).toBe(1);
    expect(await prisma.alert.findUnique({ where: { id: unresolved.id } })).not.toBeNull();
    expect(await prisma.alert.findUnique({ where: { id: resolved.id } })).toBeNull();
    expect(
      await prisma.inAppNotification.findUnique({ where: { id: oldUnresolvedNotification.id } }),
    ).toBeNull();
    expect(
      await prisma.inAppNotification.findUnique({ where: { id: currentNotification.id } }),
    ).not.toBeNull();
    expect(await prisma.idempotencyClaim.findUnique({ where: { id: expiredClaim.id } })).toBeNull();
    expect(
      await prisma.idempotencyClaim.findUnique({ where: { id: currentClaim.id } }),
    ).not.toBeNull();
  });
});
