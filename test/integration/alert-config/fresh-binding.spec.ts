import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AlertEvaluationService } from '../../../src/alert-config/alert-evaluation.service.js';
import type { PrismaService } from '../../../src/database/prisma.service.js';
import type { LatestSoilDataDto } from '../../../src/station-data/station-data.contracts.js';
import { CanonicalSoilMetadataProvider } from '../../../src/station-data/soil-metadata.provider.js';
import type { StationDataService } from '../../../src/station-data/station-data.service.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

describe('automatic alert freshness and checked rule binding', () => {
  const prisma = createTestPrismaClient();
  const getLatest = vi.fn<StationDataService['getLatest']>();
  const config = makeTestRuntimeConfig();
  let ruleId: string;
  let stationId: string;
  let time = Date.parse('2026-10-05T00:00:00Z');
  const evaluator = () =>
    new AlertEvaluationService(
      prisma as PrismaService,
      { getLatest } as unknown as StationDataService,
      config,
      new CanonicalSoilMetadataProvider(),
    );
  const latest = (origin: 'upstream' | 'stored' = 'upstream', value = 10): LatestSoilDataDto => ({
    station: { id: stationId, code: 'FRESH01', name: 'Fresh binding' },
    measurement: 'soil',
    dataOrigin: origin,
    isStale: false,
    isFromCache: false,
    fetchedAt: new Date(time).toISOString(),
    fields: [
      {
        field: 'moisture',
        value,
        observedAt: new Date(time).toISOString(),
        quality: 'good',
        unit: '%',
        sensorId: null,
        depthCm: null,
      },
    ],
  });
  const run = async (instance = evaluator()) => {
    await prisma.evaluatorLease.deleteMany();
    return instance.runOnce(new Date(time));
  };

  beforeAll(prepareTestDatabase);
  beforeEach(async () => {
    getLatest.mockReset();
    time = Date.parse('2026-10-05T00:00:00Z');
    const farm = await prisma.farm.create({
      data: { name: `Freshness regression ${randomUUID()}` },
    });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Plot' } });
    const station = await prisma.station.create({
      data: { plotId: plot.id, name: 'Fresh binding', upstreamCode: `FRESH-${farm.id}` },
    });
    stationId = station.id;
    const rule = await prisma.alertRule.create({
      data: {
        stationId,
        field: 'MOISTURE',
        unit: '%',
        metadataRevision: 'soil-contract:v1:moisture',
        condition: { operator: 'BELOW', threshold: 20 },
        severity: 'WARNING',
        activeKey: `${stationId}:moisture`,
        evaluationState: { create: {} },
      },
    });
    ruleId = rule.id;
    // Older rules remain disabled so each scheduler run targets exactly this binding.
    await prisma.alertRule.updateMany({
      where: { id: { not: ruleId } },
      data: { isEnabled: false, activeKey: null },
    });
  });
  afterAll(() => prisma.$disconnect());

  it('does not advance breach or recovery counters from stored readings even when marked recent', async () => {
    getLatest.mockResolvedValue(latest());
    await run();
    time += 120_000;
    getLatest.mockResolvedValue(latest('stored'));
    await run();
    expect(
      await prisma.alertEvaluationState.findUniqueOrThrow({ where: { ruleId } }),
    ).toMatchObject({
      consecutiveBreachCount: 1,
      lastObservedAt: new Date('2026-10-05T00:00:00Z'),
    });
    expect(await prisma.alert.count({ where: { ruleId } })).toBe(0);

    time += 120_000;
    getLatest.mockResolvedValue(latest());
    await run();
    expect(await prisma.alert.count({ where: { ruleId, status: 'OPEN' } })).toBe(1);
    time += 120_000;
    getLatest.mockResolvedValue(latest('stored', 30));
    await run();
    expect(
      await prisma.alertEvaluationState.findUniqueOrThrow({ where: { ruleId } }),
    ).toMatchObject({ consecutiveRecoveryCount: 0 });
    expect(await prisma.alert.count({ where: { ruleId, status: 'OPEN' } })).toBe(1);
  });

  it.each([
    { name: 'rule revision', change: { revision: { increment: 1 } } },
    { name: 'unit', change: { unit: 'fraction' } },
    { name: 'metadata revision', change: { metadataRevision: 'soil-contract:v2:moisture' } },
    { name: 'blocked status', change: { evaluationStatus: 'BLOCKED_METADATA' as const } },
  ])('rejects a fetched sample if $name changes after metadata was checked', async ({ change }) => {
    getLatest.mockImplementationOnce(async () => {
      await prisma.alertRule.update({ where: { id: ruleId }, data: change });
      return latest();
    });
    await run();
    expect(
      await prisma.alertEvaluationState.findUniqueOrThrow({ where: { ruleId } }),
    ).toMatchObject({ lastObservedAt: null, consecutiveBreachCount: 0 });
    expect(await prisma.alert.count({ where: { ruleId } })).toBe(0);
  });

  it('deduplicates same-timestamp corrections across evaluator restarts and emits recovery once', async () => {
    getLatest.mockResolvedValue(latest());
    await run();
    // A correction at the same observed time is not a second observation.
    getLatest.mockResolvedValue(latest('upstream', 9));
    await run();
    expect(await prisma.alert.count({ where: { ruleId } })).toBe(0);
    time += 120_000;
    getLatest.mockResolvedValue(latest());
    await run();
    await run();
    expect(await prisma.alert.count({ where: { ruleId } })).toBe(1);
    time += 120_000;
    getLatest.mockResolvedValue(latest('upstream', 30));
    await run();
    time += 120_000;
    getLatest.mockResolvedValue(latest('upstream', 30));
    await run();
    await run();
    const alerts = await prisma.alert.findMany({ where: { ruleId }, include: { events: true } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ status: 'RESOLVED', resolutionReason: 'RECOVERED' });
    expect(alerts[0]?.events.map((event) => event.type).sort()).toEqual(['OPENED', 'RESOLVED']);
  });
});
