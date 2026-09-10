/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { TokenHashService } from '../../../src/auth/token-hash.service.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';
import { startUpstreamServer, type UpstreamServer } from '../../helpers/upstream-server.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

describe('client developer HTTP API', () => {
  let app: NestFastifyApplication;
  let upstream: UpstreamServer;
  let clientUser: { id: string };
  let station1: { id: string };
  const validKey = `iot_live_client01_${'a'.repeat(43)}`;
  const limitedKey = `iot_live_client02_${'b'.repeat(43)}`;

  beforeAll(async () => {
    await prepareTestDatabase();
    const prisma = createTestPrismaClient();

    upstream = await startUpstreamServer([
      {
        status: 200,
        body: {
          success: true,
          data: [
            {
              station: 'NODE01',
              latest: {
                soil: {
                  ts: 1785469178997,
                  time: '2026-07-31T03:39:38.997Z',
                  _fieldTs: { moisture: 1784276866000, temperature: 1784276866000 },
                  moisture: 43,
                  temperature: 25.5,
                },
              },
            },
          ],
        },
      },
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
                    ts: 1785469178997,
                    time: '2026-07-31T03:39:38.997Z',
                    moisture: 43,
                  },
                ],
              },
            },
          ],
        },
      },
    ]);

    const config = makeTestRuntimeConfig({ weatherApiBaseUrl: upstream.baseUrl });
    const tokenHash = new TokenHashService(config.credentialPepper);

    clientUser = await prisma.user.create({
      data: {
        email: 'client-dev@example.test',
        displayName: 'Client Dev',
        passwordHash: 'test',
        role: 'CLIENT_DEVELOPER',
        status: 'ACTIVE',
      },
    });

    const farm = await prisma.farm.create({ data: { name: 'Client Farm' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Client Plot' } });

    station1 = await prisma.station.create({
      data: { plotId: plot.id, upstreamCode: 'NODE01', name: 'Station 1' },
    });
    await prisma.station.create({
      data: { plotId: plot.id, upstreamCode: 'NODE02', name: 'Station 2' },
    });

    await prisma.clientStationGrant.create({
      data: { userId: clientUser.id, stationId: station1.id },
    });

    await prisma.apiKey.create({
      data: {
        ownerUserId: clientUser.id,
        name: 'Standard Key',
        prefix: 'client01',
        keyHash: tokenHash.hash(validKey),
        requestsPerMinute: 60,
        expiresAt: new Date(Date.now() + 86400000),
        scopes: {
          create: [{ stationId: station1.id }],
        },
      },
    });

    await prisma.apiKey.create({
      data: {
        ownerUserId: clientUser.id,
        name: 'Limited Key',
        prefix: 'client02',
        keyHash: tokenHash.hash(limitedKey),
        requestsPerMinute: 2,
        expiresAt: new Date(Date.now() + 86400000),
        scopes: {
          create: [{ stationId: station1.id }],
        },
      },
    });

    app = await createApp(config);
    await prisma.$disconnect();
  });

  afterAll(async () => {
    await app.close();
    await upstream.close();
  });

  const get = (url: string, apiKey?: string, headers: Record<string, string> = {}) => {
    const allHeaders: Record<string, string> = { ...headers };
    if (apiKey) {
      allHeaders['x-api-key'] = apiKey;
    }
    return app.inject({ method: 'GET', url, headers: allHeaders });
  };

  it('serves GET /api/v1/client/stations with rate limit headers and scoped stations', async () => {
    const res = await get('/api/v1/client/stations', validKey);
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-ratelimit-limit']).toBe('60');
    expect(Number(res.headers['x-ratelimit-remaining'])).toBeLessThan(60);
    expect(res.headers['x-ratelimit-reset']).toBeDefined();

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toMatchObject({
      id: station1.id,
      code: 'NODE01',
      name: 'Station 1',
    });
  });

  it('rejects missing or invalid API key with 401 and no rate limit headers', async () => {
    const missingRes = await get('/api/v1/client/stations');
    expect(missingRes.statusCode).toBe(401);
    expect(missingRes.json().error.code).toBe('INVALID_API_KEY');
    expect(missingRes.headers['x-ratelimit-limit']).toBeUndefined();

    const invalidRes = await get('/api/v1/client/stations', 'malformed-invalid-key');
    expect(invalidRes.statusCode).toBe(401);
    expect(invalidRes.json().error.code).toBe('INVALID_API_KEY');
    expect(invalidRes.headers['x-ratelimit-limit']).toBeUndefined();

    const bearerRes = await get('/api/v1/client/stations', undefined, {
      authorization: 'Bearer token',
    });
    expect(bearerRes.statusCode).toBe(401);
    expect(bearerRes.json().error.code).toBe('INVALID_API_KEY');
  });

  it('serves GET /api/v1/client/data/latest for granted station code', async () => {
    const res = await get(
      '/api/v1/client/data/latest?station=NODE01&fields=moisture,temperature',
      validKey,
    );
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.station).toMatchObject({
      id: station1.id,
      code: 'NODE01',
    });
    expect(body.data.fields).toMatchObject([
      { field: 'moisture', value: 43 },
      { field: 'temperature', value: 25.5 },
    ]);
  });

  it('rejects latest queries with invalid station codes or unknown/out-of-scope stations', async () => {
    const missingStation = await get('/api/v1/client/data/latest?fields=moisture', validKey);
    expect(missingStation.statusCode).toBe(400);
    expect(missingStation.json().error.code).toBe('VALIDATION_ERROR');

    const invalidStation = await get(
      '/api/v1/client/data/latest?station=NODE*01&fields=moisture',
      validKey,
    );
    expect(invalidStation.statusCode).toBe(400);
    expect(invalidStation.json().error.code).toBe('VALIDATION_ERROR');

    const outOfScope = await get(
      '/api/v1/client/data/latest?station=NODE02&fields=moisture',
      validKey,
    );
    expect(outOfScope.statusCode).toBe(401);
    expect(outOfScope.json().error.code).toBe('INVALID_API_KEY');

    const unknown = await get(
      '/api/v1/client/data/latest?station=UNKNOWN&fields=moisture',
      validKey,
    );
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json().error.code).toBe('INVALID_API_KEY');
  });

  it('serves GET /api/v1/client/data/history for granted station code', async () => {
    const res = await get(
      '/api/v1/client/data/history?station=NODE01&fields=moisture&begin=2026-07-30T00:00:00.000Z&end=2026-08-01T00:00:00.000Z',
      validKey,
    );
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.stationId).toBe(station1.id);
  });

  it('enforces 429 RATE_LIMITED when per-key limit is exceeded', async () => {
    const res1 = await get('/api/v1/client/stations', limitedKey);
    expect(res1.statusCode).toBe(200);
    expect(res1.headers['x-ratelimit-remaining']).toBe('1');

    const res2 = await get('/api/v1/client/stations', limitedKey);
    expect(res2.statusCode).toBe(200);
    expect(res2.headers['x-ratelimit-remaining']).toBe('0');

    const res3 = await get('/api/v1/client/stations', limitedKey);
    expect(res3.statusCode).toBe(429);
    expect(res3.headers['x-ratelimit-remaining']).toBe('0');
    expect(res3.headers['x-ratelimit-limit']).toBe('2');
    expect(res3.json().error.code).toBe('RATE_LIMITED');
  });

  it('browser routes reject API key authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/farms',
      headers: { 'x-api-key': validKey },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHENTICATED');
  });
});
