import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';
import { startUpstreamServer, type UpstreamServer } from '../../helpers/upstream-server.js';

const prisma = createTestPrismaClient();

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
  let plotId: string;
  let otherPlotId: string;

  beforeAll(async () => {
    await prepareTestDatabase();
    upstream = await startUpstreamServer([
      { status: 200, body: { success: true, data: ['CENTER', 'NODE01'] } },
      { status: 200, body: { success: true, data: ['NODE02'] } },
      { status: 401, body: { success: false, message: 'invalid key' } },
    ]);
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
    plotId = plot.id;
    otherPlotId = otherPlot.id;
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

  const create = (token: string, input: Record<string, string>) =>
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
      plotId,
    });

    expect(response.statusCode).toBe(201);
    const item = response.json<{ data: SourceItem }>().data;
    expect(item).toMatchObject({
      name: 'Admin Observation API',
      stationCount: 2,
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
    const stored = await prisma.dataSource.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.keyCiphertext).not.toContain('admin-provider-secret');
    expect(await prisma.station.count({ where: { dataSourceId: item.id } })).toBe(2);
  });

  it('lets a Farmer create within assigned scope and hides it from other Farmers', async () => {
    const response = await create(farmerToken, {
      name: 'Farmer Observation API',
      baseUrl: `${upstream.baseUrl}/api/v1/`,
      xApiKey: 'farmer-provider-secret',
      plotId,
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
      plotId,
    });
    expect(invalid.statusCode).toBe(502);
    expect(await prisma.dataSource.count()).toBe(before);

    expect(
      (
        await create(clientToken, {
          name: 'Client API',
          baseUrl: `${upstream.baseUrl}/api/v1`,
          xApiKey: 'client-key',
          plotId,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await create(farmerToken, {
          name: 'Cross-scope API',
          baseUrl: `${upstream.baseUrl}/api/v1`,
          xApiKey: 'farmer-key',
          plotId: otherPlotId,
        })
      ).statusCode,
    ).toBe(404);
    expect(await prisma.dataSource.count()).toBe(before);
  });
});
