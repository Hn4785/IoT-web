import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SignJWT } from 'jose';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { ScopeService } from '../../../src/authorization/scope.service.js';
import type { CurrentPrincipalValue } from '../../../src/authorization/current-principal.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const config = makeTestRuntimeConfig();
const prisma = createTestPrismaClient();

function principal(userId: string, role: CurrentPrincipalValue['role']): CurrentPrincipalValue {
  return {
    userId,
    sessionId: randomUUID(),
    role,
    status: 'ACTIVE',
    isSuperAdmin: false,
  };
}

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

describe('resource scope administration', () => {
  let app: NestFastifyApplication;
  let scopes: ScopeService;
  let admin: { id: string };
  let farmer: { id: string };
  let client: { id: string };
  let adminToken: string;
  let firstFarm: { id: string };
  let secondFarm: { id: string };
  let firstPlot: { id: string };
  let secondPlot: { id: string };
  let firstStation: { id: string };
  let secondStation: { id: string };

  beforeAll(async () => {
    await prepareTestDatabase();
    [admin, farmer, client] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'admin@example.test',
          displayName: 'Admin',
          passwordHash: 'test',
          role: 'ADMIN',
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
          email: 'client@example.test',
          displayName: 'Client',
          passwordHash: 'test',
          role: 'CLIENT_DEVELOPER',
          status: 'ACTIVE',
        },
      }),
    ]);
    [firstFarm, secondFarm] = await Promise.all([
      prisma.farm.create({ data: { name: 'Farm One' } }),
      prisma.farm.create({ data: { name: 'Farm Two' } }),
    ]);
    [firstPlot, secondPlot] = await Promise.all([
      prisma.plot.create({ data: { farmId: firstFarm.id, name: 'Plot One' } }),
      prisma.plot.create({ data: { farmId: secondFarm.id, name: 'Plot Two' } }),
    ]);
    [firstStation, secondStation] = await Promise.all([
      prisma.station.create({
        data: { plotId: firstPlot.id, upstreamCode: 'station-one', name: 'Station One' },
      }),
      prisma.station.create({
        data: { plotId: secondPlot.id, upstreamCode: 'station-two', name: 'Station Two' },
      }),
    ]);
    adminToken = await accessToken(admin.id);
    app = await createApp(config);
    scopes = app.get(ScopeService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('adds and removes Farmer farm membership idempotently', async () => {
    const url = `/api/v1/admin/users/${farmer.id}/farm-memberships/${firstFarm.id}`;
    for (const method of ['PUT', 'PUT', 'DELETE', 'DELETE'] as const) {
      const response = await app.inject({
        method,
        url,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
    }

    const incompatible = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/users/${client.id}/farm-memberships/${firstFarm.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(incompatible.statusCode).toBe(409);
  });

  it('removes key scopes when an account-level station grant is removed', async () => {
    const url = `/api/v1/admin/users/${client.id}/station-grants/${firstStation.id}`;
    const granted = await app.inject({
      method: 'PUT',
      url,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(granted.statusCode).toBe(200);

    const key = await prisma.apiKey.create({
      data: {
        ownerUserId: client.id,
        name: 'Scoped key',
        prefix: 'iot_scope_test',
        keyHash: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
        scopes: { create: { stationId: firstStation.id } },
      },
    });
    const removed = await app.inject({
      method: 'DELETE',
      url,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(removed.statusCode).toBe(200);
    expect(await prisma.apiKeyStationScope.count({ where: { apiKeyId: key.id } })).toBe(0);

    const repeated = await app.inject({
      method: 'DELETE',
      url,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(repeated.statusCode).toBe(200);
  });

  it('derives Admin and Farmer access from current hierarchy while denying browser clients', async () => {
    await prisma.farmMembership.create({ data: { userId: farmer.id, farmId: firstFarm.id } });

    await expect(
      scopes.canReadStation(principal(admin.id, 'ADMIN'), firstStation.id),
    ).resolves.toBe(true);
    await expect(
      scopes.canReadStation(principal(farmer.id, 'FARMER'), firstStation.id),
    ).resolves.toBe(true);
    await expect(
      scopes.canReadStation(principal(farmer.id, 'FARMER'), secondStation.id),
    ).resolves.toBe(false);
    await expect(
      scopes.canReadStation(principal(client.id, 'CLIENT_DEVELOPER'), firstStation.id),
    ).resolves.toBe(false);
    await expect(scopes.canReadStation(principal(admin.id, 'ADMIN'), randomUUID())).resolves.toBe(
      false,
    );

    await prisma.station.update({
      where: { id: firstStation.id },
      data: { plotId: secondPlot.id },
    });
    await expect(
      scopes.canReadStation(principal(farmer.id, 'FARMER'), firstStation.id),
    ).resolves.toBe(false);
  });
});
