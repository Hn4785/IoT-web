import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AlertEvaluationService } from '../../../src/alert-config/alert-evaluation.service.js';
import { createApp } from '../../../src/app/create-app.js';
import { RUNTIME_CONFIG } from '../../../src/config/runtime-config.module.js';
import type { RuntimeConfig } from '../../../src/config/runtime-config.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { StationDataService } from '../../../src/station-data/station-data.service.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDb('Checkpoint C1 lifecycle gate', () => {
  let app: NestFastifyApplication;
  let prisma: ReturnType<typeof createTestPrismaClient>;
  let evaluator: AlertEvaluationService;
  let ruleId: string;
  let token: string;
  let alertId: string;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await prepareTestDatabase();
    const user = await prisma.user.create({
      data: {
        email: 'checkpoint-c1@example.test',
        displayName: 'Checkpoint Admin',
        passwordHash: 'test',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    const farm = await prisma.farm.create({ data: { name: 'C1 Farm' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'C1 Plot' } });
    const station = await prisma.station.create({
      data: { plotId: plot.id, upstreamCode: 'NODE01', name: 'C1 Station' },
    });
    const rule = await prisma.alertRule.create({
      data: {
        stationId: station.id,
        field: 'MOISTURE',
        unit: '%',
        metadataRevision: 'demo:v1:moisture',
        condition: { operator: 'BELOW', threshold: 20 },
        severity: 'WARNING',
        activeKey: `${station.id}:moisture`,
        evaluationState: { create: {} },
      },
    });
    ruleId = rule.id;
    const config = makeTestRuntimeConfig({
      alertDemoMetadataEnabled: true,
      alertDemoStationCodes: ['NODE01'],
    });
    token = await issueAccessToken({ prisma, config, userId: user.id });
    app = await createApp(config);
    evaluator = app.get(AlertEvaluationService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('allows only one evaluator lease holder', async () => {
    const config = app.get<RuntimeConfig>(RUNTIME_CONFIG);
    const contender = new AlertEvaluationService(
      app.get(PrismaService),
      app.get(StationDataService),
      config,
    );
    const now = new Date('2026-09-16T00:00:00Z');
    expect((await evaluator.runOnce(now)).acquired).toBe(true);
    expect((await contender.runOnce(now)).acquired).toBe(false);
  });

  it('deduplicates observations and opens exactly one alert after two breaches', async () => {
    const first = { observedAt: new Date('2026-09-16T01:00:00Z'), value: 10, usable: true };
    await evaluator.evaluateRule(ruleId, first, 'c1-first');
    await evaluator.evaluateRule(ruleId, first, 'c1-duplicate');
    expect(await prisma.alert.count({ where: { ruleId } })).toBe(0);

    await evaluator.evaluateRule(
      ruleId,
      { observedAt: new Date('2026-09-16T01:01:00Z'), value: 11, usable: true },
      'c1-second',
    );
    const alerts = await prisma.alert.findMany({ where: { ruleId } });
    expect(alerts).toHaveLength(1);
    const opened = alerts[0];
    if (!opened) throw new Error('Expected one opened alert');
    expect(opened.status).toBe('OPEN');
    alertId = opened.id;

    await evaluator.evaluateRule(
      ruleId,
      { observedAt: new Date('2026-09-16T01:01:00Z'), value: 11, usable: true },
      'c1-second-retry',
    );
    expect(await prisma.alert.count({ where: { ruleId, unresolvedRuleId: ruleId } })).toBe(1);
  });

  it('keeps acknowledge retry-safe and rejects manual resolution while breached', async () => {
    const key = randomUUID();
    const request = () =>
      app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/acknowledgements`,
        headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
        payload: { note: 'Checked' },
      });
    expect((await request()).statusCode).toBe(201);
    expect((await request()).statusCode).toBe(201);
    expect(
      await prisma.alertLifecycleEvent.count({ where: { alertId, type: 'ACKNOWLEDGED' } }),
    ).toBe(1);

    const blocked = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/${alertId}/resolutions`,
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() },
      payload: {},
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json<{ error: { code: string } }>().error.code).toBe('ALERT_STILL_ACTIVE');
  });

  it('allows retry-safe manual resolution after the latest distinct sample is normal', async () => {
    await evaluator.evaluateRule(
      ruleId,
      { observedAt: new Date('2026-09-16T01:02:00Z'), value: 25, usable: true },
      'c1-normal',
    );
    const key = randomUUID();
    const resolve = () =>
      app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/resolutions`,
        headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
        payload: { note: 'Verified normal' },
      });
    expect((await resolve()).statusCode).toBe(201);
    expect((await resolve()).statusCode).toBe(201);
    expect(await prisma.alertLifecycleEvent.count({ where: { alertId, type: 'RESOLVED' } })).toBe(
      1,
    );
    expect((await prisma.alert.findUniqueOrThrow({ where: { id: alertId } })).status).toBe(
      'RESOLVED',
    );
  });
});
