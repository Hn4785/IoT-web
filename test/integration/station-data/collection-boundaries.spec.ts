import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../src/common/errors/app-error.js';
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
    new SoilCollectionService(prisma as PrismaService, readings, sources, config);
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
    ).runOnce(now);
    expect(await prisma.soilReading.count()).toBe(1);
    expect(await prisma.soilLatestReading.findFirst()).toMatchObject({ value: 44 });
    expect(await prisma.soilCollectionCheckpoint.findFirst()).toMatchObject({
      historyThrough: null,
      lastResult: 'storage_limit',
    });
    expect(getHistory).not.toHaveBeenCalled();
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
