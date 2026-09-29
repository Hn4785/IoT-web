import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { SourceSecretService } from '../../../src/data-sources/source-secret.service.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDb('recoverable API source removal', () => {
  let app: NestFastifyApplication;
  let prisma: ReturnType<typeof createTestPrismaClient>;
  let ownerToken: string;
  let otherAdminToken: string;
  let granteeToken: string;
  let sourceId: string;
  let stationId: string;
  let alertId: string;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await prepareTestDatabase();
    const config = makeTestRuntimeConfig();
    const [owner, otherAdmin, grantee] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'remove-owner@example.test',
          displayName: 'Remove Owner',
          passwordHash: 'test',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'remove-admin@example.test',
          displayName: 'Remove Admin',
          passwordHash: 'test',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'remove-farmer@example.test',
          displayName: 'Remove Farmer',
          passwordHash: 'test',
          role: 'FARMER',
          status: 'ACTIVE',
        },
      }),
    ]);
    const encrypted = new SourceSecretService(config).encrypt('remove-provider-secret');
    const source = await prisma.dataSource.create({
      data: {
        ownerUserId: owner.id,
        name: 'Removable soil source',
        baseUrl: 'https://remove.example.test/api/v1',
        keyCiphertext: encrypted.ciphertext,
        keyNonce: encrypted.nonce,
        keyAuthTag: encrypted.authTag,
        keyPreview: 'cret',
        connectionStatus: 'CONNECTED',
        lastCheckedAt: new Date(),
      },
    });
    sourceId = source.id;
    const farm = await prisma.farm.create({ data: { name: 'Removal Farm' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Removal Plot' } });
    const station = await prisma.station.create({
      data: {
        plotId: plot.id,
        dataSourceId: source.id,
        upstreamCode: 'REMOVE01',
        name: 'Removal Station',
      },
    });
    stationId = station.id;
    await prisma.dataSourceGrant.create({
      data: {
        dataSourceId: source.id,
        userId: grantee.id,
        stations: { create: { stationId: station.id } },
      },
    });
    const rule = await prisma.alertRule.create({
      data: {
        stationId: station.id,
        field: 'MOISTURE',
        unit: '%',
        metadataRevision: 'remove:v1:moisture',
        condition: { operator: 'BELOW', threshold: 20 },
        severity: 'WARNING',
        isEnabled: true,
        evaluationStatus: 'READY',
        activeKey: `${station.id}:moisture`,
        evaluationState: { create: {} },
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
    alertId = alert.id;
    const tokens = await Promise.all(
      [owner.id, otherAdmin.id, grantee.id].map((userId) =>
        issueAccessToken({ prisma, config, userId }),
      ),
    );
    if (tokens.length !== 3) throw new Error('Expected three access tokens');
    [ownerToken, otherAdminToken, granteeToken] = tokens as [string, string, string];
    app = await createApp(config);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const remove = (token: string) =>
    app.inject({
      method: 'DELETE',
      url: `/api/v1/data-sources/${sourceId}`,
      headers: { authorization: `Bearer ${token}` },
    });

  it('allows only the owner and makes retries idempotent', async () => {
    expect((await remove(otherAdminToken)).statusCode).toBe(403);

    const removed = await remove(ownerToken);
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ success: true, data: { removed: true } });

    const retry = await remove(ownerToken);
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual({ success: true, data: { removed: true } });
  });

  it('erases credentials, grants and active behavior while preserving evidence', async () => {
    const source = await prisma.dataSource.findUniqueOrThrow({ where: { id: sourceId } });
    expect(source).toMatchObject({
      keyCiphertext: null,
      keyNonce: null,
      keyAuthTag: null,
      keyPreview: null,
    });
    expect((source as typeof source & { removedAt: Date | null }).removedAt).toBeInstanceOf(Date);
    expect(await prisma.dataSourceGrant.count({ where: { dataSourceId: sourceId } })).toBe(0);

    const rule = await prisma.alertRule.findFirstOrThrow({ where: { stationId } });
    expect(rule).toMatchObject({
      isEnabled: false,
      evaluationStatus: 'DISABLED',
      activeKey: null,
    });
    const alert = await prisma.alert.findUniqueOrThrow({ where: { id: alertId } });
    expect(alert).toMatchObject({
      status: 'RESOLVED',
      unresolvedRuleId: null,
      resolutionReason: 'SOURCE_REMOVED',
    });
    expect(
      await prisma.alertLifecycleEvent.count({
        where: { alertId, type: 'RESOLVED' },
      }),
    ).toBe(1);

    const hiddenSource = await app.inject({
      method: 'GET',
      url: `/api/v1/data-sources/${sourceId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(hiddenSource.statusCode).toBe(404);
    const hiddenStation = await app.inject({
      method: 'GET',
      url: `/api/v1/stations/${stationId}`,
      headers: { authorization: `Bearer ${granteeToken}` },
    });
    expect(hiddenStation.statusCode).toBe(404);

    const audit = await prisma.securityAuditEvent.findFirstOrThrow({
      where: { action: 'DATA_SOURCE_REMOVED', targetId: sourceId },
    });
    expect(JSON.stringify(audit.metadata)).not.toContain('remove-provider-secret');
  });
});
