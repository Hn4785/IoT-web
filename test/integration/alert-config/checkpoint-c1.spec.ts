import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AlertEvaluationService } from '../../../src/alert-config/alert-evaluation.service.js';
import { createApp } from '../../../src/app/create-app.js';
import { RUNTIME_CONFIG } from '../../../src/config/runtime-config.module.js';
import type { RuntimeConfig } from '../../../src/config/runtime-config.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import {
  SOIL_METADATA_PROVIDER,
  type SoilMetadataProvider,
} from '../../../src/station-data/soil-metadata.provider.js';
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
      app.get<SoilMetadataProvider>(SOIL_METADATA_PROVIDER),
    );
    const now = new Date('2026-09-16T00:00:00Z');
    expect((await evaluator.runOnce(now)).acquired).toBe(true);
    expect((await contender.runOnce(now)).acquired).toBe(false);
  });

  it('rejects an overlapping run from the same evaluator instance', async () => {
    await prisma.evaluatorLease.deleteMany();
    let releaseFirst!: () => void;
    let signalStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const getLatest = vi
      .fn()
      .mockImplementationOnce(async () => {
        signalStarted();
        await firstBlocked;
        throw new Error('test release');
      })
      .mockRejectedValue(new Error('unexpected overlapping fetch'));
    const stationData = { getLatest } as unknown as StationDataService;
    const instance = new AlertEvaluationService(
      app.get(PrismaService),
      stationData,
      app.get<RuntimeConfig>(RUNTIME_CONFIG),
      app.get<SoilMetadataProvider>(SOIL_METADATA_PROVIDER),
    );

    const first = instance.runOnce(new Date('2026-09-16T00:10:00Z'));
    await firstStarted;
    const overlapping = await instance.runOnce(new Date('2026-09-16T00:10:01Z'));
    releaseFirst();
    await first;

    expect(overlapping).toEqual({ acquired: false, evaluated: 0 });
    expect(getLatest).toHaveBeenCalledTimes(1);
  });

  it('loads latest data once for all rules on the same station', async () => {
    await prisma.evaluatorLease.deleteMany();
    const original = await prisma.alertRule.findUniqueOrThrow({ where: { id: ruleId } });
    const secondRule = await prisma.alertRule.create({
      data: {
        stationId: original.stationId,
        field: 'PH',
        unit: 'pH',
        metadataRevision: 'demo:v1:ph',
        condition: { operator: 'ABOVE', threshold: 8 },
        severity: 'WARNING',
        activeKey: `${original.stationId}:ph`,
        evaluationState: { create: {} },
      },
    });
    const getLatest = vi.fn().mockResolvedValue({
      isStale: false,
      fields: [
        { field: 'moisture', value: 50, quality: 'good', observedAt: '2026-09-16T00:20:00Z' },
        { field: 'ph', value: 7, quality: 'good', observedAt: '2026-09-16T00:20:00Z' },
      ],
    });
    const stationData = { getLatest } as unknown as StationDataService;
    const metadata = {
      getFieldMetadata: vi.fn((_station: string, field: 'moisture' | 'ph') =>
        Promise.resolve({
          field,
          isConfirmed: true as const,
          unit: field === 'ph' ? 'pH' : '%',
          revision: `demo:v1:${field}`,
        }),
      ),
    } as unknown as SoilMetadataProvider;
    const instance = new AlertEvaluationService(
      app.get(PrismaService),
      stationData,
      app.get<RuntimeConfig>(RUNTIME_CONFIG),
      metadata,
    );

    await instance.runOnce(new Date('2026-09-16T00:20:00Z'));

    expect(getLatest).toHaveBeenCalledTimes(1);
    expect(getLatest).toHaveBeenCalledWith(expect.any(Object), {
      fields: ['moisture', 'ph'],
    });
    await prisma.alertEvaluationState.update({
      where: { ruleId },
      data: {
        lastObservedAt: null,
        lastValue: null,
        lastEvaluatedAt: null,
        lastResult: null,
        consecutiveBreachCount: 0,
        consecutiveRecoveryCount: 0,
      },
    });
    await prisma.alertRule.delete({ where: { id: secondRule.id } });
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
    const firstKey = randomUUID();
    const request = (key: string) =>
      app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/acknowledgements`,
        headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
        payload: { note: 'Checked' },
      });
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_delay_alert_update() RETURNS trigger AS $$
      BEGIN
        PERFORM pg_sleep(0.2);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER test_delay_alert_update_trigger
      BEFORE UPDATE ON "Alert"
      FOR EACH ROW WHEN (OLD."status" = 'OPEN')
      EXECUTE FUNCTION test_delay_alert_update();
    `);
    const concurrent = await Promise.all([request(firstKey), request(randomUUID())]);
    await prisma.$executeRawUnsafe(`
      DROP TRIGGER test_delay_alert_update_trigger ON "Alert";
      DROP FUNCTION test_delay_alert_update();
    `);
    expect(concurrent.map((response) => response.statusCode)).toEqual([201, 201]);
    expect((await request(firstKey)).statusCode).toBe(201);
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

  it('blocks a rule and resolves its active alert when metadata changes', async () => {
    await prisma.evaluatorLease.deleteMany();
    await prisma.alertRule.update({
      where: { id: ruleId },
      data: { isEnabled: true, evaluationStatus: 'READY' },
    });
    const active = await prisma.alert.create({
      data: {
        ruleId,
        unresolvedRuleId: ruleId,
        status: 'OPEN',
        openedValue: 10,
        openedObservedAt: new Date('2026-09-16T02:00:00Z'),
        latestValue: 10,
        latestObservedAt: new Date('2026-09-16T02:00:00Z'),
      },
    });
    const metadata = app.get<SoilMetadataProvider>(SOIL_METADATA_PROVIDER);
    const metadataSpy = vi.spyOn(metadata, 'getFieldMetadata').mockResolvedValue({
      field: 'moisture',
      isConfirmed: true,
      unit: 'fraction',
      revision: 'hardware:v2:moisture',
    });

    await evaluator.runOnce();

    expect(
      (await prisma.alertRule.findUniqueOrThrow({ where: { id: ruleId } })).evaluationStatus,
    ).toBe('BLOCKED_METADATA');
    const resolved = await prisma.alert.findUniqueOrThrow({ where: { id: active.id } });
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolutionReason).toBe('METADATA_CHANGED');
    expect(
      await prisma.alertLifecycleEvent.count({ where: { alertId: active.id, type: 'RESOLVED' } }),
    ).toBe(1);
    metadataSpy.mockRestore();
  });

  it('does not block a rule rebound while an obsolete metadata check is in flight', async () => {
    await prisma.evaluatorLease.deleteMany();
    const reboundRevision = 'hardware:v3:moisture';
    const before = await prisma.alertRule.update({
      where: { id: ruleId },
      data: {
        unit: '%',
        metadataRevision: 'demo:v1:moisture',
        isEnabled: true,
        evaluationStatus: 'READY',
        revision: { increment: 1 },
      },
    });
    let release!: () => void;
    let started!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const metadataStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const metadata = {
      getFieldMetadata: vi.fn(async () => {
        started();
        await released;
        return {
          field: 'moisture' as const,
          isConfirmed: true as const,
          unit: 'fraction',
          revision: reboundRevision,
        };
      }),
    } as unknown as SoilMetadataProvider;
    const instance = new AlertEvaluationService(
      app.get(PrismaService),
      { getLatest: vi.fn() } as unknown as StationDataService,
      app.get<RuntimeConfig>(RUNTIME_CONFIG),
      metadata,
    );

    const run = instance.runOnce(new Date('2026-09-16T03:00:00Z'));
    await metadataStarted;
    await prisma.alertRule.update({
      where: { id: ruleId },
      data: {
        unit: 'fraction',
        metadataRevision: reboundRevision,
        evaluationStatus: 'READY',
        revision: { increment: 1 },
      },
    });
    release();
    await run;

    const rebound = await prisma.alertRule.findUniqueOrThrow({ where: { id: ruleId } });
    expect(rebound.revision).toBe(before.revision + 1);
    expect(rebound.evaluationStatus).toBe('READY');
    expect(rebound.unit).toBe('fraction');
    expect(rebound.metadataRevision).toBe(reboundRevision);
  });

  it('advances the round-robin cursor when the lease budget expires mid-batch', async () => {
    await prisma.evaluatorLease.deleteMany();
    await prisma.alertRule.update({
      where: { id: ruleId },
      data: {
        unit: '%',
        metadataRevision: 'demo:v1:moisture',
        isEnabled: true,
        evaluationStatus: 'READY',
        revision: { increment: 1 },
      },
    });
    const rules = await prisma.alertRule.findMany({
      where: { isEnabled: true, evaluationStatus: 'READY' },
      orderBy: { id: 'asc' },
      take: app.get<RuntimeConfig>(RUNTIME_CONFIG).alertEvaluationBatchSize,
      select: { id: true },
    });
    const expectedCursor = rules.at(-1)?.id;
    expect(expectedCursor).toBeDefined();
    let expired = false;
    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockImplementation(() => (expired ? Number.MAX_SAFE_INTEGER : 0));
    const metadata = {
      getFieldMetadata: vi.fn((_station: string, field: 'moisture' | 'ph') =>
        Promise.resolve({
          field,
          isConfirmed: true as const,
          unit: field === 'ph' ? 'pH' : '%',
          revision: `demo:v1:${field}`,
        }),
      ),
    } as unknown as SoilMetadataProvider;
    const stationData = {
      getLatest: vi.fn(() => {
        expired = true;
        return Promise.resolve({ isStale: false, fields: [] });
      }),
    } as unknown as StationDataService;
    const instance = new AlertEvaluationService(
      app.get(PrismaService),
      stationData,
      app.get<RuntimeConfig>(RUNTIME_CONFIG),
      metadata,
    );

    try {
      await instance.runOnce();
      const lease = await prisma.evaluatorLease.findUniqueOrThrow({
        where: { name: 'alert-evaluator' },
      });
      expect(lease.continuationId).toBe(expectedCursor);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('paginates alerts with filter-bound cursors and complete station DTOs', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/api/v1/alerts?severity=WARNING&limit=1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(first.statusCode).toBe(200);
    const firstPage = first.json<{
      data: {
        items: Array<{ id: string; station: { code: string }; unit: string }>;
        nextCursor: string | null;
      };
    }>().data;
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0]?.station.code).toBe('NODE01');
    expect(firstPage.items[0]?.unit).toBe('%');
    expect(firstPage.nextCursor).not.toBeNull();

    const second = await app.inject({
      method: 'GET',
      url: `/api/v1/alerts?severity=WARNING&limit=1&cursor=${encodeURIComponent(firstPage.nextCursor ?? '')}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(second.statusCode).toBe(200);
    const secondPage = second.json<{ data: { items: Array<{ id: string }> } }>().data;
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id);

    const mismatched = await app.inject({
      method: 'GET',
      url: `/api/v1/alerts?severity=CRITICAL&cursor=${encodeURIComponent(firstPage.nextCursor ?? '')}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(mismatched.statusCode).toBe(400);
  });
});
