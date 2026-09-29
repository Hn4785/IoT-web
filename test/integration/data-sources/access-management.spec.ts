import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { PasswordService } from '../../../src/auth/password.service.js';
import { SourceSecretService } from '../../../src/data-sources/source-secret.service.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const config = makeTestRuntimeConfig();
const prisma = createTestPrismaClient();

describe('API source access management', () => {
  let app: NestFastifyApplication;
  let ownerToken: string;
  let otherAdminToken: string;
  let farmerToken: string;
  let clientId: string;
  let farmerId: string;
  let adminSourceId: string;
  let farmerSourceId: string;
  let adminStationId: string;
  let secondAdminStationId: string;
  const ownerPassword = 'owner-password-123';
  const providerSecret = 'provider-secret-value';

  beforeAll(async () => {
    await prepareTestDatabase();
    const passwords = new PasswordService();
    const [ownerHash, farmerHash] = await Promise.all([
      passwords.hash(ownerPassword),
      passwords.hash('farmer-password-123'),
    ]);
    const [owner, otherAdmin, farmer, client] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'access-owner@example.test',
          displayName: 'Access Owner',
          passwordHash: ownerHash,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'access-admin@example.test',
          displayName: 'Other Admin',
          passwordHash: ownerHash,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'access-farmer@example.test',
          displayName: 'Access Farmer',
          passwordHash: farmerHash,
          role: 'FARMER',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'access-client@example.test',
          displayName: 'Access Client',
          passwordHash: farmerHash,
          role: 'CLIENT_DEVELOPER',
          status: 'ACTIVE',
        },
      }),
    ]);
    farmerId = farmer.id;
    clientId = client.id;
    const encrypted = new SourceSecretService(config).encrypt(providerSecret);
    const [adminSource, farmerSource] = await Promise.all([
      prisma.dataSource.create({
        data: {
          ownerUserId: owner.id,
          name: 'Admin Source',
          baseUrl: 'https://weather.example/api/v1',
          keyCiphertext: encrypted.ciphertext,
          keyNonce: encrypted.nonce,
          keyAuthTag: encrypted.authTag,
          keyPreview: 'alue',
          connectionStatus: 'CONNECTED',
          lastCheckedAt: new Date(),
        },
      }),
      prisma.dataSource.create({
        data: {
          ownerUserId: farmer.id,
          name: 'Farmer Source',
          baseUrl: 'https://weather.example/api/v1',
          keyCiphertext: encrypted.ciphertext,
          keyNonce: encrypted.nonce,
          keyAuthTag: encrypted.authTag,
          keyPreview: 'alue',
          connectionStatus: 'CONNECTED',
          lastCheckedAt: new Date(),
        },
      }),
    ]);
    adminSourceId = adminSource.id;
    farmerSourceId = farmerSource.id;
    const farm = await prisma.farm.create({ data: { name: 'Shared Source Farm' } });
    const plot = await prisma.plot.create({
      data: { farmId: farm.id, name: 'Shared Source Plot' },
    });
    const [station, secondStation] = await Promise.all([
      prisma.station.create({
        data: {
          plotId: plot.id,
          dataSourceId: adminSource.id,
          upstreamCode: 'SHARED01',
          name: 'Shared Station',
        },
      }),
      prisma.station.create({
        data: {
          plotId: plot.id,
          dataSourceId: adminSource.id,
          upstreamCode: 'SHARED02',
          name: 'Second Shared Station',
        },
      }),
    ]);
    adminStationId = station.id;
    secondAdminStationId = secondStation.id;
    [ownerToken, otherAdminToken, farmerToken] = await Promise.all([
      issueAccessToken({ prisma, config, userId: owner.id }),
      issueAccessToken({ prisma, config, userId: otherAdmin.id }),
      issueAccessToken({ prisma, config, userId: farmer.id }),
    ]);
    app = await createApp(config);
  });

  it('lists source stations only for the owner', async () => {
    const ownerResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/data-sources/${adminSourceId}/stations`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(ownerResponse.statusCode).toBe(200);
    expect(ownerResponse.json<{ data: { items: unknown[] } }>().data.items).toEqual([
      expect.objectContaining({ id: adminStationId, code: 'SHARED01' }),
      expect.objectContaining({ id: secondAdminStationId, code: 'SHARED02' }),
    ]);

    const oversight = await app.inject({
      method: 'GET',
      url: `/api/v1/data-sources/${adminSourceId}/stations`,
      headers: { authorization: `Bearer ${otherAdminToken}` },
    });
    expect(oversight.statusCode).toBe(403);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const request = (input: {
    method: 'POST' | 'PUT' | 'DELETE';
    url: string;
    token: string;
    payload?: object;
  }) =>
    app.inject({
      method: input.method,
      url: input.url,
      headers: { authorization: `Bearer ${input.token}` },
      ...(input.payload === undefined ? {} : { payload: input.payload }),
    });

  it('lets only the owner grant and revoke selected Farmer stations', async () => {
    const grantUrl = `/api/v1/data-sources/${adminSourceId}/grants/${farmerId}`;
    const scopedGrantUrl = `${grantUrl}/stations`;
    const granted = await request({
      method: 'PUT',
      url: scopedGrantUrl,
      token: ownerToken,
      payload: { stationIds: [adminStationId] },
    });
    expect(granted.statusCode).toBe(200);
    expect(granted.json()).toMatchObject({ success: true, data: { assigned: true } });
    expect(await prisma.dataSourceGrant.count()).toBe(1);
    expect(await prisma.dataSourceGrantStation.count()).toBe(1);
    const grants = await app.inject({
      method: 'GET',
      url: `/api/v1/data-sources/${adminSourceId}/grants`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(grants.statusCode).toBe(200);
    expect(grants.json()).toMatchObject({
      success: true,
      data: {
        items: [
          {
            user: {
              id: farmerId,
              displayName: 'Access Farmer',
              email: 'access-farmer@example.test',
            },
            stationIds: [adminStationId],
          },
        ],
      },
    });

    const source = await app.inject({
      method: 'GET',
      url: `/api/v1/data-sources/${adminSourceId}`,
      headers: { authorization: `Bearer ${farmerToken}` },
    });
    expect(source.statusCode).toBe(200);
    expect(
      source.json<{ data: { visibleAccountCount: number; stationCount: number } }>().data,
    ).toMatchObject({ visibleAccountCount: 2, stationCount: 1 });
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/stations/${adminStationId}`,
          headers: { authorization: `Bearer ${farmerToken}` },
        })
      ).statusCode,
    ).toBe(200);

    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/stations/${secondAdminStationId}`,
          headers: { authorization: `Bearer ${farmerToken}` },
        })
      ).statusCode,
    ).toBe(404);

    expect(
      (
        await request({
          method: 'PUT',
          url: scopedGrantUrl,
          token: ownerToken,
          payload: { stationIds: [adminStationId, secondAdminStationId] },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await request({
          method: 'DELETE',
          url: `${scopedGrantUrl}/${adminStationId}`,
          token: ownerToken,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/stations/${adminStationId}`,
          headers: { authorization: `Bearer ${farmerToken}` },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/stations/${secondAdminStationId}`,
          headers: { authorization: `Bearer ${farmerToken}` },
        })
      ).statusCode,
    ).toBe(200);

    const revoked = await request({ method: 'DELETE', url: grantUrl, token: ownerToken });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json()).toMatchObject({ success: true, data: { assigned: false } });
    expect(await prisma.dataSourceGrant.count()).toBe(0);
    expect(await prisma.dataSourceGrantStation.count()).toBe(0);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/data-sources/${adminSourceId}`,
          headers: { authorization: `Bearer ${farmerToken}` },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/stations/${adminStationId}`,
          headers: { authorization: `Bearer ${farmerToken}` },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('does not let Admin override a Farmer-owned source or grant a Client account', async () => {
    expect(
      (
        await request({
          method: 'PUT',
          url: `/api/v1/data-sources/${farmerSourceId}/grants/${farmerId}/stations`,
          token: otherAdminToken,
          payload: { stationIds: [adminStationId] },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request({
          method: 'PUT',
          url: `/api/v1/data-sources/${adminSourceId}/grants/${clientId}/stations`,
          token: ownerToken,
          payload: { stationIds: [adminStationId] },
        })
      ).statusCode,
    ).toBe(409);
  });

  it('reveals the key only to its owner after password confirmation and audits without the key', async () => {
    const url = `/api/v1/data-sources/${adminSourceId}/reveal`;
    const revealed = await request({
      method: 'POST',
      url,
      token: ownerToken,
      payload: { currentPassword: ownerPassword },
    });
    expect(revealed.statusCode).toBe(201);
    expect(revealed.json()).toEqual({
      success: true,
      data: { xApiKey: providerSecret, expiresInSeconds: 30 },
    });

    expect(
      (
        await request({
          method: 'POST',
          url,
          token: ownerToken,
          payload: { currentPassword: 'wrong-password-123' },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await request({
          method: 'POST',
          url,
          token: otherAdminToken,
          payload: { currentPassword: ownerPassword },
        })
      ).statusCode,
    ).toBe(403);
    const audit = await prisma.securityAuditEvent.findFirstOrThrow({
      where: { action: 'DATA_SOURCE_KEY_REVEALED' },
    });
    expect(JSON.stringify(audit.metadata)).not.toContain(providerSecret);
  });
});
