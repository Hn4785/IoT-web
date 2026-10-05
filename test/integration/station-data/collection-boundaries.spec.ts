import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../src/common/errors/app-error.js';
import { OperationsMetrics } from '../../../src/operations/operations-signals.js';
import type { PrismaService } from '../../../src/database/prisma.service.js';
import type { WeatherClientService } from '../../../src/integrations/weather/weather-client.service.js';
import {
  parseWeatherHistoryResponse,
  parseWeatherLatestResponse,
} from '../../../src/integrations/weather/contracts.js';
import { SoilReadingRepository } from '../../../src/station-data/soil-reading.repository.js';
import { SoilCollectionService } from '../../../src/station-data/soil-collection.service.js';
import type { StationSourceClientResolver } from '../../../src/station-data/station-source-client.resolver.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

describe('collection safety and fairness', () => {
  const prisma = createTestPrismaClient();
  const now = new Date();
  const config = makeTestRuntimeConfig();
  let metrics = new OperationsMetrics();
  const readings = new SoilReadingRepository(prisma as PrismaService, config);
  const latest = (station: string) =>
    parseWeatherLatestResponse({
      success: true,
      data: [
        {
          station,
          latest: {
            soil: {
              ts: now.getTime(),
              time: now.toISOString(),
              _fieldTs: { moisture: now.getTime() },
              moisture: 44,
            },
          },
        },
      ],
    }).data;
  const getLatest = vi.fn<WeatherClientService['getLatest']>((q) =>
    Promise.resolve(latest(q.station?.[0] ?? '')),
  );
  const getHistory = vi.fn<WeatherClientService['getHistory']>((q) =>
    Promise.resolve(
      parseWeatherHistoryResponse({
        success: true,
        data: [{ station: q.station?.[0] ?? '', history: { soil: [] } }],
      }).data,
    ),
  );
  const sources = {
    resolve: () => Promise.resolve({ getLatest, getHistory }),
    markConnected: () => Promise.resolve(),
  } as unknown as StationSourceClientResolver;
  const collector = () =>
    new SoilCollectionService(prisma as PrismaService, readings, sources, config, metrics);
  const add = async (count: number) => {
    const farm = await prisma.farm.create({ data: { name: 'Fairness' } });
    const plot = await prisma.plot.create({ data: { name: 'Plot', farmId: farm.id } });
    for (let i = 0; i < count; i++)
      await prisma.station.create({
        data: { plotId: plot.id, name: `Node${String(i)}`, upstreamCode: `SAFE${String(i)}` },
      });
  };
  const pendingLatest = () => {
    let resolve = () => {};
    let ready = () => {};
    const started = new Promise<void>((r) => {
      ready = r;
    });
    const gate = new Promise<void>((r) => {
      resolve = r;
    });
    getLatest.mockImplementation(async (q) => {
      ready();
      await gate;
      return latest(q.station?.[0] ?? '');
    });
    return {
      started,
      release: () => {
        resolve();
      },
    };
  };
  beforeEach(async () => {
    vi.restoreAllMocks();
    metrics = new OperationsMetrics();
    await prepareTestDatabase();
    getLatest.mockReset().mockImplementation((q) => Promise.resolve(latest(q.station?.[0] ?? '')));
    getHistory.mockReset().mockImplementation((q) =>
      Promise.resolve(
        parseWeatherHistoryResponse({
          success: true,
          data: [{ station: q.station?.[0] ?? '', history: { soil: [] } }],
        }).data,
      ),
    );
  });
  afterAll(() => prisma.$disconnect());

  it('bounds concurrent requests to two and gives stations beyond a 20-station batch a turn', async () => {
    await add(25);
    let active = 0;
    let maximum = 0;
    getLatest.mockImplementation(async (q) => {
      maximum = Math.max(maximum, ++active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      return latest(q.station?.[0] ?? '');
    });
    expect(await collector().runOnce(now)).toEqual({ acquired: true, processed: 20 });
    expect(maximum).toBe(2);
    expect(await prisma.soilCollectionCheckpoint.count()).toBe(20);
    await collector().runOnce(new Date(now.getTime() + 120_000));
    expect(new Set(getLatest.mock.calls.map(([q]) => q.station?.[0])).size).toBe(25);
  });

  it('retains increasing history backoff despite a successful latest fetch', async () => {
    await add(1);
    getHistory.mockRejectedValue(new AppError('RATE_LIMITED', 429, 'Try later'));
    await collector().runOnce(now);
    expect(await prisma.soilCollectionCheckpoint.findFirst()).toMatchObject({
      failureCount: 1,
      lastResult: 'upstream_error',
      historyThrough: null,
      nextAttemptAt: new Date(now.getTime() + 120_000),
    });
    await collector().runOnce(new Date(now.getTime() + 120_000));
    expect(await prisma.soilCollectionCheckpoint.findFirst()).toMatchObject({
      failureCount: 2,
      nextAttemptAt: new Date(now.getTime() + 360_000),
    });
    expect(await prisma.soilLatestReading.count()).toBe(1);
  });

  it.each(['history', 'checkpoint'] as const)(
    'does not mark a failed source connected when the %s database write fails',
    async (failure) => {
      await add(1);
      const owner = await prisma.user.create({
        data: {
          email: 'failed-collection@example.test',
          displayName: 'Owner',
          passwordHash: 'fixture',
          role: 'FARMER',
        },
      });
      const source = await prisma.dataSource.create({
        data: {
          ownerUserId: owner.id,
          name: 'Failed source',
          baseUrl: 'https://example.invalid',
          keyCiphertext: 'fixture',
          keyNonce: 'fixture',
          keyAuthTag: 'fixture',
          keyPreview: 'test',
          connectionStatus: 'FAILED',
          lastCheckedAt: now,
        },
      });
      await prisma.station.updateMany({ data: { dataSourceId: source.id } });
      const markConnected = vi.fn(async () => {
        await prisma.dataSource.update({
          where: { id: source.id },
          data: { connectionStatus: 'CONNECTED' },
        });
      });
      if (failure === 'history')
        vi.spyOn(readings, 'ingestHistory').mockRejectedValueOnce(
          new Error('Database unavailable'),
        );
      else
        vi.spyOn(readings, 'updateCollectionCheckpoint').mockRejectedValueOnce(
          new Error('Database unavailable'),
        );
      await new SoilCollectionService(
        prisma as PrismaService,
        readings,
        {
          resolve: sources.resolve.bind(sources),
          markConnected,
        } as unknown as StationSourceClientResolver,
        config,
        metrics,
      ).runOnce(now);
      expect(markConnected).not.toHaveBeenCalled();
      expect(await prisma.dataSource.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject(
        { connectionStatus: 'FAILED', lastCheckedAt: now },
      );
      expect(metrics.snapshot()).toContainEqual({
        name: 'soil_collection_runs_total',
        labels: { outcome: 'database_error' },
        value: 1,
      });
    },
  );

  it('rejects a source removed while its response was in flight', async () => {
    await add(1);
    const owner = await prisma.user.create({
      data: {
        email: 'collection-owner@example.invalid',
        displayName: 'Owner',
        role: 'FARMER',
        status: 'ACTIVE',
        passwordHash: 'not-a-real-hash',
      },
    });
    const source = await prisma.dataSource.create({
      data: {
        ownerUserId: owner.id,
        kind: 'MANAGED',
        name: 'Managed',
        baseUrl: 'https://example.invalid',
        keyCiphertext: 'fixture',
        keyNonce: 'fixture',
        keyAuthTag: 'fixture',
        keyPreview: 'test',
        connectionStatus: 'CONNECTED',
        lastCheckedAt: now,
      },
    });
    await prisma.station.updateMany({ data: { dataSourceId: source.id } });
    const pending = pendingLatest();
    const run = collector().runOnce(now);
    await pending.started;
    await prisma.dataSource.update({
      where: { id: source.id },
      data: {
        removedAt: new Date(),
        keyCiphertext: null,
        keyNonce: null,
        keyAuthTag: null,
        keyPreview: null,
      },
    });
    pending.release();
    await run;
    expect(await prisma.soilReading.count()).toBe(0);
    expect(await prisma.soilCollectionCheckpoint.count()).toBe(0);
    expect(getHistory).not.toHaveBeenCalled();
  });

  it('fences an older response after a new lease generation replaces it', async () => {
    await add(1);
    const pending = pendingLatest();
    const run = collector().runOnce(now);
    await pending.started;
    await prisma.evaluatorLease.update({
      where: { name: 'soil-collector' },
      data: { holderId: 'replacement-generation', expiresAt: new Date(Date.now() + 60_000) },
    });
    pending.release();
    await run;
    expect(await prisma.soilLatestReading.count()).toBe(0);
    expect(await prisma.soilCollectionCheckpoint.count()).toBe(0);
    expect(
      await prisma.evaluatorLease.findUnique({ where: { name: 'soil-collector' } }),
    ).toMatchObject({ holderId: 'replacement-generation' });
  });

  it('prevents commits from a response arriving during shutdown', async () => {
    await add(1);
    const pending = pendingLatest();
    const service = collector();
    const run = service.runOnce(now);
    await pending.started;
    const stopped = service.onModuleDestroy();
    pending.release();
    await Promise.all([run, stopped]);
    expect(await prisma.soilReading.count()).toBe(0);
    expect(await prisma.soilCollectionCheckpoint.count()).toBe(0);
    expect(await service.runOnce()).toEqual({ acquired: false, processed: 0 });
  });

  it('refreshes independent snapshots at capacity without advancing history', async () => {
    await add(1);
    const sourceStation = await prisma.station.findFirstOrThrow({ include: { plot: true } });
    const station = {
      ...sourceStation,
      code: sourceStation.upstreamCode,
      farmId: sourceStation.plot.farmId,
    };
    const boundedConfig = { ...config, soilRawStationLimit: 1, soilRawGlobalLimit: 1 };
    const bounded = new SoilReadingRepository(prisma as PrismaService, boundedConfig);
    await bounded.ingestLatest(station, {
      station,
      fields: [
        { field: 'moisture', value: 20, observedAt: new Date(now.getTime() - 1000).toISOString() },
      ],
      fetchedAt: new Date(now.getTime() - 1000).toISOString(),
    });
    await new SoilCollectionService(
      prisma as PrismaService,
      bounded,
      sources,
      boundedConfig,
      metrics,
    ).runOnce(now);
    expect(await prisma.soilReading.count()).toBe(1);
    expect(await prisma.soilLatestReading.findFirst()).toMatchObject({ value: 44 });
    expect(await prisma.soilCollectionCheckpoint.findFirst()).toMatchObject({
      historyThrough: null,
      lastResult: 'storage_limit',
    });
    expect(getHistory).not.toHaveBeenCalled();
    expect(metrics.snapshot()).toContainEqual({
      name: 'soil_collection_runs_total',
      labels: { outcome: 'storage_limit' },
      value: 1,
    });
  });

  it('reports database failure as well as provider outage when retry checkpoint cannot be saved', async () => {
    await add(1);
    getLatest.mockRejectedValue(new AppError('UPSTREAM_TIMEOUT', 504, 'Timed out'));
    vi.spyOn(readings, 'updateCollectionCheckpoint').mockRejectedValueOnce(
      new Error('Injected write failure'),
    );
    await collector().runOnce(now);
    expect(metrics.snapshot()).toEqual(
      expect.arrayContaining([
        { name: 'soil_collection_runs_total', labels: { outcome: 'upstream_error' }, value: 1 },
        { name: 'soil_collection_runs_total', labels: { outcome: 'database_error' }, value: 1 },
      ]),
    );
    expect(await prisma.soilCollectionCheckpoint.count()).toBe(0);
    await new SoilCollectionService(
      prisma as PrismaService,
      readings,
      sources,
      config,
      metrics,
    ).runOnce(now);
    expect(await prisma.soilCollectionCheckpoint.findFirst()).toMatchObject({
      lastResult: 'upstream_error',
      failureCount: 1,
    });
  });

  it('resumes a persisted full-page prefix inclusively after a new collector starts', async () => {
    await add(1);
    const start = now.getTime() - 86_400_000;
    const station = await prisma.station.findFirstOrThrow();
    await prisma.soilCollectionCheckpoint.create({
      data: {
        stationId: station.id,
        dataSourceId: station.dataSourceId,
        historyThrough: new Date(start),
        nextAttemptAt: now,
      },
    });
    const tail = start + 4999;
    getHistory.mockResolvedValueOnce(
      parseWeatherHistoryResponse({
        success: true,
        data: [
          {
            station: 'SAFE0',
            history: {
              soil: Array.from({ length: 5000 }, (_, i) => ({
                ts: start + i,
                time: new Date(start + i).toISOString(),
                moisture: i,
              })),
            },
          },
        ],
      }).data,
    );
    await new SoilCollectionService(
      prisma as PrismaService,
      readings,
      sources,
      { ...config, soilCollectionPageLimit: 1 },
      metrics,
    ).runOnce(now);
    expect(await prisma.soilCollectionCheckpoint.findFirst()).toMatchObject({
      historyThrough: new Date(tail),
      lastResult: 'budget',
    });
    expect(await prisma.soilHistoryCoverage.findFirst()).toMatchObject({
      begin: new Date(start),
      end: new Date(tail - 1),
    });
    expect(metrics.snapshot()).toContainEqual({
      name: 'soil_collection_runs_total',
      labels: { outcome: 'budget' },
      value: 1,
    });
    getHistory.mockClear().mockResolvedValueOnce(
      parseWeatherHistoryResponse({
        success: true,
        data: [
          {
            station: 'SAFE0',
            history: {
              soil: [
                { ts: tail, time: new Date(tail).toISOString(), moisture: 4999 },
                { ts: tail + 1, time: new Date(tail + 1).toISOString(), moisture: 5000 },
              ],
            },
          },
        ],
      }).data,
    );
    const next = new Date(now.getTime() + 120_000);
    await collector().runOnce(next);
    expect(getHistory).toHaveBeenCalledWith(
      expect.objectContaining({ begin: new Date(tail).toISOString() }),
    );
    expect(await prisma.soilReading.count()).toBe(5002);
    expect(await prisma.soilCollectionCheckpoint.findFirst()).toMatchObject({
      historyThrough: new Date(tail + 86_400_000),
      lastResult: 'success',
    });
  });

  it('signals saturated equal-time pages without advancing or claiming coverage', async () => {
    await add(1);
    const start = now.getTime() - 86_400_000;
    const station = await prisma.station.findFirstOrThrow();
    await prisma.soilCollectionCheckpoint.create({
      data: {
        stationId: station.id,
        dataSourceId: station.dataSourceId,
        historyThrough: new Date(start),
        nextAttemptAt: now,
      },
    });
    getHistory.mockResolvedValueOnce(
      parseWeatherHistoryResponse({
        success: true,
        data: [
          {
            station: 'SAFE0',
            history: {
              soil: Array.from({ length: 5000 }, () => ({
                ts: start,
                time: new Date(start).toISOString(),
                moisture: 40,
              })),
            },
          },
        ],
      }).data,
    );
    await collector().runOnce(now);
    expect(await prisma.soilCollectionCheckpoint.findFirst()).toMatchObject({
      historyThrough: new Date(start),
      lastResult: 'saturated',
    });
    expect(await prisma.soilHistoryCoverage.count()).toBe(0);
    expect(metrics.snapshot()).toContainEqual({
      name: 'soil_collection_runs_total',
      labels: { outcome: 'saturated' },
      value: 1,
    });
  });

  it('persists retry for a broken source resolver rather than permanently starving later stations', async () => {
    await add(1);
    const broken = {
      resolve: () => Promise.reject(new AppError('INTERNAL_ERROR', 500, 'Source unavailable')),
      markConnected: () => Promise.resolve(),
    } as unknown as StationSourceClientResolver;
    await new SoilCollectionService(prisma as PrismaService, readings, broken, config).runOnce(now);
    expect(await prisma.soilCollectionCheckpoint.findFirst()).toMatchObject({
      failureCount: 1,
      lastResult: 'source_error',
      nextAttemptAt: new Date(now.getTime() + 120_000),
    });
  });
  it('drains safely when lease acquisition fails during shutdown', async () => {
    let fail: (error: Error) => void = () => {};
    const gate = new Promise<number>((_resolve, reject) => {
      fail = reject;
    });
    const broken = { $executeRaw: () => gate } as unknown as PrismaService;
    const service = new SoilCollectionService(broken, readings, sources, config);
    const run = service.runOnce(now);
    const observedFailure = expect(run).rejects.toThrow('Database unavailable');
    const stopping = service.onModuleDestroy();
    const drained = expect(stopping).resolves.toBeUndefined();
    fail(new Error('Database unavailable'));
    await Promise.all([observedFailure, drained]);
  });
  it('renews an unexpired lease during a slow upstream request', async () => {
    await add(1);
    const pending = pendingLatest();
    const service = new SoilCollectionService(prisma as PrismaService, readings, sources, {
      ...config,
      soilCollectionLeaseMs: 1000,
    });
    const run = service.runOnce(now);
    await pending.started;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const lease = await prisma.evaluatorLease.findUnique({ where: { name: 'soil-collector' } });
    pending.release();
    await run;
    expect(lease?.expiresAt.getTime()).toBeGreaterThan(Date.now() - 300);
    expect(await prisma.soilLatestReading.count()).toBe(1);
  });
  it('starts on application bootstrap without a browser and stops scheduling on shutdown', async () => {
    const service = new SoilCollectionService(prisma as PrismaService, readings, sources, {
      ...config,
      soilCollectionEnabled: true,
    });
    const run = vi.spyOn(service, 'runOnce').mockResolvedValue({ acquired: false, processed: 0 });
    vi.useFakeTimers();
    try {
      service.onApplicationBootstrap();
      await vi.advanceTimersByTimeAsync(1);
      expect(run).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(run).toHaveBeenCalledTimes(2);
      await service.onModuleDestroy();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(run).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
