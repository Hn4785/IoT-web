import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../src/app/create-app.js';
import { TokenHashService } from '../../../src/auth/token-hash.service.js';
import { AppError } from '../../../src/common/errors/app-error.js';
import type { WeatherClientService } from '../../../src/integrations/weather/weather-client.service.js';
import { SoilReadingRepository } from '../../../src/station-data/soil-reading.repository.js';
import { StationSourceClientResolver } from '../../../src/station-data/station-source-client.resolver.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

type Response = {
  data: { dataOrigin?: string; items?: unknown[]; page?: { nextCursor: string | null } };
};
describe('stored data respects current roles, grants, keys and source removal', () => {
  const prisma = createTestPrismaClient();
  const config = makeTestRuntimeConfig();
  const now = new Date();
  const begin = new Date(now.getTime() - 60_000).toISOString();
  const end = now.toISOString();
  const key = `iot_live_scope001_${'s'.repeat(43)}`;
  let app: NestFastifyApplication;
  let farmerId: string;
  let clientId: string;
  let farmerToken: string;
  let sourceId: string;
  let stationId: string;
  let cursor: string | null | undefined;
  beforeAll(async () => {
    await prepareTestDatabase();
    const farmer = await prisma.user.create({
      data: {
        email: 'stored-farmer@example.test',
        displayName: 'Farmer',
        passwordHash: 'fixture',
        role: 'FARMER',
        status: 'ACTIVE',
      },
    });
    const client = await prisma.user.create({
      data: {
        email: 'stored-client@example.test',
        displayName: 'Client',
        passwordHash: 'fixture',
        role: 'CLIENT_DEVELOPER',
        status: 'ACTIVE',
      },
    });
    farmerId = farmer.id;
    clientId = client.id;
    const source = await prisma.dataSource.create({
      data: {
        ownerUserId: farmerId,
        name: 'Shared',
        baseUrl: 'https://example.invalid',
        keyCiphertext: 'fixture',
        keyNonce: 'fixture',
        keyAuthTag: 'fixture',
        keyPreview: 'test',
        connectionStatus: 'CONNECTED',
        lastCheckedAt: now,
      },
    });
    sourceId = source.id;
    const farm = await prisma.farm.create({ data: { name: 'Scoped' } });
    const plot = await prisma.plot.create({ data: { name: 'Plot', farmId: farm.id } });
    const row = await prisma.station.create({
      data: { name: 'Node', upstreamCode: 'SCOPE01', plotId: plot.id, dataSourceId: sourceId },
    });
    stationId = row.id;
    await prisma.dataSourceGrant.create({
      data: { dataSourceId: sourceId, userId: clientId, stations: { create: { stationId } } },
    });
    await prisma.apiKey.create({
      data: {
        ownerUserId: clientId,
        name: 'Scoped key',
        prefix: 'scope001',
        keyHash: new TokenHashService(config.credentialPepper).hash(key),
        expiresAt: new Date(now.getTime() + 86_400_000),
        requestsPerMinute: 60,
        scopes: { create: { stationId } },
      },
    });
    app = await createApp(config);
    const failure = () => Promise.reject(new AppError('UPSTREAM_UNAVAILABLE', 502, 'Unavailable'));
    vi.spyOn(app.get(StationSourceClientResolver), 'resolve').mockResolvedValue({
      getLatest: failure,
      getHistory: failure,
    } as unknown as WeatherClientService);
    const station = { ...row, code: row.upstreamCode, farmId: farm.id };
    await app.get(SoilReadingRepository).ingestHistory(
      station,
      {
        readings: [
          { field: 'moisture', value: 40, observedAt: begin },
          { field: 'moisture', value: 44, observedAt: end },
        ],
        completeFields: ['moisture'],
        rawCount: 2,
        lastTimestamp: now.getTime(),
      },
      now,
      { begin: new Date(begin), end: now },
    );
    farmerToken = await issueAccessToken({ prisma, config, userId: farmerId });
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  const historyQuery = () =>
    `fields=moisture&begin=${encodeURIComponent(begin)}&end=${encodeURIComponent(end)}&limit=1`;
  const clientGet = (path: string) =>
    app.inject({ method: 'GET', url: `/api/v1/client/${path}`, headers: { 'x-api-key': key } });
  const browserGet = (suffix: string) =>
    app.inject({
      method: 'GET',
      url: `/api/v1/stations/${stationId}/data/${suffix}`,
      headers: { authorization: `Bearer ${farmerToken}` },
    });

  it('allows source-granted client and source owner to read the durable fallback', async () => {
    for (const response of [
      await clientGet('data/latest?station=SCOPE01&fields=moisture'),
      await browserGet('latest?fields=moisture'),
    ]) {
      expect(response.statusCode).toBe(200);
      expect(response.json<Response>().data.dataOrigin).toBe('stored');
    }
    const history = await clientGet(`data/history?station=SCOPE01&${historyQuery()}`);
    expect(history.statusCode).toBe(200);
    expect(history.json<Response>().data.dataOrigin).toBe('stored');
    cursor = history.json<Response>().data.page?.nextCursor;
    expect(cursor).toBeTruthy();
  });

  it('rejects stored reads and stored cursors immediately after current grant removal', async () => {
    await prisma.dataSourceGrant.deleteMany({ where: { userId: clientId } });
    expect((await clientGet('data/latest?station=SCOPE01&fields=moisture')).statusCode).toBe(401);
    expect(
      (
        await clientGet(
          `data/history?station=SCOPE01&${historyQuery()}&cursor=${encodeURIComponent(cursor ?? '')}`,
        )
      ).statusCode,
    ).toBe(401);
    expect((await clientGet('stations')).json<Response>().data.items).toEqual([]);
  });

  it('rejects durable reads for revoked keys and current role changes', async () => {
    await prisma.dataSourceGrant.create({
      data: { dataSourceId: sourceId, userId: clientId, stations: { create: { stationId } } },
    });
    await prisma.apiKey.updateMany({ data: { revokedAt: now } });
    expect((await clientGet('data/latest?station=SCOPE01&fields=moisture')).statusCode).toBe(401);
    await prisma.apiKey.updateMany({ data: { revokedAt: null } });
    await prisma.user.update({ where: { id: clientId }, data: { role: 'FARMER' } });
    expect((await clientGet(`data/history?station=SCOPE01&${historyQuery()}`)).statusCode).toBe(
      401,
    );
    await prisma.user.update({ where: { id: farmerId }, data: { role: 'CLIENT_DEVELOPER' } });
    expect((await browserGet('latest?fields=moisture')).statusCode).toBe(403);
  });

  it('hides removed sources from lists and reads while retaining their data for recovery', async () => {
    await prisma.user.update({ where: { id: clientId }, data: { role: 'CLIENT_DEVELOPER' } });
    await prisma.user.update({ where: { id: farmerId }, data: { role: 'FARMER' } });
    await prisma.clientStationGrant.create({ data: { stationId, userId: clientId } });
    await prisma.dataSource.update({
      where: { id: sourceId },
      data: {
        removedAt: now,
        keyCiphertext: null,
        keyNonce: null,
        keyAuthTag: null,
        keyPreview: null,
      },
    });
    expect((await clientGet('stations')).json<Response>().data.items).toEqual([]);
    expect((await clientGet('data/latest?station=SCOPE01&fields=moisture')).statusCode).toBe(401);
    expect((await browserGet(`history?${historyQuery()}`)).statusCode).toBe(404);
    expect(await prisma.soilReading.count()).toBe(2);
    expect(await prisma.soilLatestReading.count()).toBe(1);
  });
});
