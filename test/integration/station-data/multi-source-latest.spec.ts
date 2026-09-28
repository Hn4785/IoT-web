import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { SourceSecretService } from '../../../src/data-sources/source-secret.service.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';
import { startUpstreamServer, type UpstreamServer } from '../../helpers/upstream-server.js';

const prisma = createTestPrismaClient();

const latestResponse = (value: number) => ({
  status: 200,
  body: {
    success: true,
    data: [
      {
        station: 'NODE01',
        latest: {
          soil: {
            ts: 1_790_000_000_000,
            time: '2026-09-22T14:13:20.000Z',
            _fieldTs: { moisture: 1_790_000_000_000 },
            moisture: value,
          },
        },
      },
    ],
  },
});

describe('multi-source latest routing', () => {
  let app: NestFastifyApplication;
  let firstUpstream: UpstreamServer;
  let secondUpstream: UpstreamServer;
  let token: string;
  let firstStationId: string;
  let secondStationId: string;

  beforeAll(async () => {
    await prepareTestDatabase();
    [firstUpstream, secondUpstream] = await Promise.all([
      startUpstreamServer([latestResponse(31)]),
      startUpstreamServer([latestResponse(72)]),
    ]);
    const config = makeTestRuntimeConfig({
      dataSourceAllowedOrigins: [firstUpstream.baseUrl, secondUpstream.baseUrl],
    });
    const admin = await prisma.user.create({
      data: {
        email: 'multi-source-admin@example.test',
        displayName: 'Multi Source Admin',
        passwordHash: 'test',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    const farm = await prisma.farm.create({ data: { name: 'Multi Source Farm' } });
    const plot = await prisma.plot.create({
      data: { farmId: farm.id, name: 'Multi Source Plot' },
    });
    const secrets = new SourceSecretService(config);
    const firstSecret = secrets.encrypt('first-source-key');
    const secondSecret = secrets.encrypt('second-source-key');
    const [firstSource, secondSource] = await Promise.all([
      prisma.dataSource.create({
        data: {
          ownerUserId: admin.id,
          name: 'First Source',
          baseUrl: `${firstUpstream.baseUrl}/api/v1`,
          keyCiphertext: firstSecret.ciphertext,
          keyNonce: firstSecret.nonce,
          keyAuthTag: firstSecret.authTag,
          keyPreview: '-key',
          connectionStatus: 'CONNECTED',
          lastCheckedAt: new Date(),
        },
      }),
      prisma.dataSource.create({
        data: {
          ownerUserId: admin.id,
          name: 'Second Source',
          baseUrl: `${secondUpstream.baseUrl}/api/v1`,
          keyCiphertext: secondSecret.ciphertext,
          keyNonce: secondSecret.nonce,
          keyAuthTag: secondSecret.authTag,
          keyPreview: '-key',
          connectionStatus: 'CONNECTED',
          lastCheckedAt: new Date(),
        },
      }),
    ]);
    const [firstStation, secondStation] = await Promise.all([
      prisma.station.create({
        data: {
          plotId: plot.id,
          dataSourceId: firstSource.id,
          upstreamCode: 'NODE01',
          name: 'First Node',
        },
      }),
      prisma.station.create({
        data: {
          plotId: plot.id,
          dataSourceId: secondSource.id,
          upstreamCode: 'NODE01',
          name: 'Second Node',
        },
      }),
    ]);
    firstStationId = firstStation.id;
    secondStationId = secondStation.id;
    token = await issueAccessToken({ prisma, config, userId: admin.id });
    app = await createApp(config);
  });

  afterAll(async () => {
    await app.close();
    await Promise.all([firstUpstream.close(), secondUpstream.close()]);
    await prisma.$disconnect();
  });

  it('uses each station source URL and key even when station codes match', async () => {
    const get = (stationId: string) =>
      app.inject({
        method: 'GET',
        url: `/api/v1/stations/${stationId}/data/latest?fields=moisture`,
        headers: { authorization: `Bearer ${token}` },
      });
    const [first, second] = await Promise.all([get(firstStationId), get(secondStationId)]);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json<{ data: { fields: Array<{ value: number }> } }>().data.fields[0]?.value).toBe(
      31,
    );
    expect(
      second.json<{ data: { fields: Array<{ value: number }> } }>().data.fields[0]?.value,
    ).toBe(72);
    expect(firstUpstream.requests[0]?.headers['x-api-key']).toBe('first-source-key');
    expect(secondUpstream.requests[0]?.headers['x-api-key']).toBe('second-source-key');
  });
});
