import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';
import {
  startUpstreamServer,
  type CapturedRequest,
  type UpstreamServer,
} from '../../helpers/upstream-server.js';

const prisma = createTestPrismaClient();
const soilCodes = ['NODE01', 'NODE02', 'NODE03', 'NODE04', 'NODE05', 'NODE06'] as const;
const stationListResponse = {
  status: 200,
  body: { success: true, data: ['CENTER', ...soilCodes] },
} as const;
const soilLatestResponse = {
  status: 200,
  body: {
    success: true,
    data: soilCodes.map((station, index) => ({
      station,
      latest: {
        soil: {
          ts: 1_788_009_600_000 + index,
          time: '2026-09-01T00:00:00.000Z',
          _fieldTs: { moisture: 1_788_009_600_000 + index },
          moisture: 40 + index,
        },
      },
    })),
  },
} as const;
const sourceFixture = (request: CapturedRequest) => {
  if (request.headers['x-api-key'] === 'wrong-key') {
    return { status: 401, body: { success: false, message: 'invalid key' } };
  }
  return request.path.includes('/data/latest') ? soilLatestResponse : stationListResponse;
};

type SourceItem = {
  id: string;
  name: string;
  owner: { id: string; displayName: string; role: string };
  baseUrl: string;
  keyPreview: string | null;
  stationCount: number;
  visibleAccountCount: number;
  connectionStatus: string;
  canManageAccess: boolean;
  canRevealKey: boolean;
};

describe('API source create and list', () => {
  let app: NestFastifyApplication;
  let upstream: UpstreamServer;
  let adminToken: string;
  let farmerToken: string;
  let clientToken: string;
  let farmId: string;
  let otherFarmId: string;
  let plotId: string;
  let otherPlotId: string;
  let legacyNode01Id: string;
  let legacyNode02Id: string;

  beforeAll(async () => {
    await prepareTestDatabase();
    upstream = await startUpstreamServer(Array.from({ length: 20 }, () => sourceFixture));
    const config = makeTestRuntimeConfig({ dataSourceAllowedOrigins: [upstream.baseUrl] });
    const [admin, farmer, client, farm, otherFarm] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'source-admin@example.test',
          displayName: 'Source Admin',
          passwordHash: 'test',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'source-farmer@example.test',
          displayName: 'Source Farmer',
          passwordHash: 'test',
          role: 'FARMER',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'source-client@example.test',
          displayName: 'Source Client',
          passwordHash: 'test',
          role: 'CLIENT_DEVELOPER',
          status: 'ACTIVE',
        },
      }),
      prisma.farm.create({ data: { name: 'Connected Farm' } }),
      prisma.farm.create({ data: { name: 'Other Farm' } }),
    ]);
    const [plot, otherPlot] = await Promise.all([
      prisma.plot.create({ data: { farmId: farm.id, name: 'Connected Plot' } }),
      prisma.plot.create({ data: { farmId: otherFarm.id, name: 'Other Plot' } }),
    ]);
    farmId = farm.id;
    otherFarmId = otherFarm.id;
    plotId = plot.id;
    otherPlotId = otherPlot.id;
    const [legacyNode01, legacyNode02] = await Promise.all([
      prisma.station.create({
        data: { plotId, upstreamCode: 'NODE01', name: 'Legacy NODE01' },
      }),
      prisma.station.create({
        data: { plotId, upstreamCode: 'NODE02', name: 'Legacy NODE02' },
      }),
      prisma.station.create({
        data: { plotId, upstreamCode: 'LEGACY-ONLY', name: 'Legacy only' },
      }),
      prisma.station.create({
        data: { plotId: otherPlotId, upstreamCode: 'NODE06', name: 'Other plot NODE06' },
      }),
    ]);
    legacyNode01Id = legacyNode01.id;
    legacyNode02Id = legacyNode02.id;
    await prisma.farmMembership.create({ data: { userId: farmer.id, farmId: farm.id } });
    [adminToken, farmerToken, clientToken] = await Promise.all([
      issueAccessToken({ prisma, config, userId: admin.id }),
      issueAccessToken({ prisma, config, userId: farmer.id }),
      issueAccessToken({ prisma, config, userId: client.id }),
    ]);
    app = await createApp(config);
  });

  afterAll(async () => {
    await app.close();
    await upstream.close();
    await prisma.$disconnect();
  });

  const create = (token: string, input: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/data-sources',
      headers: { authorization: `Bearer ${token}` },
      payload: input,
    });

  it('creates only after a valid upstream station response and stores no plaintext key', async () => {
    const response = await create(adminToken, {
      name: 'Admin Observation API',
      baseUrl: `${upstream.baseUrl}/api/v1`,
      xApiKey: 'admin-provider-secret',
      farm: { id: farmId },
      plot: { id: plotId },
    });

    expect(response.statusCode).toBe(201);
    const item = response.json<{ data: SourceItem }>().data;
    expect(item).toMatchObject({
      name: 'Admin Observation API',
      stationCount: 6,
      visibleAccountCount: 1,
      keyPreview: 'cret',
      connectionStatus: 'CONNECTED',
      canManageAccess: true,
      canRevealKey: true,
    });
    expect(JSON.stringify(response.json())).not.toContain('admin-provider-secret');
    expect(upstream.requests[0]?.method).toBe('GET');
    expect(upstream.requests[0]?.path).toBe('/api/v1/stations');
    expect(upstream.requests[0]?.headers['x-api-key']).toBe('admin-provider-secret');
    expect(upstream.requests[1]?.path).toBe(
      '/api/v1/data/latest?station=CENTER%2CNODE01%2CNODE02%2CNODE03%2CNODE04%2CNODE05%2CNODE06&type=soil',
    );
    const stored = await prisma.dataSource.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.keyCiphertext).not.toContain('admin-provider-secret');
    const managedStations = await prisma.station.findMany({
      where: { dataSourceId: item.id },
      orderBy: { upstreamCode: 'asc' },
      select: { id: true, upstreamCode: true },
    });
    expect(managedStations).toHaveLength(6);
    expect(managedStations.map(({ upstreamCode }) => upstreamCode)).toEqual([
      'NODE01',
      'NODE02',
      'NODE03',
      'NODE04',
      'NODE05',
      'NODE06',
    ]);
    expect(managedStations.find(({ upstreamCode }) => upstreamCode === 'NODE01')?.id).toBe(
      legacyNode01Id,
    );
    expect(managedStations.find(({ upstreamCode }) => upstreamCode === 'NODE02')?.id).toBe(
      legacyNode02Id,
    );
    expect(
      await prisma.station.count({
        where: {
          plotId,
          upstreamCode: 'LEGACY-ONLY',
          dataSource: { kind: 'SYSTEM' },
        },
      }),
    ).toBe(1);
    expect(
      await prisma.station.count({
        where: {
          plotId: otherPlotId,
          upstreamCode: 'NODE06',
          dataSource: { kind: 'SYSTEM' },
        },
      }),
    ).toBe(1);

    const tested = await app.inject({
      method: 'POST',
      url: `/api/v1/data-sources/${item.id}/test`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(tested.statusCode).toBe(201);
    expect(tested.json()).toMatchObject({
      success: true,
      data: { connectionStatus: 'CONNECTED', stationCount: 6 },
    });
    expect(upstream.requests[3]?.headers['x-api-key']).toBe('admin-provider-secret');
  });

  it('normalizes and creates a Farm and Plot atomically after soil validation', async () => {
    const response = await create(adminToken, {
      baseUrl: `${upstream.baseUrl}/api/v1`,
      xApiKey: 'new-hierarchy-provider-secret',
      farm: { name: '  Field   One  ' },
      plot: { name: '  North   Plot  ' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ data: SourceItem }>().data).toMatchObject({
      name: '127.0.0.1 — 6 soil stations',
      stationCount: 6,
    });
    const farm = await prisma.farm.findUniqueOrThrow({ where: { name: 'Field One' } });
    const plot = await prisma.plot.findUniqueOrThrow({
      where: { farmId_name: { farmId: farm.id, name: 'North Plot' } },
    });
    expect(await prisma.station.count({ where: { plotId: plot.id } })).toBe(6);
  });

  it('converges concurrent normalized hierarchy creation on one Farm and Plot', async () => {
    const payload = {
      baseUrl: `${upstream.baseUrl}/api/v1`,
      xApiKey: 'concurrent-provider-secret',
      farm: { name: 'Concurrent Farm' },
      plot: { name: 'Concurrent Plot' },
    };
    const [first, second] = await Promise.all([
      create(adminToken, payload),
      create(adminToken, {
        ...payload,
        farm: { name: ' concurrent   farm ' },
        plot: { name: ' concurrent   plot ' },
      }),
    ]);

    expect([first.statusCode, second.statusCode]).toEqual([201, 201]);
    const farms = await prisma.farm.findMany({ where: { name: 'CONCURRENT FARM' } });
    expect(farms).toHaveLength(1);
    const concurrentFarm = farms[0];
    if (!concurrentFarm) throw new Error('Concurrent Farm was not created');
    expect(
      await prisma.plot.count({
        where: { farmId: concurrentFarm.id, name: 'CONCURRENT PLOT' },
      }),
    ).toBe(1);
  });

  it('lets a Farmer create within assigned scope and hides it from other Farmers', async () => {
    const response = await create(farmerToken, {
      name: 'Farmer Observation API',
      baseUrl: `${upstream.baseUrl}/api/v1/`,
      xApiKey: 'farmer-provider-secret',
      farm: { id: farmId },
      plot: { id: plotId },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ data: SourceItem }>().data.owner.role).toBe('FARMER');
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/data-sources',
      headers: { authorization: `Bearer ${farmerToken}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ data: { items: SourceItem[] } }>().data.items).toHaveLength(1);
  });

  it('fails closed for invalid credentials, Client Developer, and Farmer cross-scope writes', async () => {
    const before = await prisma.dataSource.count();
    const invalid = await create(adminToken, {
      name: 'Invalid API',
      baseUrl: `${upstream.baseUrl}/api/v1`,
      xApiKey: 'wrong-key',
      farm: { id: farmId },
      plot: { id: plotId },
    });
    expect(invalid.statusCode).toBe(502);
    expect(await prisma.dataSource.count()).toBe(before);

    expect(
      (
        await create(clientToken, {
          name: 'Client API',
          baseUrl: `${upstream.baseUrl}/api/v1`,
          xApiKey: 'client-key',
          farm: { id: farmId },
          plot: { id: plotId },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await create(farmerToken, {
          name: 'Cross-scope API',
          baseUrl: `${upstream.baseUrl}/api/v1`,
          xApiKey: 'farmer-key',
          farm: { id: otherFarmId },
          plot: { id: otherPlotId },
        })
      ).statusCode,
    ).toBe(404);
    expect(await prisma.dataSource.count()).toBe(before);
  });
});
