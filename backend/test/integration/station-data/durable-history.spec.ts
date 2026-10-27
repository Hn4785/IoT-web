import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../src/common/errors/app-error.js';
import type { PrismaService } from '../../../src/database/prisma.service.js';
import type { WeatherClientService } from '../../../src/integrations/weather/weather-client.service.js';
import { parseWeatherHistoryResponse } from '../../../src/integrations/weather/contracts.js';
import { SoilReadingRepository } from '../../../src/station-data/soil-reading.repository.js';
import { StoredHistoryRepository } from '../../../src/station-data/stored-history.repository.js';
import { StationDataService } from '../../../src/station-data/station-data.service.js';
import { parseSoilHistoryQuery } from '../../../src/station-data/station-data.contracts.js';
import type { AuthorizedStation } from '../../../src/station-data/station.repository.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

describe('durable history outage and restart', () => {
  const prisma = createTestPrismaClient();
  const readings = new SoilReadingRepository(prisma as PrismaService);
  const stored = new StoredHistoryRepository(prisma as PrismaService, readings);
  const getHistory = vi.fn<WeatherClientService['getHistory']>();
  const weather = { getHistory } as unknown as WeatherClientService;
  const begin = '2026-10-01T00:00:00.000Z';
  const end = '2026-10-01T01:00:00.000Z';
  let now = new Date(end);
  const query = (extra = {}) => parseSoilHistoryQuery({ begin, end, fields: 'moisture', ...extra });
  const service = () =>
    new StationDataService(
      makeTestRuntimeConfig(),
      weather,
      undefined,
      { now: () => now },
      undefined,
      undefined,
      readings,
      stored,
    );
  let station: AuthorizedStation;
  beforeAll(async () => {
    await prepareTestDatabase();
    const farm = await prisma.farm.create({ data: { name: 'Durable history' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Plot' } });
    const row = await prisma.station.create({
      data: { plotId: plot.id, name: 'Node', upstreamCode: 'DURABLEH01' },
    });
    station = { ...row, farmId: farm.id, code: row.upstreamCode };
  });
  afterAll(() => prisma.$disconnect());
  it('persists raw data and returns original times and proven coverage after restart', async () => {
    getHistory.mockResolvedValueOnce(
      parseWeatherHistoryResponse({
        success: true,
        data: [
          {
            station: station.code,
            history: { soil: [{ ts: Date.parse(begin), time: begin, moisture: 43.5 }] },
          },
        ],
      }).data,
    );
    expect(await service().getHistory(station, query())).toMatchObject({ dataOrigin: 'upstream' });
    expect(await prisma.soilReading.count()).toBe(1);
    now = new Date('2026-10-05T00:00:00Z');
    getHistory.mockRejectedValue(new AppError('UPSTREAM_TIMEOUT', 504, 'Timed out'));
    expect(await service().getHistory(station, query())).toMatchObject({
      dataOrigin: 'stored',
      isStale: true,
      fetchedAt: end,
      coverage: { status: 'complete' },
      series: [{ points: [{ observedAt: begin, value: 43.5 }] }],
    });
  });
  it('keeps stored cursor chains local even after the upstream recovers', async () => {
    await readings.ingestHistory(
      station,
      {
        readings: [{ field: 'moisture', value: 44, observedAt: '2026-10-01T00:01:00.000Z' }],
        completeFields: [],
        rawCount: 1,
        lastTimestamp: Date.parse(begin) + 60_000,
      },
      new Date(end),
    );
    getHistory.mockRejectedValue(new AppError('UPSTREAM_TIMEOUT', 504, 'Timed out'));
    const first = await service().getHistory(station, query({ limit: 1 }));
    getHistory.mockClear();
    const second = await service().getHistory(
      station,
      query({ limit: 1, cursor: first.page.nextCursor }),
    );
    expect(second.series[0]?.points[0]?.value).toBe(44);
    expect(getHistory).not.toHaveBeenCalled();
  });
  it('does not mask validation failures or claim history for uncaptured fields', async () => {
    getHistory.mockRejectedValue(new AppError('VALIDATION_ERROR', 400, 'Invalid'));
    await expect(service().getHistory(station, query())).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    getHistory.mockRejectedValue(new AppError('UPSTREAM_TIMEOUT', 504, 'Timed out'));
    await expect(service().getHistory(station, query({ fields: 'ph' }))).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
    });
  });
});
