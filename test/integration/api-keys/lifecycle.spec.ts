import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SignJWT } from 'jose';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const config = makeTestRuntimeConfig();
const prisma = createTestPrismaClient();

type CreatedKeyResponse = {
  data: {
    key: string;
    apiKey: {
      id: string;
      name: string;
      prefix: string;
      requestsPerMinute: number;
      stationIds: string[];
    };
  };
};
type ErrorResponse = { error: { code: string } };

async function accessToken(userId: string): Promise<string> {
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: randomBytes(32).toString('hex'),
      familyId: randomUUID(),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  });
  return new SignJWT({ sessionId: session.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('iot-api')
    .setAudience('iot-web')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(config.jwtSecret));
}

describe('Client Developer API-key lifecycle', () => {
  let app: NestFastifyApplication;
  let client: { id: string };
  let farmer: { id: string };
  let admin: { id: string };
  let clientToken: string;
  let farmerToken: string;
  let adminToken: string;
  let grantedStation: { id: string };
  let ungrantedStation: { id: string };

  beforeAll(async () => {
    await prepareTestDatabase();
    [client, farmer, admin] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'client@example.test',
          displayName: 'Client',
          passwordHash: 'test',
          role: 'CLIENT_DEVELOPER',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'farmer@example.test',
          displayName: 'Farmer',
          passwordHash: 'test',
          role: 'FARMER',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'admin@example.test',
          displayName: 'Admin',
          passwordHash: 'test',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
    ]);
    const farm = await prisma.farm.create({ data: { name: 'Farm' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Plot' } });
    [grantedStation, ungrantedStation] = await Promise.all([
      prisma.station.create({
        data: { plotId: plot.id, upstreamCode: 'granted', name: 'Granted' },
      }),
      prisma.station.create({
        data: { plotId: plot.id, upstreamCode: 'ungranted', name: 'Ungranted' },
      }),
    ]);
    await prisma.clientStationGrant.create({
      data: { userId: client.id, stationId: grantedStation.id },
    });
    [clientToken, farmerToken, adminToken] = await Promise.all([
      accessToken(client.id),
      accessToken(farmer.id),
      accessToken(admin.id),
    ]);
    app = await createApp(config);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function createKey(name = 'Dashboard') {
    return app.inject({
      method: 'POST',
      url: '/api/v1/developer/api-keys',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { name, stationIds: [grantedStation.id] },
    });
  }

  it('returns a scoped plaintext key once and stores only safe credential material', async () => {
    const response = await createKey();

    expect(response.statusCode).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json<CreatedKeyResponse>().data;
    expect(body.key).toMatch(/^iot_live_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}$/);
    expect(body.apiKey).toMatchObject({
      name: 'Dashboard',
      requestsPerMinute: 60,
      stationIds: [grantedStation.id],
    });
    const stored = await prisma.apiKey.findUniqueOrThrow({ where: { id: body.apiKey.id } });
    expect(stored.keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.keyHash).not.toContain(body.key);
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now() + 89 * 24 * 60 * 60_000);
    expect(response.body).not.toContain('keyHash');
  });

  it('rejects incompatible roles, unknown fields and stations outside the account grant', async () => {
    const farmerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/developer/api-keys',
      headers: { authorization: `Bearer ${farmerToken}` },
      payload: { name: 'Blocked', stationIds: [] },
    });
    expect(farmerResponse.statusCode).toBe(403);

    const ungranted = await app.inject({
      method: 'POST',
      url: '/api/v1/developer/api-keys',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { name: 'Too broad', stationIds: [ungrantedStation.id] },
    });
    expect(ungranted.statusCode).toBe(403);
    expect(ungranted.json<ErrorResponse>().error.code).toBe('FORBIDDEN');

    const unknown = await app.inject({
      method: 'POST',
      url: '/api/v1/developer/api-keys',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { name: 'Unknown', stationIds: [], secret: true },
    });
    expect(unknown.statusCode).toBe(400);
  });

  it('lists only safe metadata for the owner', async () => {
    await createKey('List me');
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/developer/api-keys',
      headers: { authorization: `Bearer ${clientToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).not.toContain('keyHash');
    expect(response.body).not.toMatch(/iot_live_[A-Za-z0-9_-]+/);
  });

  it('rotates atomically and revokes keys idempotently for owner or Admin', async () => {
    const created = await createKey('Rotate me');
    const original = created.json<CreatedKeyResponse>().data;
    const rotated = await app.inject({
      method: 'POST',
      url: `/api/v1/developer/api-keys/${original.apiKey.id}/rotate`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(rotated.statusCode).toBe(201);
    expect(rotated.headers['cache-control']).toBe('no-store');
    const replacement = rotated.json<CreatedKeyResponse>().data;
    expect(replacement.key).not.toBe(original.key);
    expect(replacement.apiKey.stationIds).toEqual([grantedStation.id]);
    expect(
      (await prisma.apiKey.findUniqueOrThrow({ where: { id: original.apiKey.id } })).revokedAt,
    ).not.toBeNull();

    for (const token of [clientToken, adminToken, adminToken]) {
      const revoked = await app.inject({
        method: 'POST',
        url: `/api/v1/developer/api-keys/${replacement.apiKey.id}/revoke`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(revoked.statusCode).toBe(200);
    }
  });

  it('allows only one concurrent rotation of the same API key', async () => {
    const created = await createKey('Concurrent rotation');
    const original = created.json<CreatedKeyResponse>().data;
    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        app.inject({
          method: 'POST',
          url: `/api/v1/developer/api-keys/${original.apiKey.id}/rotate`,
          headers: { authorization: `Bearer ${clientToken}` },
        }),
      ),
    );

    expect(responses.map(({ statusCode }) => statusCode).sort()).toEqual([201, 409]);
  });
});
