import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { PasswordService } from '../../../src/auth/password.service.js';
import { SourceSecretService } from '../../../src/data-sources/source-secret.service.js';
import type { DataSourceDto } from '../../../src/data-sources/data-source.contracts.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const config = makeTestRuntimeConfig();
const prisma = createTestPrismaClient();

describe('API source access management', () => {
  let app: NestFastifyApplication;
  let ownerToken: string;
  let otherAdminToken: string;
  let otherAdminId: string;
  let farmerToken: string;
  let clientId: string;
  let farmerId: string;
  let candidateFarmerId: string;
  let adminSourceId: string;
  let farmerSourceId: string;
  let adminStationId: string;
  let secondAdminStationId: string;
  let centerStationId: string;
  let farmId: string;
  let plotId: string;
  const ownerPassword = 'owner-password-123';
  const providerSecret = 'provider-secret-value';

  beforeAll(async () => {
    await prepareTestDatabase();
    const passwords = new PasswordService();
    const [ownerHash, farmerHash] = await Promise.all([
      passwords.hash(ownerPassword),
      passwords.hash('farmer-password-123'),
    ]);
    const [owner, otherAdmin, farmer, candidateFarmer, , client] = await Promise.all([
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
          email: 'candidate-farmer@example.test',
          displayName: 'Candidate Farmer',
          passwordHash: farmerHash,
          role: 'FARMER',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'disabled-farmer@example.test',
          displayName: 'Disabled Farmer',
          passwordHash: farmerHash,
          role: 'FARMER',
          status: 'DISABLED',
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
    otherAdminId = otherAdmin.id;
    farmerId = farmer.id;
    candidateFarmerId = candidateFarmer.id;
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
    farmId = farm.id;
    plotId = plot.id;
    const [station, secondStation, centerStation] = await Promise.all([
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
      prisma.station.create({
        data: {
          plotId: plot.id,
          dataSourceId: adminSource.id,
          upstreamCode: 'CENTER',
          name: 'Provider Center',
        },
      }),
    ]);
    adminStationId = station.id;
    secondAdminStationId = secondStation.id;
    centerStationId = centerStation.id;
    [ownerToken, otherAdminToken, farmerToken] = await Promise.all([
      issueAccessToken({ prisma, config, userId: owner.id }),
      issueAccessToken({ prisma, config, userId: otherAdmin.id }),
      issueAccessToken({ prisma, config, userId: farmer.id }),
    ]);
    app = await createApp(config);
  });

  it('limits another Admin to source health metadata instead of counts, key preview or data', async () => {
    for (const url of ['/api/v1/data-sources', `/api/v1/data-sources/${adminSourceId}`]) {
      const response = await app.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${otherAdminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const data = response.json<{ data: DataSourceDto | { items: DataSourceDto[] } }>().data;
      const source = 'items' in data ? data.items.find((item) => item.id === adminSourceId) : data;
      expect(source).toMatchObject({
        name: 'API source',
        stationCount: null,
        visibleAccountCount: null,
        keyPreview: null,
        canReadData: false,
        canManageAccess: false,
        canRevealKey: false,
        connectionStatus: 'CONNECTED',
      });
    }
    const owned = await app.inject({
      method: 'GET',
      url: `/api/v1/data-sources/${adminSourceId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(owned.json<{ data: DataSourceDto }>().data).toMatchObject({
      stationCount: 2,
      canReadData: true,
      canManageAccess: true,
    });
  });

  it('blocks cross-owner Admin hierarchy and station data routes', async () => {
    const farms = await app.inject({
      method: 'GET',
      url: '/api/v1/farms',
      headers: { authorization: `Bearer ${otherAdminToken}` },
    });
    expect(farms.json<{ data: { items: unknown[] } }>().data.items).toEqual([]);
    for (const path of [
      `/farms/${farmId}/plots`,
      `/plots/${plotId}/stations`,
      `/stations/${adminStationId}`,
      `/stations/${adminStationId}/field-metadata`,
      `/stations/${adminStationId}/alert-rules`,
      `/stations/${adminStationId}/data/latest`,
      `/stations/${adminStationId}/data/history?fields=moisture&begin=2026-10-01T00:00:00Z&end=2026-10-02T00:00:00Z`,
    ]) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1${path}`,
        headers: { authorization: `Bearer ${otherAdminToken}` },
      });
      expect(response.statusCode, path).toBe(404);
    }
  });

  it('rechecks current Super Admin authority for read-only cross-owner oversight', async () => {
    await prisma.systemAuthority.create({
      data: { authority: 'SUPER_ADMIN', holderUserId: otherAdminId },
    });
    try {
      const detail = await app.inject({
        method: 'GET',
        url: `/api/v1/stations/${adminStationId}`,
        headers: { authorization: `Bearer ${otherAdminToken}` },
      });
      expect(detail.statusCode).toBe(200);
      const source = await app.inject({
        method: 'GET',
        url: `/api/v1/data-sources/${adminSourceId}`,
        headers: { authorization: `Bearer ${otherAdminToken}` },
      });
      expect(source.json<{ data: DataSourceDto }>().data).toMatchObject({
        stationCount: 2,
        canReadData: true,
        canManageAccess: false,
        canRevealKey: false,
      });
      const reveal = await app.inject({
        method: 'POST',
        url: `/api/v1/data-sources/${adminSourceId}/reveal`,
        headers: { authorization: `Bearer ${otherAdminToken}` },
        payload: { currentPassword: ownerPassword },
      });
      expect(reveal.statusCode).toBe(403);
    } finally {
      await prisma.systemAuthority.delete({ where: { authority: 'SUPER_ADMIN' } });
    }
    const lost = await app.inject({
      method: 'GET',
      url: `/api/v1/stations/${adminStationId}`,
      headers: { authorization: `Bearer ${otherAdminToken}` },
    });
    expect(lost.statusCode).toBe(404);
  });

  it('hides cross-owner alerts and retained notifications from an ordinary Admin', async () => {
    const rule = await prisma.alertRule.create({
      data: {
        stationId: adminStationId,
        field: 'MOISTURE',
        unit: '%',
        metadataRevision: 'soil-contract:v1:moisture',
        condition: { operator: 'BELOW', threshold: 20 },
        severity: 'WARNING',
        activeKey: `${adminStationId}:moisture`,
      },
    });
    const alert = await prisma.alert.create({
      data: {
        ruleId: rule.id,
        unresolvedRuleId: rule.id,
        status: 'OPEN',
        openedValue: 10,
        latestValue: 10,
        openedObservedAt: new Date(),
        latestObservedAt: new Date(),
      },
    });
    const event = await prisma.alertLifecycleEvent.create({
      data: { alertId: alert.id, type: 'OPENED', revision: 1, requestId: 'privacy-fixture' },
    });
    const notification = await prisma.inAppNotification.create({
      data: { lifecycleEventId: event.id, recipientUserId: otherAdminId },
    });
    const get = (path: string, token = otherAdminToken) =>
      app.inject({
        method: 'GET',
        url: `/api/v1${path}`,
        headers: { authorization: `Bearer ${token}` },
      });
    expect((await get('/alerts')).json<{ data: { items: unknown[] } }>().data.items).toEqual([]);
    expect((await get(`/alerts/${alert.id}`)).statusCode).toBe(404);
    expect((await get(`/alert-rules/${rule.id}`)).statusCode).toBe(404);
    expect(
      (await get('/notifications')).json<{ data: { items: unknown[]; unreadCount: number } }>()
        .data,
    ).toMatchObject({ items: [], unreadCount: 0 });
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${notification.id}`,
      headers: { authorization: `Bearer ${otherAdminToken}` },
      payload: { isRead: true },
    });
    expect(patch.statusCode).toBe(404);
    expect((await get(`/alerts/${alert.id}`, ownerToken)).statusCode).toBe(200);
    expect(await prisma.inAppNotification.count({ where: { id: notification.id } })).toBe(1);
    await prisma.systemAuthority.create({
      data: { authority: 'SUPER_ADMIN', holderUserId: otherAdminId },
    });
    try {
      expect((await get(`/alerts/${alert.id}`)).statusCode).toBe(200);
      expect(
        (await get('/notifications')).json<{ data: { unreadCount: number } }>().data,
      ).toMatchObject({ unreadCount: 1 });
    } finally {
      await prisma.systemAuthority.delete({ where: { authority: 'SUPER_ADMIN' } });
    }
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
    expect(ownerResponse.body).not.toContain('CENTER');

    const oversight = await app.inject({
      method: 'GET',
      url: `/api/v1/data-sources/${adminSourceId}/stations`,
      headers: { authorization: `Bearer ${otherAdminToken}` },
    });
    expect(oversight.statusCode).toBe(403);
  });

  it('lists active Farmer and Client Developer grant candidates for the source owner', async () => {
    const ownerResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/data-sources/${adminSourceId}/grant-candidates?limit=100`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(ownerResponse.statusCode).toBe(200);
    const ownerPayload = ownerResponse.json<{
      success: true;
      data: {
        items: { id: string; displayName: string; email: string; role: string }[];
        nextCursor: string | null;
      };
    }>();
    expect(ownerPayload.success).toBe(true);
    expect(ownerPayload.data.nextCursor).toBeNull();
    expect(
      ownerPayload.data.items.sort((left, right) => left.email.localeCompare(right.email)),
    ).toEqual([
      {
        id: clientId,
        displayName: 'Access Client',
        email: 'access-client@example.test',
        role: 'CLIENT_DEVELOPER',
      },
      {
        id: farmerId,
        displayName: 'Access Farmer',
        email: 'access-farmer@example.test',
        role: 'FARMER',
      },
      {
        id: candidateFarmerId,
        displayName: 'Candidate Farmer',
        email: 'candidate-farmer@example.test',
        role: 'FARMER',
      },
    ]);
    expect(ownerResponse.body).not.toContain('disabled-farmer@example.test');
    expect(ownerResponse.body).not.toContain('access-admin@example.test');

    const farmerOwnerResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/data-sources/${farmerSourceId}/grant-candidates?limit=100`,
      headers: { authorization: `Bearer ${farmerToken}` },
    });
    expect(farmerOwnerResponse.statusCode).toBe(200);
    expect(farmerOwnerResponse.body).not.toContain('access-farmer@example.test');
    expect(farmerOwnerResponse.body).toContain('candidate-farmer@example.test');
    expect(farmerOwnerResponse.body).toContain('access-client@example.test');

    const nonOwnerResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/data-sources/${farmerSourceId}/grant-candidates?limit=100`,
      headers: { authorization: `Bearer ${otherAdminToken}` },
    });
    expect(nonOwnerResponse.statusCode).toBe(403);
  });

  it('filters eligible recipients by email before pagination without widening ownership', async () => {
    type CandidatePage = { data: { items: { id: string }[]; nextCursor: string | null } };
    const get = (query: string, token = ownerToken) =>
      app.inject({
        method: 'GET',
        url: `/api/v1/data-sources/${adminSourceId}/grant-candidates?${query}`,
        headers: { authorization: `Bearer ${token}` },
      });
    const filtered = await get('email=%20CANDIDATE-FARMER%20&limit=1');
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json<CandidatePage>().data).toMatchObject({
      items: [{ id: candidateFarmerId }],
      nextCursor: null,
    });
    const first = await get('email=farmer&limit=1');
    expect(first.statusCode).toBe(200);
    const page = first.json<CandidatePage>().data;
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeTruthy();
    const second = await get(`email=farmer&limit=1&cursor=${String(page.nextCursor)}`);
    expect(second.statusCode).toBe(200);
    expect(second.json<CandidatePage>().data.items).toHaveLength(1);
    expect(second.json<CandidatePage>().data.items[0]?.id).not.toBe(page.items[0]?.id);
    expect(second.json<CandidatePage>().data.nextCursor).toBeNull();
    expect((await get('email=disabled')).json<CandidatePage>().data.items).toEqual([]);
    expect((await get('email=access-admin')).json<CandidatePage>().data.items).toEqual([]);
    expect((await get('email=candidate', otherAdminToken)).statusCode).toBe(403);
    expect((await get('email=ab')).statusCode).toBe(400);
    expect((await get(`email=${'a'.repeat(255)}`)).statusCode).toBe(400);
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
    const centerGrant = await request({
      method: 'PUT',
      url: scopedGrantUrl,
      token: ownerToken,
      payload: { stationIds: [centerStationId] },
    });
    expect(centerGrant.statusCode).toBe(404);
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
              role: 'FARMER',
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

  it('does not let Admin override a Farmer-owned source or grant an Admin account', async () => {
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
          url: `/api/v1/data-sources/${adminSourceId}/grants/${otherAdminId}/stations`,
          token: ownerToken,
          payload: { stationIds: [adminStationId] },
        })
      ).statusCode,
    ).toBe(409);
    const clientGrant = await request({
      method: 'PUT',
      url: `/api/v1/data-sources/${adminSourceId}/grants/${clientId}/stations`,
      token: ownerToken,
      payload: { stationIds: [adminStationId] },
    });
    expect(clientGrant.statusCode).toBe(200);
    const clientRevoke = await request({
      method: 'DELETE',
      url: `/api/v1/data-sources/${adminSourceId}/grants/${clientId}`,
      token: ownerToken,
    });
    expect(clientRevoke.statusCode).toBe(200);
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
