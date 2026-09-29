/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions */
import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { SourceSecretService } from '../../../src/data-sources/source-secret.service.js';
import {
  SOIL_METADATA_PROVIDER,
  type SoilMetadataProvider,
} from '../../../src/station-data/soil-metadata.provider.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const isDbAvailable = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = isDbAvailable ? describe : describe.skip;

describeDb('alert-config rules integration (PostgreSQL)', () => {
  let app: NestFastifyApplication;
  let prisma: ReturnType<typeof createTestPrismaClient>;
  let adminToken: string;
  let farmerToken: string;
  let clientToken: string;
  let farmA: { id: string };
  let farmB: { id: string };
  let stationA: { id: string; upstreamCode: string };
  let stationB: { id: string; upstreamCode: string };

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await prepareTestDatabase();
    const config = makeTestRuntimeConfig({
      alertDemoMetadataEnabled: true,
      alertDemoStationCodes: ['NODE01'],
    });

    const [admin, farmer, client] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'admin-rules@example.test',
          displayName: 'Admin Rules',
          passwordHash: 'test',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'farmer-rules@example.test',
          displayName: 'Farmer Rules',
          passwordHash: 'test',
          role: 'FARMER',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'client-rules@example.test',
          displayName: 'Client Rules',
          passwordHash: 'test',
          role: 'CLIENT_DEVELOPER',
          status: 'ACTIVE',
        },
      }),
    ]);

    farmA = await prisma.farm.create({ data: { name: 'Farm A' } });
    farmB = await prisma.farm.create({ data: { name: 'Farm B' } });
    await prisma.farmMembership.create({
      data: { farmId: farmA.id, userId: farmer.id },
    });

    const plotA = await prisma.plot.create({ data: { farmId: farmA.id, name: 'Plot A' } });
    const plotB = await prisma.plot.create({ data: { farmId: farmB.id, name: 'Plot B' } });

    stationA = await prisma.station.create({
      data: { plotId: plotA.id, upstreamCode: 'NODE01', name: 'Station A' },
    });
    stationB = await prisma.station.create({
      data: { plotId: plotB.id, upstreamCode: 'NODE02', name: 'Station B' },
    });
    const encrypted = new SourceSecretService(config).encrypt('rules-provider-secret');
    const source = await prisma.dataSource.create({
      data: {
        ownerUserId: admin.id,
        name: 'Rules soil source',
        baseUrl: 'https://soil.example.test/api/v1',
        keyCiphertext: encrypted.ciphertext,
        keyNonce: encrypted.nonce,
        keyAuthTag: encrypted.authTag,
        keyPreview: 'cret',
        connectionStatus: 'CONNECTED',
        lastCheckedAt: new Date(),
      },
    });
    await prisma.station.updateMany({
      where: { id: { in: [stationA.id, stationB.id] } },
      data: { dataSourceId: source.id },
    });
    await prisma.dataSourceGrant.create({
      data: {
        dataSourceId: source.id,
        userId: farmer.id,
        stations: {
          create: { stationId: stationA.id },
        },
      },
    });

    adminToken = await issueAccessToken({ prisma, config, userId: admin.id });
    farmerToken = await issueAccessToken({ prisma, config, userId: farmer.id });
    clientToken = await issueAccessToken({ prisma, config, userId: client.id });

    app = await createApp(config);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('allows Admin to create an alert rule on confirmed station with Idempotency-Key', async () => {
    const key = `idem-admin-${randomUUID()}`;
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': key,
      },
      payload: {
        field: 'moisture',
        unit: '%',
        expectedMetadataRevision: 'demo:v1:moisture',
        condition: { operator: 'BELOW', threshold: 25 },
        severity: 'WARNING',
        isEnabled: true,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.stationId).toBe(stationA.id);
    expect(body.data.field).toBe('moisture');
    expect(body.data.revision).toBe(1);
    expect(body.data.evaluationStatus).toBe('READY');
  });

  it('replays identical response for idempotent retry and rejects payload conflict', async () => {
    const key = `idem-replay-${randomUUID()}`;
    const payload1 = {
      field: 'temperature',
      unit: '°C',
      expectedMetadataRevision: 'demo:v1:temperature',
      condition: { operator: 'ABOVE', threshold: 40 },
      severity: 'CRITICAL',
      isEnabled: true,
    };

    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': key },
      payload: payload1,
    });
    expect(res1.statusCode).toBe(201);

    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': key },
      payload: payload1,
    });
    expect(res2.statusCode).toBe(201);
    expect(res2.json().data.id).toBe(res1.json().data.id);

    const res3 = await app.inject({
      method: 'POST',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': key },
      payload: { ...payload1, severity: 'WARNING' },
    });
    expect(res3.statusCode).toBe(409);
    expect(res3.json().error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('replays a completed create before consulting live metadata again', async () => {
    const key = `idem-metadata-replay-${randomUUID()}`;
    const payload = {
      field: 'potassium',
      unit: 'mg/kg',
      expectedMetadataRevision: 'demo:v1:potassium',
      condition: { operator: 'BELOW', threshold: 20 },
      severity: 'WARNING',
      isEnabled: false,
    };
    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': key },
      payload,
    });
    expect(first.statusCode).toBe(201);
    const metadata = app.get<SoilMetadataProvider>(SOIL_METADATA_PROVIDER);
    const metadataSpy = vi
      .spyOn(metadata, 'getFieldMetadata')
      .mockResolvedValue({ field: 'potassium', isConfirmed: false });

    const replay = await app.inject({
      method: 'POST',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': key },
      payload,
    });
    metadataSpy.mockRestore();

    expect(replay.statusCode).toBe(201);
    expect(replay.json().data.id).toBe(first.json().data.id);
  });

  it('lets a station grantee read rules but not mutate them or read another source station', async () => {
    const farmerRes = await app.inject({
      method: 'GET',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: { authorization: `Bearer ${farmerToken}` },
    });
    expect(farmerRes.statusCode).toBe(200);
    expect(farmerRes.json().success).toBe(true);

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: {
        authorization: `Bearer ${farmerToken}`,
        'idempotency-key': `idem-grantee-${randomUUID()}`,
      },
      payload: {
        field: 'phosphorus',
        unit: 'mg/kg',
        expectedMetadataRevision: 'demo:v1:phosphorus',
        condition: { operator: 'BELOW', threshold: 10 },
        severity: 'WARNING',
        isEnabled: true,
      },
    });
    expect(createRes.statusCode).toBe(403);
    expect(createRes.json().error.code).toBe('FORBIDDEN');

    const crossScopeRes = await app.inject({
      method: 'GET',
      url: `/api/v1/stations/${stationB.id}/alert-rules`,
      headers: { authorization: `Bearer ${farmerToken}` },
    });
    expect(crossScopeRes.statusCode).toBe(404);
    expect(crossScopeRes.json().error.code).toBe('NOT_FOUND');
  });

  it('returns only confirmed field metadata within the caller station scope', async () => {
    const shared = await app.inject({
      method: 'GET',
      url: `/api/v1/stations/${stationA.id}/field-metadata`,
      headers: { authorization: `Bearer ${farmerToken}` },
    });
    expect(shared.statusCode).toBe(200);
    expect(shared.json().data.fields).toContainEqual({
      field: 'moisture',
      unit: '%',
      metadataRevision: 'demo:v1:moisture',
    });

    const unshared = await app.inject({
      method: 'GET',
      url: `/api/v1/stations/${stationB.id}/field-metadata`,
      headers: { authorization: `Bearer ${farmerToken}` },
    });
    expect(unshared.statusCode).toBe(404);

    const unconfirmed = await app.inject({
      method: 'GET',
      url: `/api/v1/stations/${stationB.id}/field-metadata`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(unconfirmed.statusCode).toBe(200);
    expect(unconfirmed.json().data.fields).toEqual([]);
  });

  it('returns 403 FORBIDDEN for Client Developer role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('rejects invalid body with 400 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': `idem-invalid-${randomUUID()}`,
      },
      payload: {
        field: 'moisture',
        condition: { operator: 'OUTSIDE_RANGE', lowerThreshold: 50, upperThreshold: 20 },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unconfirmed metadata and unit/revision mismatch with 409', async () => {
    const unconfirmedRes = await app.inject({
      method: 'POST',
      url: `/api/v1/stations/${stationB.id}/alert-rules`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': `idem-unconfirmed-${randomUUID()}`,
      },
      payload: {
        field: 'moisture',
        unit: '%',
        expectedMetadataRevision: 'demo:v1:moisture',
        condition: { operator: 'BELOW', threshold: 10 },
        severity: 'WARNING',
        isEnabled: true,
      },
    });
    expect(unconfirmedRes.statusCode).toBe(409);
    expect(unconfirmedRes.json().error.code).toBe('FIELD_METADATA_UNCONFIRMED');

    const mismatchRes = await app.inject({
      method: 'POST',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': `idem-mismatch-${randomUUID()}`,
      },
      payload: {
        field: 'moisture',
        unit: 'ppm',
        expectedMetadataRevision: 'demo:v1:moisture',
        condition: { operator: 'BELOW', threshold: 10 },
        severity: 'WARNING',
        isEnabled: true,
      },
    });
    expect(mismatchRes.statusCode).toBe(409);
    expect(mismatchRes.json().error.code).toBe('FIELD_METADATA_CHANGED');
  });

  it('rejects second active rule on same station and field with 409 ACTIVE_RULE_EXISTS', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': `idem-dup-${randomUUID()}`,
      },
      payload: {
        field: 'moisture',
        unit: '%',
        expectedMetadataRevision: 'demo:v1:moisture',
        condition: { operator: 'ABOVE', threshold: 90 },
        severity: 'WARNING',
        isEnabled: true,
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('ACTIVE_RULE_EXISTS');
  });

  it('enforces optimistic concurrency VERSION_CONFLICT on PATCH', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const rule = listRes.json().data.items[0];

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/alert-rules/${rule.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        severity: 'CRITICAL',
        expectedRevision: 999,
      },
    });
    expect(patchRes.statusCode).toBe(409);
    expect(patchRes.json().error.code).toBe('VERSION_CONFLICT');
  });

  it('replays concurrent create retries without duplicate rules', async () => {
    const key = `idem-race-${randomUUID()}`;
    const request = () =>
      app.inject({
        method: 'POST',
        url: `/api/v1/stations/${stationA.id}/alert-rules`,
        headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': key },
        payload: {
          field: 'ec',
          unit: 'µS/cm',
          expectedMetadataRevision: 'demo:v1:ec',
          condition: { operator: 'ABOVE', threshold: 1000 },
          severity: 'WARNING',
          isEnabled: false,
        },
      });
    const responses = await Promise.all([request(), request()]);
    expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
    expect(responses[0].json().data.id).toBe(responses[1].json().data.id);
  });

  it('allows only one concurrent PATCH for the same expected revision', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': `idem-patch-race-${randomUUID()}`,
      },
      payload: {
        field: 'ph',
        unit: 'pH',
        expectedMetadataRevision: 'demo:v1:ph',
        condition: { operator: 'BELOW', threshold: 5 },
        severity: 'WARNING',
        isEnabled: false,
      },
    });
    const id = created.json().data.id;
    const patch = (severity: 'WARNING' | 'CRITICAL') =>
      app.inject({
        method: 'PATCH',
        url: `/api/v1/alert-rules/${id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { severity, expectedRevision: 1 },
      });
    const responses = await Promise.all([patch('CRITICAL'), patch('WARNING')]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
  });
});
