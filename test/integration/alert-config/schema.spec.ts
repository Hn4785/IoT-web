import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

const prisma = createTestPrismaClient();

describe('alert-config database invariants', () => {
  let stationId: string;
  let ruleId: string;
  let alertId: string;
  let recipientId: string;

  beforeAll(async () => {
    await prepareTestDatabase();
    const farm = await prisma.farm.create({ data: { name: 'Alert farm' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Alert plot' } });
    const station = await prisma.station.create({
      data: { plotId: plot.id, upstreamCode: 'ALERT01', name: 'Alert station' },
    });
    stationId = station.id;
    const recipient = await prisma.user.create({
      data: {
        email: 'alerts@example.test',
        displayName: 'Alert recipient',
        passwordHash: 'test-hash',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    recipientId = recipient.id;
  });

  afterAll(async () => prisma.$disconnect());

  it('rejects duplicate active rules and unresolved alerts atomically', async () => {
    ruleId = randomUUID();
    const activeKey = `${stationId}:moisture`;
    const condition = JSON.stringify({ operator: 'ABOVE', threshold: 70 });
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AlertRule" ("id","stationId","field","unit","metadataRevision","condition","severity","isEnabled","evaluationStatus","revision","activeKey","createdAt","updatedAt") VALUES ($1,$2,'MOISTURE','%','demo:v1:moisture',$3::jsonb,'WARNING',true,'READY',1,$4,now(),now())`,
      ruleId,
      stationId,
      condition,
      activeKey,
    );

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "AlertRule" ("id","stationId","field","unit","metadataRevision","condition","severity","isEnabled","evaluationStatus","revision","activeKey","createdAt","updatedAt") VALUES ($1,$2,'MOISTURE','%','demo:v1:moisture',$3::jsonb,'WARNING',true,'READY',1,$4,now(),now())`,
        randomUUID(),
        stationId,
        condition,
        activeKey,
      ),
    ).rejects.toThrow();

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "AlertRule" ("id","stationId","field","unit","metadataRevision","condition","severity","isEnabled","evaluationStatus","revision","activeKey","createdAt","updatedAt") VALUES ($1,$2,'PH','pH','demo:v1:ph',$3::jsonb,'WARNING',true,'READY',1,NULL,now(),now())`,
        randomUUID(),
        stationId,
        condition,
      ),
    ).rejects.toThrow();

    const alertColumns =
      '"id","ruleId","unresolvedRuleId","status","openedValue","openedObservedAt","latestValue","latestObservedAt","openedAt","revision","updatedAt"';
    const alertValues = "$1,$2,$2,'OPEN',71,now(),71,now(),now(),1,now()";
    alertId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Alert" (${alertColumns}) VALUES (${alertValues})`,
      alertId,
      ruleId,
    );
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Alert" (${alertColumns}) VALUES (${alertValues})`,
        randomUUID(),
        ruleId,
      ),
    ).rejects.toThrow();
  });

  it('rejects duplicate idempotency claims and notification recipients', async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "IdempotencyClaim" ("id","operation","key","requestFingerprint","status","expiresAt","createdAt","updatedAt") VALUES ($1,'RULE_CREATE','retry-1','fingerprint','COMPLETED',now() + interval '7 days',now(),now())`,
      randomUUID(),
    );
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "IdempotencyClaim" ("id","operation","key","requestFingerprint","status","expiresAt","createdAt","updatedAt") VALUES ($1,'RULE_CREATE','retry-1','other','IN_PROGRESS',now() + interval '7 days',now(),now())`,
        randomUUID(),
      ),
    ).rejects.toThrow();

    const eventId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AlertLifecycleEvent" ("id","alertId","type","revision","requestId","createdAt") VALUES ($1,$2,'OPENED',1,'test-request',now())`,
      eventId,
      alertId,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "InAppNotification" ("id","lifecycleEventId","recipientUserId","createdAt") VALUES ($1,$2,$3,now())`,
      randomUUID(),
      eventId,
      recipientId,
    );
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "InAppNotification" ("id","lifecycleEventId","recipientUserId","createdAt") VALUES ($1,$2,$3,now())`,
        randomUUID(),
        eventId,
        recipientId,
      ),
    ).rejects.toThrow();
  });
});
