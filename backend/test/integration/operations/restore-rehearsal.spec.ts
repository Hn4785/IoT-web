import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../src/app/create-app.js';
import { TokenHashService } from '../../../src/auth/token-hash.service.js';
import { AppError } from '../../../src/common/errors/app-error.js';
import { SourceSecretService } from '../../../src/data-sources/source-secret.service.js';
import { PrismaClient } from '../../../src/generated/prisma/client.js';
import { StationSourceClientResolver } from '../../../src/station-data/station-source-client.resolver.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

async function retainedState(db: PrismaClient) {
  return {
    users: await db.user.findMany({ orderBy: { id: 'asc' } }),
    sessions: await db.session.findMany({ orderBy: { id: 'asc' } }),
    farms: await db.farm.findMany({ orderBy: { id: 'asc' } }),
    plots: await db.plot.findMany({ orderBy: { id: 'asc' } }),
    stations: await db.station.findMany({ orderBy: { id: 'asc' } }),
    memberships: await db.farmMembership.findMany({
      orderBy: [{ farmId: 'asc' }, { userId: 'asc' }],
    }),
    sources: await db.dataSource.findMany({ orderBy: { id: 'asc' } }),
    grants: await db.dataSourceGrant.findMany({
      orderBy: [{ dataSourceId: 'asc' }, { userId: 'asc' }],
      include: { stations: { orderBy: { stationId: 'asc' } } },
    }),
    keys: await db.apiKey.findMany({
      orderBy: { id: 'asc' },
      include: { scopes: { orderBy: { stationId: 'asc' } } },
    }),
    raw: await db.soilReading.findMany({
      orderBy: [{ stationId: 'asc' }, { field: 'asc' }, { observedAt: 'asc' }],
    }),
    latest: await db.soilLatestReading.findMany({
      orderBy: [{ stationId: 'asc' }, { field: 'asc' }],
    }),
    coverage: await db.soilHistoryCoverage.findMany({
      orderBy: [{ stationId: 'asc' }, { field: 'asc' }, { begin: 'asc' }],
    }),
    checkpoints: await db.soilCollectionCheckpoint.findMany({ orderBy: { stationId: 'asc' } }),
    rules: await db.alertRule.findMany({ orderBy: { id: 'asc' } }),
    alerts: await db.alert.findMany({ orderBy: { id: 'asc' } }),
    events: await db.alertLifecycleEvent.findMany({ orderBy: { id: 'asc' } }),
    notifications: await db.inAppNotification.findMany({ orderBy: { id: 'asc' } }),
    audit: await db.securityAuditEvent.findMany({ orderBy: { id: 'asc' } }),
  };
}

// Local Windows rehearsal only: source is guarded iot_test; every restore target is new.
describe.skipIf(process.platform !== 'win32')('isolated PostgreSQL restore acceptance', () => {
  const source = createTestPrismaClient();
  afterAll(() => source.$disconnect());

  it('restores durable data, grants, ciphertext and lifecycle evidence with working app scope', async () => {
    const config = makeTestRuntimeConfig();
    const endpoint = new URL(config.databaseUrl);
    expect(endpoint.pathname).toBe('/iot_test');
    expect(['localhost', '127.0.0.1']).toContain(endpoint.hostname);
    expect(endpoint.port || '5432').toBe('5432');
    const boundPort = execFileSync('docker', ['port', 'integration-core-postgres-1', '5432/tcp'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    expect(boundPort.trim()).toBe('127.0.0.1:5432');
    await prepareTestDatabase();
    const now = new Date();
    const users = await Promise.all(
      (['FARMER', 'CLIENT_DEVELOPER', 'FARMER'] as const).map((role, index) =>
        source.user.create({
          data: {
            role,
            status: 'ACTIVE',
            displayName: `Restore ${String(index)}`,
            email: `restore-${String(index)}@example.test`,
            passwordHash: 'fixture',
          },
        }),
      ),
    );
    const owner = users[0];
    const client = users[1];
    const outsider = users[2];
    if (!owner || !client || !outsider) throw new Error('Missing restore fixture users');
    const secret = new SourceSecretService(config).encrypt('restore-fixture-provider-key');
    const dataSource = await source.dataSource.create({
      data: {
        ownerUserId: owner.id,
        name: 'Restore fixture',
        baseUrl: 'https://weather.example/api/v1',
        connectionStatus: 'CONNECTED',
        lastCheckedAt: now,
        keyCiphertext: secret.ciphertext,
        keyNonce: secret.nonce,
        keyAuthTag: secret.authTag,
        keyPreview: 'test',
      },
    });
    const farm = await source.farm.create({ data: { name: 'Restore fixture farm' } });
    await source.farmMembership.create({ data: { farmId: farm.id, userId: owner.id } });
    const plot = await source.plot.create({
      data: { farmId: farm.id, name: 'Restore fixture plot' },
    });
    const station = await source.station.create({
      data: {
        plotId: plot.id,
        dataSourceId: dataSource.id,
        upstreamCode: 'RESTORE01',
        name: 'Restore station',
      },
    });
    await source.dataSourceGrant.create({
      data: {
        dataSourceId: dataSource.id,
        userId: client.id,
        stations: { create: { stationId: station.id } },
      },
    });
    const key = `iot_live_restore1_${'r'.repeat(43)}`;
    await source.apiKey.create({
      data: {
        ownerUserId: client.id,
        name: 'Restore key',
        prefix: 'restore1',
        keyHash: new TokenHashService(config.credentialPepper).hash(key),
        expiresAt: new Date(now.getTime() + 86_400_000),
        requestsPerMinute: 60,
        scopes: { create: { stationId: station.id } },
      },
    });
    const reading = {
      dataSourceId: dataSource.id,
      stationId: station.id,
      field: 'moisture',
      observedAt: now,
      fetchedAt: now,
      lastFetchedAt: now,
      value: 42,
    };
    await source.soilReading.create({ data: { ...reading, origin: 'rawHistory' } });
    await source.soilLatestReading.create({ data: { ...reading, origin: 'rawHistory' } });
    await source.soilHistoryCoverage.create({
      data: {
        dataSourceId: dataSource.id,
        stationId: station.id,
        field: 'moisture',
        begin: now,
        end: now,
        fetchedAt: now,
      },
    });
    await source.soilCollectionCheckpoint.create({
      data: {
        stationId: station.id,
        dataSourceId: dataSource.id,
        historyThrough: now,
        lastResult: 'success',
      },
    });
    const rule = await source.alertRule.create({
      data: {
        stationId: station.id,
        field: 'MOISTURE',
        activeKey: `${station.id}:moisture`,
        unit: '%',
        metadataRevision: 'fixture-v1',
        condition: { operator: 'above', threshold: 40 },
        severity: 'WARNING',
      },
    });
    const alert = await source.alert.create({
      data: {
        ruleId: rule.id,
        unresolvedRuleId: rule.id,
        status: 'OPEN',
        openedValue: 42,
        latestValue: 42,
        openedObservedAt: now,
        latestObservedAt: now,
      },
    });
    const event = await source.alertLifecycleEvent.create({
      data: { alertId: alert.id, type: 'OPENED', revision: 1, requestId: 'restore-fixture' },
    });
    await source.inAppNotification.create({
      data: { lifecycleEventId: event.id, recipientUserId: owner.id },
    });
    await source.securityAuditEvent.create({
      data: {
        actorUserId: owner.id,
        action: 'RESTORE_FIXTURE',
        targetType: 'DataSource',
        targetId: dataSource.id,
        requestId: 'restore-fixture',
        result: 'SUCCESS',
      },
    });
    const ownerToken = await issueAccessToken({ prisma: source, config, userId: owner.id });
    const outsiderToken = await issueAccessToken({ prisma: source, config, userId: outsider.id });
    const before = await retainedState(source);

    const restoreName = `iot_restore_d_${randomUUID().replaceAll('-', '')}`;
    const restoreUrl = new URL(config.databaseUrl);
    expect(restoreUrl.pathname).toBe('/iot_test');
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        resolve('scripts/operations/backup-restore-rehearsal.ps1'),
        '-SourceDatabase',
        'iot_test',
        '-RestoreDatabase',
        restoreName,
        '-DatabaseUser',
        decodeURIComponent(restoreUrl.username),
      ],
      { encoding: 'utf8', timeout: 30_000, windowsHide: true },
    );
    restoreUrl.pathname = `/${restoreName}`;
    const restored = new PrismaClient({
      adapter: new PrismaPg({ connectionString: restoreUrl.toString() }),
    });
    const app = await createApp({ ...config, databaseUrl: restoreUrl.toString() });
    try {
      expect(await retainedState(restored)).toEqual(before);
      const restoredSource = await restored.dataSource.findUniqueOrThrow({
        where: { id: dataSource.id },
      });
      if (!restoredSource.keyCiphertext || !restoredSource.keyNonce || !restoredSource.keyAuthTag) {
        throw new Error('Missing restored encrypted source credential');
      }
      expect(
        new SourceSecretService(config).decrypt({
          ciphertext: restoredSource.keyCiphertext,
          nonce: restoredSource.keyNonce,
          authTag: restoredSource.keyAuthTag,
        }),
      ).toBe('restore-fixture-provider-key');
      vi.spyOn(app.get(StationSourceClientResolver), 'resolve').mockRejectedValue(
        new AppError('UPSTREAM_UNAVAILABLE', 502, 'Unavailable'),
      );
      expect((await app.inject({ method: 'GET', url: '/api/v1/readiness' })).statusCode).toBe(200);
      const latest = await app.inject({
        method: 'GET',
        url: '/api/v1/client/data/latest?station=RESTORE01&fields=moisture',
        headers: { 'x-api-key': key },
      });
      expect(latest.statusCode).toBe(200);
      expect(latest.json()).toMatchObject({
        data: {
          dataOrigin: 'stored',
          fetchedAt: now.toISOString(),
          fields: [{ field: 'moisture', value: 42, observedAt: now.toISOString() }],
        },
      });
      expect(latest.body).not.toContain('restore-fixture-provider-key');
      const notification = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(notification.statusCode).toBe(200);
      expect(notification.json()).toMatchObject({
        data: { items: [{ alertId: alert.id, eventType: 'OPENED' }] },
      });
      const denied = await app.inject({
        method: 'GET',
        url: `/api/v1/stations/${station.id}/data/latest?fields=moisture`,
        headers: { authorization: `Bearer ${outsiderToken}` },
      });
      expect([403, 404]).toContain(denied.statusCode);
    } finally {
      await app.close();
      await restored.$disconnect();
      vi.restoreAllMocks();
    }
  }, 45_000);
});
