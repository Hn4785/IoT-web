import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
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

    const config = makeTestRuntimeConfig({
      alertDemoMetadataEnabled: true,
      alertDemoStationCodes: ['NODE01'],
    });

    adminToken = await issueAccessToken({ prisma, config, userId: admin.id });
    farmerToken = await issueAccessToken({ prisma, config, userId: farmer.id });
    clientToken = await issueAccessToken({ prisma, config, userId: client.id });

    app = await createApp(config);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
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

  it('allows Farmer to manage rules in own farm scope but returns 404 for cross-scope station', async () => {
    const farmerRes = await app.inject({
      method: 'GET',
      url: `/api/v1/stations/${stationA.id}/alert-rules`,
      headers: { authorization: `Bearer ${farmerToken}` },
    });
    expect(farmerRes.statusCode).toBe(200);
    expect(farmerRes.json().success).toBe(true);

    const crossScopeRes = await app.inject({
      method: 'GET',
      url: `/api/v1/stations/${stationB.id}/alert-rules`,
      headers: { authorization: `Bearer ${farmerToken}` },
    });
    expect(crossScopeRes.statusCode).toBe(404);
    expect(crossScopeRes.json().error.code).toBe('NOT_FOUND');
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
});
