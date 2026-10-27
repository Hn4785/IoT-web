import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { TokenHashService } from '../../../src/auth/token-hash.service.js';
import { SourceUpstreamService } from '../../../src/data-sources/source-upstream.service.js';
import { SecurityAuditService } from '../../../src/security-audit/security-audit.service.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';
import { startUpstreamServer, type UpstreamServer } from '../../helpers/upstream-server.js';

const prisma = createTestPrismaClient();
afterAll(() => prisma.$disconnect());

describe.each(['ADMIN', 'FARMER'] as const)('%s owner imports new soil nodes', (ownerRole) => {
  let app: NestFastifyApplication;
  let upstream: UpstreamServer;
  let codes: string[];
  let sourceId: string;
  let plotId: string;
  let oldStationId: string;
  let ownerToken: string;
  let otherTokens: string[];
  let recipientTokens: string[];
  const clientKey = `iot_live_import01_${'a'.repeat(43)}`;

  beforeEach(async () => {
    await prepareTestDatabase();
    codes = ['NODE01'];
    upstream = await startUpstreamServer(
      Array.from({ length: 60 }, () => (request) => ({
        status: 200,
        body: request.path.includes('/data/latest')
          ? {
              success: true,
              data: codes.map((station) => ({
                station,
                latest: {
                  soil: {
                    ts: 1788009600000,
                    time: '2026-09-01T00:00:00.000Z',
                    _fieldTs: { moisture: 1788009600000 },
                    moisture: 42,
                  },
                },
              })),
            }
          : { success: true, data: ['CENTER', ...codes] },
      })),
    );
    const config = makeTestRuntimeConfig({ dataSourceAllowedOrigins: [upstream.baseUrl] });
    const roles = [ownerRole, 'ADMIN', 'FARMER', 'CLIENT_DEVELOPER'] as const;
    const users = await Promise.all(
      roles.map((role, index) =>
        prisma.user.create({
          data: {
            email: `import-${index.toString()}@example.test`,
            displayName: `Import ${index.toString()}`,
            passwordHash: 'test',
            role,
            status: 'ACTIVE',
          },
        }),
      ),
    );
    const [owner, observer, , client] = users;
    if (!owner || !observer || !client) throw new Error('Incomplete user fixture');
    await prisma.systemAuthority.create({
      data: { authority: 'SUPER_ADMIN', holderUserId: observer.id },
    });
    const farm = await prisma.farm.create({ data: { name: 'Import farm' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Import plot' } });
    plotId = plot.id;
    if (ownerRole === 'FARMER') {
      await prisma.farmMembership.create({ data: { farmId: farm.id, userId: owner.id } });
    }
    const tokens = await Promise.all(
      users.map((user) => issueAccessToken({ prisma, config, userId: user.id })),
    );
    const [firstToken] = tokens;
    if (!firstToken) throw new Error('Missing owner session');
    ownerToken = firstToken;
    otherTokens = tokens.slice(1);
    recipientTokens = tokens.slice(2, 3);
    app = await createApp(config);
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/data-sources',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        baseUrl: `${upstream.baseUrl}/api/v1`,
        xApiKey: 'import-fixture-key',
        farm: { id: farm.id },
        plot: { id: plotId },
      },
    });
    expect(created.statusCode).toBe(201);
    sourceId = created.json<{ data: { id: string } }>().data.id;
    oldStationId = (await prisma.station.findFirstOrThrow({ where: { dataSourceId: sourceId } }))
      .id;
    await prisma.apiKey.create({
      data: {
        ownerUserId: client.id,
        name: 'Existing client scope',
        prefix: 'import01',
        keyHash: new TokenHashService(config.credentialPepper).hash(clientKey),
        expiresAt: new Date(Date.now() + 86_400_000),
        scopes: { create: [{ stationId: oldStationId }] },
      },
    });
    for (const user of users.slice(2)) {
      const shared = await app.inject({
        method: 'PUT',
        url: `/api/v1/data-sources/${sourceId}/grants/${user.id}/stations`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { stationIds: [oldStationId] },
      });
      expect(shared.statusCode).toBe(200);
    }
    codes = ['NODE01', 'NODE07', 'NODE08'];
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
    await upstream.close();
  });

  const importNodes = (stationCodes: string[], token = ownerToken) =>
    app.inject({
      method: 'POST',
      url: `/api/v1/data-sources/${sourceId}/stations`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stationCodes },
    });
  const grants = () =>
    prisma.dataSourceGrantStation.findMany({ orderBy: [{ userId: 'asc' }, { stationId: 'asc' }] });

  it('detects unregistered nodes without inserting stations or widening grants', async () => {
    const before = await grants();
    const result = await app.inject({
      method: 'POST',
      url: `/api/v1/data-sources/${sourceId}/test`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(result.statusCode).toBe(201);
    expect(result.json()).toMatchObject({
      data: { stationCount: 3, newStationCodes: ['NODE07', 'NODE08'] },
    });
    expect(await prisma.station.count({ where: { dataSourceId: sourceId } })).toBe(1);
    expect(await grants()).toEqual(before);
  });

  it('imports only selected nodes and keeps old recipients restricted to old stations', async () => {
    const before = await grants();
    const keyScopes = await prisma.apiKeyStationScope.findMany();
    const legacy = await prisma.station.create({
      data: { plotId, upstreamCode: 'NODE07', name: 'Legacy system node' },
    });
    const result = await importNodes(['NODE07']);
    expect(result.statusCode).toBe(201);
    expect(result.json()).toMatchObject({
      data: {
        importedStationCodes: ['NODE07'],
        source: { stationCount: 2, canManageAccess: true },
      },
    });
    const station = await prisma.station.findFirstOrThrow({
      where: { dataSourceId: sourceId, upstreamCode: 'NODE07' },
    });
    expect(station.plotId).toBe(plotId);
    expect(station.id).not.toBe(legacy.id);
    expect(
      (await prisma.station.findUniqueOrThrow({ where: { id: legacy.id } })).dataSourceId,
    ).toBe('00000000-0000-0000-0000-000000000001');
    expect(
      await prisma.station.count({ where: { dataSourceId: sourceId, upstreamCode: 'NODE08' } }),
    ).toBe(0);
    expect(
      (await prisma.station.findUniqueOrThrow({ where: { id: oldStationId } })).upstreamCode,
    ).toBe('NODE01');
    expect(await grants()).toEqual(before);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/stations/${station.id}`,
          headers: { authorization: `Bearer ${ownerToken}` },
        })
      ).statusCode,
    ).toBe(200);
    for (const token of recipientTokens) {
      const headers = { authorization: `Bearer ${token}` };
      expect(
        (await app.inject({ method: 'GET', url: `/api/v1/stations/${station.id}`, headers }))
          .statusCode,
      ).toBe(404);
      expect(
        (await app.inject({ method: 'GET', url: `/api/v1/stations/${oldStationId}`, headers }))
          .statusCode,
      ).toBe(200);
    }
    expect(await prisma.apiKeyStationScope.findMany()).toEqual(keyScopes);
    const clientHeaders = { 'x-api-key': clientKey };
    const clientStations = await app.inject({
      method: 'GET',
      url: '/api/v1/client/stations',
      headers: clientHeaders,
    });
    expect(clientStations.statusCode).toBe(200);
    expect(
      clientStations
        .json<{ data: { items: { id: string }[] } }>()
        .data.items.map((item) => item.id),
    ).toEqual([oldStationId]);
    const denied = await app.inject({
      method: 'GET',
      url: '/api/v1/client/data/latest?station=NODE07',
      headers: clientHeaders,
    });
    expect(denied.statusCode).toBe(401);
    expect(denied.json()).toMatchObject({ error: { code: 'INVALID_API_KEY' } });
    const event = await prisma.securityAuditEvent.findFirstOrThrow({
      where: { action: 'DATA_SOURCE_STATIONS_IMPORTED', targetId: sourceId },
    });
    expect(event.metadata).toMatchObject({ stationCount: 1, stationCodes: ['NODE07'] });
  });

  it('denies cross-owner Super Admin, shared Farmer and client imports', async () => {
    for (const token of otherTokens)
      expect((await importNodes(['NODE07'], token)).statusCode).toBe(403);
    expect(await prisma.station.count({ where: { dataSourceId: sourceId } })).toBe(1);
  });

  it('rejects malformed, duplicate and ineligible selections without partial inserts', async () => {
    for (const selection of [[], ['NODE07', 'NODE07'], ['invalid/code'], ['CENTER']]) {
      expect((await importNodes(selection)).statusCode).toBe(400);
    }
    expect((await importNodes(['NODE07', 'UNKNOWN'])).statusCode).toBe(422);
    expect(await prisma.station.count({ where: { dataSourceId: sourceId } })).toBe(1);
  });

  it('handles repeated and overlapping concurrent imports without duplicates', async () => {
    const results = await Promise.all([importNodes(['NODE07']), importNodes(['NODE07', 'NODE08'])]);
    expect(results.map((result) => result.statusCode)).toEqual([201, 201]);
    expect(await prisma.station.count({ where: { dataSourceId: sourceId } })).toBe(3);
    expect((await importNodes(['NODE07'])).json()).toMatchObject({
      data: { importedStationCodes: [], source: { stationCount: 3 } },
    });
    expect(await prisma.dataSourceGrantStation.count()).toBe(2);
  });

  it('fails closed when a source has multiple destination plots or was removed', async () => {
    const extra = await prisma.plot.create({
      data: {
        farmId: (await prisma.plot.findUniqueOrThrow({ where: { id: plotId } })).farmId,
        name: 'Other import plot',
      },
    });
    await prisma.station.update({ where: { id: oldStationId }, data: { plotId: extra.id } });
    await prisma.station.create({
      data: { dataSourceId: sourceId, plotId, upstreamCode: 'EXISTING', name: 'Existing node' },
    });
    expect((await importNodes(['NODE07'])).statusCode).toBe(409);
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/v1/data-sources/${sourceId}`,
          headers: { authorization: `Bearer ${ownerToken}` },
        })
      ).statusCode,
    ).toBe(200);
    expect((await importNodes(['NODE07'])).statusCode).toBe(404);
    expect(
      await prisma.station.count({ where: { dataSourceId: sourceId, upstreamCode: 'NODE07' } }),
    ).toBe(0);
  });

  it('does not import into a source removed while discovery is in flight', async () => {
    const service = app.get(SourceUpstreamService);
    const discover = service.discoverSoilStations.bind(service);
    const barrier = Promise.withResolvers<undefined>();
    let arrived = false;
    vi.spyOn(service, 'discoverSoilStations').mockImplementation(async (...args) => {
      const result = await discover(...args);
      arrived = true;
      await barrier.promise;
      return result;
    });
    const pending = Promise.resolve(importNodes(['NODE07']));
    try {
      await vi.waitFor(() => {
        expect(arrived).toBe(true);
      });
      const removed = await app.inject({
        method: 'DELETE',
        url: `/api/v1/data-sources/${sourceId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(removed.statusCode).toBe(200);
    } finally {
      barrier.resolve(undefined);
    }
    expect((await pending).statusCode).toBe(404);
    expect(
      await prisma.station.count({ where: { dataSourceId: sourceId, upstreamCode: 'NODE07' } }),
    ).toBe(0);
  });

  it('rolls back new stations if audit recording fails', async () => {
    const audit = app.get(SecurityAuditService);
    const record = audit.record.bind(audit);
    vi.spyOn(audit, 'record').mockImplementation((transaction, input) => {
      if (input.action === 'DATA_SOURCE_STATIONS_IMPORTED')
        throw new Error('fixture audit failure');
      return record(transaction, input);
    });
    expect((await importNodes(['NODE07'])).statusCode).toBe(500);
    expect(await prisma.station.count({ where: { dataSourceId: sourceId } })).toBe(1);
  });
});
