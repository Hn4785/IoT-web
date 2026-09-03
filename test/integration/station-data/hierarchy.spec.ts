import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { encodeCursor } from '../../../src/station-data/cursor.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const config = makeTestRuntimeConfig();
const prisma = createTestPrismaClient();

type FarmItem = { id: string; name: string };
type PlotItem = { id: string; farmId: string; name: string };
type StationItem = {
  id: string;
  farmId: string;
  plotId: string;
  name: string;
  code: string;
};
type PageResponse<T> = { data: { items: T[]; nextCursor: string | null } };
type ItemResponse<T> = { data: T };
type ErrorResponse = { error: { code: string } };

describe('authorized browser station hierarchy', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let farmerToken: string;
  let clientToken: string;
  let farmA: { id: string };
  let farmB: { id: string };
  let plotA: { id: string };
  let plotB: { id: string };
  let stationA: { id: string };
  let stationB: { id: string };

  beforeAll(async () => {
    await prepareTestDatabase();
    const [admin, farmer, client] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'hierarchy-admin@example.test',
          displayName: 'Hierarchy Admin',
          passwordHash: 'test',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'hierarchy-farmer@example.test',
          displayName: 'Hierarchy Farmer',
          passwordHash: 'test',
          role: 'FARMER',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'hierarchy-client@example.test',
          displayName: 'Hierarchy Client',
          passwordHash: 'test',
          role: 'CLIENT_DEVELOPER',
          status: 'ACTIVE',
        },
      }),
    ]);

    [farmA, farmB] = await Promise.all([
      prisma.farm.create({ data: { name: 'Farm A' } }),
      prisma.farm.create({ data: { name: 'Farm B' } }),
    ]);
    [plotA, plotB] = await Promise.all([
      prisma.plot.create({ data: { farmId: farmA.id, name: 'Plot A' } }),
      prisma.plot.create({ data: { farmId: farmB.id, name: 'Plot B' } }),
    ]);
    [stationA, stationB] = await Promise.all([
      prisma.station.create({
        data: { plotId: plotA.id, upstreamCode: 'NODE-A', name: 'Station A' },
      }),
      prisma.station.create({
        data: { plotId: plotB.id, upstreamCode: 'NODE-B', name: 'Station B' },
      }),
    ]);
    await prisma.farmMembership.create({ data: { userId: farmer.id, farmId: farmA.id } });

    [adminToken, farmerToken, clientToken] = await Promise.all([
      issueAccessToken({ prisma, config, userId: admin.id }),
      issueAccessToken({ prisma, config, userId: farmer.id }),
      issueAccessToken({ prisma, config, userId: client.id }),
    ]);
    app = await createApp(config);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const get = (url: string, token: string) =>
    app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

  it('shows current scope to Admin and Farmer while denying browser Client Developer', async () => {
    const admin = await get('/api/v1/farms', adminToken);
    expect(admin.statusCode).toBe(200);
    expect(admin.json<PageResponse<FarmItem>>().data.items).toHaveLength(2);

    const farmer = await get('/api/v1/farms', farmerToken);
    expect(farmer.statusCode).toBe(200);
    expect(farmer.json<PageResponse<FarmItem>>().data.items).toEqual([
      expect.objectContaining({ id: farmA.id }),
    ]);

    const plots = await get(`/api/v1/farms/${farmA.id}/plots`, farmerToken);
    expect(plots.statusCode).toBe(200);
    expect(plots.json<PageResponse<PlotItem>>().data.items).toEqual([
      expect.objectContaining({ id: plotA.id, farmId: farmA.id }),
    ]);

    const stations = await get(`/api/v1/plots/${plotA.id}/stations`, farmerToken);
    expect(stations.statusCode).toBe(200);
    expect(stations.json<PageResponse<StationItem>>().data.items).toEqual([
      expect.objectContaining({ id: stationA.id, plotId: plotA.id, code: 'NODE-A' }),
    ]);
    expect(stations.json<PageResponse<StationItem>>().data.items[0]).not.toHaveProperty(
      'upstreamCode',
    );

    expect((await get(`/api/v1/farms/${farmB.id}/plots`, farmerToken)).statusCode).toBe(404);
    expect((await get(`/api/v1/stations/${stationB.id}`, farmerToken)).statusCode).toBe(404);
    expect(
      (await get(`/api/v1/stations/${stationA.id}`, farmerToken)).json<ItemResponse<StationItem>>()
        .data,
    ).toMatchObject({ id: stationA.id, farmId: farmA.id, plotId: plotA.id, code: 'NODE-A' });

    const client = await get('/api/v1/farms', clientToken);
    expect(client.statusCode).toBe(403);
    expect(client.json<ErrorResponse>().error.code).toBe('FORBIDDEN');
  });

  it('uses opaque keyset pagination and rejects a cursor from another route', async () => {
    await prisma.farm.createMany({
      data: Array.from({ length: 105 }, (_, index) => ({
        name: `Pagination Farm ${String(index).padStart(3, '0')}`,
      })),
    });

    const first = await get('/api/v1/farms', adminToken);
    expect(first.statusCode).toBe(200);
    const firstPage = first.json<PageResponse<FarmItem>>().data;
    expect(firstPage.items).toHaveLength(50);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const second = await get(
      `/api/v1/farms?cursor=${encodeURIComponent(firstPage.nextCursor ?? '')}`,
      adminToken,
    );
    expect(second.statusCode).toBe(200);
    const secondPage = second.json<PageResponse<FarmItem>>().data;
    expect(secondPage.items).toHaveLength(50);
    const ids = [...firstPage.items, ...secondPage.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    const farmCursor = encodeCursor({
      v: 1,
      kind: 'farm',
      name: 'Farm A',
      id: farmA.id,
    });
    const mismatched = await get(
      `/api/v1/farms/${farmA.id}/plots?cursor=${encodeURIComponent(farmCursor)}`,
      adminToken,
    );
    expect(mismatched.statusCode).toBe(400);
    expect(mismatched.json<ErrorResponse>().error.code).toBe('VALIDATION_ERROR');
  });
});
