import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

describe('background soil collection without a browser', () => {
  const prisma = createTestPrismaClient();
  const config = makeTestRuntimeConfig();
  const readings = new SoilReadingRepository(prisma as PrismaService, config);
  const now = new Date();
  let failFirst = true;
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
              moisture: 43,
            },
          },
        },
      ],
    }).data;
  const getLatest = vi.fn<WeatherClientService['getLatest']>((query) => {
    const station = query.station?.[0] ?? '';
    if (failFirst && station === 'COLLECT01')
      return Promise.reject(new AppError('UPSTREAM_TIMEOUT', 504, 'Timed out'));
    return Promise.resolve(latest(station));
  });
  const getHistory = vi.fn<WeatherClientService['getHistory']>((query) =>
    Promise.resolve(
      parseWeatherHistoryResponse({
        success: true,
        data: [{ station: query.station?.[0] ?? '', history: { soil: [] } }],
      }).data,
    ),
  );
  const weather = { getLatest, getHistory } as unknown as WeatherClientService;
  const sources = {
    resolve: vi.fn(() => Promise.resolve(weather)),
    markConnected: vi.fn(() => Promise.resolve()),
  } as unknown as StationSourceClientResolver;
  const collector = () =>
    new SoilCollectionService(prisma as PrismaService, readings, sources, config);
  beforeAll(async () => {
    await prepareTestDatabase();
    const farm = await prisma.farm.create({ data: { name: 'Collection' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Plot' } });
    for (const upstreamCode of ['COLLECT01', 'COLLECT02', 'CENTER'])
      await prisma.station.create({ data: { plotId: plot.id, name: upstreamCode, upstreamCode } });
  });
  afterAll(() => prisma.$disconnect());
  it('isolates station failures, skips CENTER and persists retry/progress without browser calls', async () => {
    expect(await collector().runOnce(now)).toEqual({ acquired: true, processed: 2 });
    const rows = await prisma.soilCollectionCheckpoint.findMany({ include: { station: true } });
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.station.upstreamCode === 'COLLECT01')).toMatchObject({
      failureCount: 1,
      lastResult: 'upstream_error',
      historyThrough: null,
    });
    expect(
      rows.find((row) => row.station.upstreamCode === 'COLLECT02')?.historyThrough,
    ).toBeTruthy();
    expect(await prisma.soilLatestReading.count()).toBe(1);
    expect(getLatest.mock.calls.some(([query]) => query.station?.includes('CENTER'))).toBe(false);
  });
  it('resumes with idempotent latest and bounded backoff after a new collector starts', async () => {
    failFirst = false;
    expect(await collector().runOnce(new Date(now.getTime() + 120_000))).toEqual({
      acquired: true,
      processed: 2,
    });
    expect(await prisma.soilLatestReading.count()).toBe(2);
    expect(await prisma.soilReading.count()).toBe(2);
    expect(
      (await prisma.soilCollectionCheckpoint.findMany()).every((row) => row.failureCount === 0),
    ).toBe(true);
  });
  it('does not acquire a competing collector lease while another generation is active', async () => {
    await prisma.evaluatorLease.upsert({
      where: { name: 'soil-collector' },
      create: {
        name: 'soil-collector',
        holderId: 'competing-run',
        expiresAt: new Date(Date.now() + 60_000),
      },
      update: { holderId: 'competing-run', expiresAt: new Date(Date.now() + 60_000) },
    });
    expect(await collector().runOnce()).toEqual({ acquired: false, processed: 0 });
  });
});
