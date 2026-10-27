import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { SourceSecretService } from '../../../src/data-sources/source-secret.service.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';
import { startUpstreamServer, type UpstreamServer } from '../../helpers/upstream-server.js';

const prisma = createTestPrismaClient();

describe('read-only source connection status', () => {
  let app: NestFastifyApplication;
  let upstream: UpstreamServer;
  let ownerToken: string;
  let viewerToken: string;
  let outsiderToken: string;
  let clientToken: string;
  let viewerId: string;
  let sourceId: string;

  beforeAll(async () => {
    await prepareTestDatabase();
    upstream = await startUpstreamServer([
      { status: 503, body: { message: 'private upstream diagnostic' } },
    ]);
    const config = makeTestRuntimeConfig({ dataSourceAllowedOrigins: [upstream.baseUrl] });
    const users = await Promise.all(
      (['ADMIN', 'FARMER', 'FARMER', 'CLIENT_DEVELOPER'] as const).map((role, index) =>
        prisma.user.create({
          data: {
            email: `status-${index.toString()}@example.test`,
            displayName: `Status ${index.toString()}`,
            passwordHash: 'test',
            role,
            status: 'ACTIVE',
          },
        }),
      ),
    );
    const [owner, viewer] = users;
    if (!owner || !viewer) throw new Error('fixture users missing');
    viewerId = viewer.id;
    const encrypted = new SourceSecretService(config).encrypt('status-provider-test-secret');
    const source = await prisma.dataSource.create({
      data: {
        ownerUserId: owner.id,
        name: 'Status source',
        baseUrl: `${upstream.baseUrl}/api/v1`,
        keyCiphertext: encrypted.ciphertext,
        keyNonce: encrypted.nonce,
        keyAuthTag: encrypted.authTag,
        keyPreview: 'cret',
        connectionStatus: 'CONNECTED',
        lastCheckedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    sourceId = source.id;
    const farm = await prisma.farm.create({ data: { name: 'Status farm' } });
    const plot = await prisma.plot.create({ data: { name: 'Status plot', farmId: farm.id } });
    const station = await prisma.station.create({
      data: {
        plotId: plot.id,
        dataSourceId: sourceId,
        name: 'Status node',
        upstreamCode: 'NODE01',
      },
    });
    await prisma.dataSourceGrant.create({
      data: {
        dataSourceId: sourceId,
        userId: viewerId,
        stations: { create: { stationId: station.id } },
      },
    });
    const tokens = await Promise.all(
      users.map((user) => issueAccessToken({ prisma, config, userId: user.id })),
    );
    [ownerToken, viewerToken, outsiderToken, clientToken] = tokens as [
      string,
      string,
      string,
      string,
    ];
    app = await createApp(config);
  });

  afterAll(async () => {
    await app.close();
    await upstream.close();
    await prisma.$disconnect();
  });

  const check = (token: string) =>
    app.inject({
      method: 'GET',
      url: `/api/v1/data-sources/${sourceId}/connection-status`,
      headers: { authorization: `Bearer ${token}` },
    });

  it('lets a shared Farmer detect an offline API without owner controls or secrets', async () => {
    const response = await check(viewerToken);
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const result = response.json<{
      data: { connectionStatus: string; lastCheckedAt: string; isFromCache: boolean };
    }>();
    expect(result.data).toMatchObject({
      connectionStatus: 'FAILED',
      isFromCache: false,
    });
    expect(Object.keys(result.data).sort()).toEqual([
      'connectionStatus',
      'isFromCache',
      'lastCheckedAt',
    ]);
    expect(typeof result.data.lastCheckedAt).toBe('string');
    expect(Date.parse(result.data.lastCheckedAt)).toBeGreaterThan(
      Date.parse('2026-01-01T00:00:00.000Z'),
    );
    expect(response.body).not.toContain('status-provider-test-secret');
    expect(response.body).not.toContain('private upstream diagnostic');
    expect(upstream.requests).toHaveLength(1);
    expect(upstream.requests[0]?.path).toBe('/api/v1/stations');
    expect(
      (await prisma.dataSource.findUniqueOrThrow({ where: { id: sourceId } })).connectionStatus,
    ).toBe('FAILED');
    const ownerOnly = await app.inject({
      method: 'POST',
      url: `/api/v1/data-sources/${sourceId}/test`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(ownerOnly.statusCode).toBe(403);
    expect(upstream.requests).toHaveLength(1);
  });

  it('shares a bounded result with the owner but never bypasses a revoked grant', async () => {
    const ownerResult = await check(ownerToken);
    expect(ownerResult.statusCode).toBe(200);
    expect(ownerResult.json<{ data: { isFromCache: boolean } }>().data.isFromCache).toBe(true);
    await prisma.dataSourceGrant.deleteMany({
      where: { dataSourceId: sourceId, userId: viewerId },
    });
    expect((await check(viewerToken)).statusCode).toBe(404);
    expect((await check(outsiderToken)).statusCode).toBe(404);
    expect((await check(clientToken)).statusCode).toBe(403);
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/data-sources/${sourceId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(removed.statusCode).toBe(200);
    expect((await check(ownerToken)).statusCode).toBe(404);
    expect(upstream.requests).toHaveLength(1);
  });
});
