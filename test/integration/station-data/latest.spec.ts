import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';
import { startUpstreamServer, type UpstreamServer } from '../../helpers/upstream-server.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { StationDataService } from '../../../src/station-data/station-data.service.js';
import type { WeatherClientService } from '../../../src/integrations/weather/weather-client.service.js';
import type { AuthorizedStation } from '../../../src/station-data/station.repository.js';
import type { LatestSoilDataDto } from '../../../src/station-data/station-data.contracts.js';

type ErrorResponse = { error: { code: string } };

const testStation: AuthorizedStation = {
  id: '11111111-1111-4111-8111-111111111111',
  farmId: '22222222-2222-4222-8222-222222222222',
  plotId: '33333333-3333-4333-8333-333333333333',
  name: 'Station NODE01',
  code: 'NODE01',
  upstreamCode: 'NODE01',
};

const makeNode01Soil = (extra: Record<string, unknown> = {}) => ({
  ts: 1785469178997,
  time: '2026-07-31T03:39:38.997Z',
  _fieldTs: {
    moisture: 1784276866000,
    temperature: 1784276866000,
    ph: 1784276866000,
  },
  moisture: 43,
  temperature: 25.5,
  ...extra,
});

const node01Response = (soil = makeNode01Soil()) => ({
  status: 200,
  body: {
    success: true,
    data: [{ station: 'NODE01', latest: { soil } }],
  },
});

describe('StationDataService unit behavior', () => {
  it('calls weather client with resolved upstream station and maps canonical cache key', async () => {
    const config = makeTestRuntimeConfig();
    const getLatestSpy = vi.fn().mockResolvedValue([
      {
        station: 'NODE01',
        latest: {
          soil: makeNode01Soil(),
        },
      },
    ]);
    const weather = {
      getLatest: getLatestSpy,
    } as unknown as WeatherClientService;

    const fixedNow = new Date('2026-07-31T03:45:00.000Z');
    const service = new StationDataService(config, weather, undefined, {
      now: () => fixedNow,
    });

    const result1 = await service.getLatest(testStation, { fields: ['temperature', 'moisture'] });
    expect(result1.measurement).toBe('soil');
    expect(result1.isFromCache).toBe(false);
    expect(result1.station).toEqual({
      id: testStation.id,
      name: testStation.name,
      code: testStation.code,
    });
    expect(getLatestSpy).toHaveBeenCalledWith({
      station: ['NODE01'],
      type: ['soil'],
      fields: ['temperature', 'moisture'],
    });

    // Second call with reversed field order shares canonical sorted key
    const result2 = await service.getLatest(testStation, { fields: ['moisture', 'temperature'] });
    expect(result2.isFromCache).toBe(true);
    expect(getLatestSpy).toHaveBeenCalledTimes(1);
  });
});

const dbUrl = process.env.TEST_DATABASE_URL;
const describeDb = dbUrl ? describe : describe.skip;

describeDb('latest soil browser HTTP API', () => {
  let app: NestFastifyApplication;
  let upstream: UpstreamServer;
  let adminToken: string;
  let farmerToken: string;
  let clientToken: string;
  let station1: { id: string };
  let station2: { id: string };

  beforeAll(async () => {
    await prepareTestDatabase();
    const prisma = createTestPrismaClient();

    const [admin, farmer, client] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'latest-admin@example.test',
          displayName: 'Latest Admin',
          passwordHash: 'test',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'latest-farmer@example.test',
          displayName: 'Latest Farmer',
          passwordHash: 'test',
          role: 'FARMER',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'latest-client@example.test',
          displayName: 'Latest Client',
          passwordHash: 'test',
          role: 'CLIENT_DEVELOPER',
          status: 'ACTIVE',
        },
      }),
    ]);

    const [farmA, farmB] = await Promise.all([
      prisma.farm.create({ data: { name: 'Farm A' } }),
      prisma.farm.create({ data: { name: 'Farm B' } }),
    ]);

    const [plotA, plotB] = await Promise.all([
      prisma.plot.create({ data: { farmId: farmA.id, name: 'Plot A' } }),
      prisma.plot.create({ data: { farmId: farmB.id, name: 'Plot B' } }),
    ]);

    [station1, station2] = await Promise.all([
      prisma.station.create({
        data: { plotId: plotA.id, upstreamCode: 'NODE01', name: 'Station 1' },
      }),
      prisma.station.create({
        data: { plotId: plotB.id, upstreamCode: 'NODE02', name: 'Station 2' },
      }),
    ]);

    await prisma.farmMembership.create({ data: { userId: farmer.id, farmId: farmA.id } });

    upstream = await startUpstreamServer([
      node01Response(),
      node01Response(makeNode01Soil({ ph: 'invalid' })),
    ]);

    const config = makeTestRuntimeConfig({ weatherApiBaseUrl: upstream.baseUrl });
    [adminToken, farmerToken, clientToken] = await Promise.all([
      issueAccessToken({ prisma, config, userId: admin.id }),
      issueAccessToken({ prisma, config, userId: farmer.id }),
      issueAccessToken({ prisma, config, userId: client.id }),
    ]);

    app = await createApp(config);
    await prisma.$disconnect();
  });

  afterAll(async () => {
    await app.close();
    await upstream.close();
  });

  const get = (url: string, token: string) =>
    app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

  it('serves latest soil DTO, verifies upstream query and caching, rejects cross-scope and bad inputs', async () => {
    // 1. Success response with farmer token
    const res1 = await get(
      `/api/v1/stations/${station1.id}/data/latest?fields=moisture,temperature`,
      farmerToken,
    );
    expect(res1.statusCode).toBe(200);
    expect(res1.headers['cache-control']).toBe('no-store');
    const data1 = res1.json<{ success: boolean; data: LatestSoilDataDto }>().data;
    expect(data1.measurement).toBe('soil');
    expect(data1.station.id).toBe(station1.id);
    expect(data1.station.code).toBe('NODE01');
    expect(data1.isFromCache).toBe(false);
    expect(data1.fields).toHaveLength(2);
    expect(data1.fields[0]).toMatchObject({ field: 'moisture', value: 43, unit: null });
    expect(data1.fields[1]).toMatchObject({ field: 'temperature', value: 25.5, unit: null });

    // Admin can also read latest soil data
    const adminRes = await get(
      `/api/v1/stations/${station1.id}/data/latest?fields=moisture,temperature`,
      adminToken,
    );
    expect(adminRes.statusCode).toBe(200);

    // Verify exact upstream query
    expect(upstream.requests).toHaveLength(1);
    expect(upstream.requests[0]?.path).toContain('station=NODE01');
    expect(upstream.requests[0]?.path).toContain('type=soil');
    expect(upstream.requests[0]?.path).toContain('fields=moisture%2Ctemperature');

    // 2. Cache hit: second identical call does not call Weather
    const res2 = await get(
      `/api/v1/stations/${station1.id}/data/latest?fields=moisture,temperature`,
      farmerToken,
    );
    expect(res2.statusCode).toBe(200);
    const data2 = res2.json<{ success: boolean; data: LatestSoilDataDto }>().data;
    expect(data2.isFromCache).toBe(true);
    expect(upstream.requests).toHaveLength(1);

    // 3. Cross-scope station: farmer does not belong to Farm B -> safe 404 before Weather
    const crossScope = await get(`/api/v1/stations/${station2.id}/data/latest`, farmerToken);
    expect(crossScope.statusCode).toBe(404);
    expect(upstream.requests).toHaveLength(1);

    // 4. Unknown station -> safe 404 before Weather
    const unknown = await get(
      '/api/v1/stations/00000000-0000-4000-8000-000000000000/data/latest',
      farmerToken,
    );
    expect(unknown.statusCode).toBe(404);
    expect(upstream.requests).toHaveLength(1);

    // 5. CLIENT_DEVELOPER Bearer -> 403 FORBIDDEN
    const clientRes = await get(`/api/v1/stations/${station1.id}/data/latest`, clientToken);
    expect(clientRes.statusCode).toBe(403);
    expect(clientRes.json<ErrorResponse>().error.code).toBe('FORBIDDEN');
    expect(upstream.requests).toHaveLength(1);

    // 6. Validation errors -> 400 before Weather
    const badQueries = [
      `/api/v1/stations/${station1.id}/data/latest?fields=moisture,moisture`,
      `/api/v1/stations/${station1.id}/data/latest?fields=unknown`,
      `/api/v1/stations/${station1.id}/data/latest?fields=`,
      `/api/v1/stations/${station1.id}/data/latest?fields=moisture,,temperature`,
      `/api/v1/stations/${station1.id}/data/latest?fields=moisture&extra=1`,
      `/api/v1/stations/not-a-uuid/data/latest`,
    ];
    for (const badUrl of badQueries) {
      const badRes = await get(badUrl, farmerToken);
      expect(badRes.statusCode).toBe(400);
      expect(badRes.json<ErrorResponse>().error.code).toBe('VALIDATION_ERROR');
    }
    expect(upstream.requests).toHaveLength(1);

    // 7. Invalid upstream response -> 502 UPSTREAM_INVALID_RESPONSE
    // Querying different fields (e.g. ph) triggers a new upstream request which returns fixture 2 (invalid)
    const invalidUpstreamRes = await get(
      `/api/v1/stations/${station1.id}/data/latest?fields=ph`,
      farmerToken,
    );
    expect(upstream.requests).toHaveLength(2);
    expect(upstream.requests[1]?.path).toContain('fields=ph');
    expect(invalidUpstreamRes.statusCode).toBe(502);
    expect(invalidUpstreamRes.json<ErrorResponse>().error.code).toBe('UPSTREAM_INVALID_RESPONSE');
  });
});
