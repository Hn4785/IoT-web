import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';
import { startUpstreamServer, type UpstreamServer } from '../../helpers/upstream-server.js';

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDb('soil history browser HTTP API', () => {
  let app: NestFastifyApplication | undefined;
  let upstream: UpstreamServer | undefined;
  let farmerToken: string;
  let clientToken: string;
  let stationId: string;
  let otherStationId: string;

  beforeAll(async () => {
    await prepareTestDatabase();
    const prisma = createTestPrismaClient();
    const farmer = await prisma.user.create({
      data: {
        email: 'history-farmer@example.test',
        displayName: 'History Farmer',
        passwordHash: 'test',
        role: 'FARMER',
        status: 'ACTIVE',
      },
    });
    const client = await prisma.user.create({
      data: {
        email: 'history-client@example.test',
        displayName: 'History Client',
        passwordHash: 'test',
        role: 'CLIENT_DEVELOPER',
        status: 'ACTIVE',
      },
    });
    const farm = await prisma.farm.create({ data: { name: 'History Farm' } });
    const otherFarm = await prisma.farm.create({ data: { name: 'Other History Farm' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'History Plot' } });
    const otherPlot = await prisma.plot.create({
      data: { farmId: otherFarm.id, name: 'Other History Plot' },
    });
    const station = await prisma.station.create({
      data: { plotId: plot.id, upstreamCode: 'NODE01', name: 'History Station' },
    });
    const otherStation = await prisma.station.create({
      data: { plotId: otherPlot.id, upstreamCode: 'NODE02', name: 'Other Station' },
    });
    stationId = station.id;
    otherStationId = otherStation.id;
    await prisma.farmMembership.create({ data: { userId: farmer.id, farmId: farm.id } });

    upstream = await startUpstreamServer([
      {
        status: 200,
        body: {
          success: true,
          data: [
            {
              station: 'NODE01',
              history: {
                soil: [
                  {
                    ts: 1_788_220_800_000,
                    time: '2026-09-01T00:00:00Z',
                    moisture: 40,
                  },
                  {
                    ts: 1_788_220_860_000,
                    time: '2026-09-01T00:01:00Z',
                    moisture: 41,
                    light: 300,
                  },
                ],
              },
            },
          ],
        },
      },
    ]);
    const config = makeTestRuntimeConfig({ weatherApiBaseUrl: upstream.baseUrl });
    [farmerToken, clientToken] = await Promise.all([
      issueAccessToken({ prisma, config, userId: farmer.id }),
      issueAccessToken({ prisma, config, userId: client.id }),
    ]);
    app = await createApp(config);
    await prisma.$disconnect();
  });

  afterAll(async () => {
    await app?.close();
    await upstream?.close();
  });

  const get = (url: string, token: string) => {
    if (!app) throw new Error('Test application is not initialized');
    return app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });
  };

  it('returns scoped sparse series, validates queries and caches identical requests', async () => {
    if (!upstream) throw new Error('Test upstream is not initialized');
    const query =
      '?begin=2026-09-01T00%3A00%3A00Z&end=2026-09-02T00%3A00%3A00Z&fields=moisture,light&limit=2';
    const first = await get(`/api/v1/stations/${stationId}/data/history${query}`, farmerToken);
    expect(first.statusCode).toBe(200);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(first.json<{ data: Record<string, unknown> }>().data).toMatchObject({
      stationId,
      measurement: 'soil',
      isFromCache: false,
      isStale: false,
      page: { nextCursor: null },
      series: [
        { field: 'moisture', unit: null, points: [{ value: 40 }, { value: 41 }] },
        { field: 'light', unit: null, points: [{ value: 300 }] },
      ],
    });
    expect(upstream.requests[0]?.path).toContain('station=NODE01');
    expect(upstream.requests[0]?.path).toContain('type=soil');
    expect(upstream.requests[0]?.path).toContain('limit=5');
    expect(upstream.requests[0]?.path).not.toContain('aggregate=');

    const cached = await get(`/api/v1/stations/${stationId}/data/history${query}`, farmerToken);
    expect(cached.statusCode).toBe(200);
    expect(cached.json<{ data: { isFromCache: boolean } }>().data.isFromCache).toBe(true);
    expect(upstream.requests).toHaveLength(1);

    const crossScope = await get(
      `/api/v1/stations/${otherStationId}/data/history${query}`,
      farmerToken,
    );
    expect(crossScope.statusCode).toBe(404);
    expect(upstream.requests).toHaveLength(1);

    const client = await get(`/api/v1/stations/${stationId}/data/history${query}`, clientToken);
    expect(client.statusCode).toBe(403);
    expect(upstream.requests).toHaveLength(1);

    for (const invalid of [
      '?begin=2026-09-01T00:00:00Z',
      '?begin=2026-09-01T00:00:00Z&end=2026-09-09T00:00:00Z',
      '?begin=2026-09-01T00:00:00Z&end=2026-09-02T00:00:00Z&fields=ph,ph',
      '?begin=2026-09-01T00:00:00Z&end=2026-09-02T00:00:00Z&interval=5m',
    ]) {
      const response = await get(
        `/api/v1/stations/${stationId}/data/history${invalid}`,
        farmerToken,
      );
      expect(response.statusCode).toBe(400);
    }
    expect(upstream.requests).toHaveLength(1);
  });
});
