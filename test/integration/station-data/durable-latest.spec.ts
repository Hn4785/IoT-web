import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../src/common/errors/app-error.js';
import type { PrismaService } from '../../../src/database/prisma.service.js';
import type { WeatherClientService } from '../../../src/integrations/weather/weather-client.service.js';
import { parseWeatherLatestResponse } from '../../../src/integrations/weather/contracts.js';
import { SoilReadingRepository } from '../../../src/station-data/soil-reading.repository.js';
import { StationDataService } from '../../../src/station-data/station-data.service.js';
import type { AuthorizedStation } from '../../../src/station-data/station.repository.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

describe('durable latest outage and restart', () => {
  const prisma = createTestPrismaClient();
  const repository = new SoilReadingRepository(prisma as PrismaService);
  let station: AuthorizedStation;
  let now = new Date('2026-10-04T00:01:00.000Z');
  const getLatest = vi.fn<WeatherClientService['getLatest']>();
  const weather = { getLatest } as unknown as WeatherClientService;
  const config = makeTestRuntimeConfig();
  const service = () =>
    new StationDataService(
      config,
      weather,
      undefined,
      { now: () => now },
      undefined,
      undefined,
      repository,
    );

  beforeAll(async () => {
    await prepareTestDatabase();
    const farm = await prisma.farm.create({ data: { name: 'Durable latest' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Plot' } });
    const row = await prisma.station.create({
      data: {
        plotId: plot.id,
        name: 'Latest',
        upstreamCode: 'DURABLE01',
      },
    });
    station = { ...row, farmId: farm.id, code: row.upstreamCode };
  });
  afterAll(() => prisma.$disconnect());

  it('persists real field timestamps and returns them after a new service starts during outage', async () => {
    getLatest.mockResolvedValueOnce(
      parseWeatherLatestResponse({
        success: true,
        data: [
          {
            station: 'DURABLE01',
            latest: {
              soil: {
                ts: now.getTime(),
                time: now.toISOString(),
                moisture: 43.5,
                _fieldTs: { moisture: Date.parse('2026-10-04T00:00:00.000Z') },
              },
            },
          },
        ],
      }).data,
    );
    const online = await service().getLatest(station, { fields: ['moisture'] });
    expect(online).toMatchObject({ dataOrigin: 'upstream', isStale: false });
    now = new Date('2026-10-05T00:01:00.000Z');
    getLatest.mockRejectedValue(new AppError('UPSTREAM_TIMEOUT', 504, 'Timed out'));
    const offline = await service().getLatest(station, { fields: ['moisture'] });
    expect(offline).toMatchObject({
      dataOrigin: 'stored',
      isFromCache: true,
      isStale: true,
      fetchedAt: '2026-10-04T00:01:00.000Z',
      fields: [{ value: 43.5, observedAt: '2026-10-04T00:00:00.000Z', quality: 'stale' }],
    });
    expect(await prisma.soilReading.count()).toBe(1);
  });

  it('does not fabricate missing fields or fall back on authorization/validation errors', async () => {
    getLatest.mockRejectedValue(new AppError('UPSTREAM_TIMEOUT', 504, 'Timed out'));
    await expect(service().getLatest(station, { fields: ['temperature'] })).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
    });
    getLatest.mockRejectedValue(new AppError('VALIDATION_ERROR', 400, 'Invalid'));
    await expect(service().getLatest(station, { fields: ['moisture'] })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('does not publish an older correction after a newer overlapping query has committed', async () => {
    now = new Date('2026-10-05T00:02:00.000Z');
    const response = (value: number) =>
      parseWeatherLatestResponse({
        success: true,
        data: [
          {
            station: 'DURABLE01',
            latest: {
              soil: {
                ts: now.getTime(),
                time: now.toISOString(),
                moisture: value,
                temperature: 25,
                _fieldTs: {
                  moisture: Date.parse('2026-10-05T00:00:00.000Z'),
                  temperature: Date.parse('2026-10-05T00:00:00.000Z'),
                },
              },
            },
          },
        ],
      }).data;
    let release: (value: Awaited<ReturnType<WeatherClientService['getLatest']>>) => void = () => {
      throw new Error('Missing request');
    };
    const delayed = new Promise<Awaited<ReturnType<WeatherClientService['getLatest']>>>(
      (resolve) => {
        release = resolve;
      },
    );
    let signalStarted = () => {};
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    getLatest.mockImplementationOnce(() => {
      signalStarted();
      return delayed;
    });
    const live = service();
    const oldRequest = live.getLatest(station, { fields: ['moisture'] });
    await started;
    now = new Date('2026-10-05T00:03:00.000Z');
    getLatest.mockResolvedValueOnce(response(44));
    expect(
      (await live.getLatest(station, { fields: ['moisture', 'temperature'] })).fields[0]?.value,
    ).toBe(44);
    release(response(42));
    expect((await oldRequest).fields[0]?.value).toBe(44);
    expect((await live.getLatest(station, { fields: ['moisture'] })).fields[0]?.value).toBe(44);
  });

  it('labels a newer history snapshot as stored rather than a fresh latest observation', async () => {
    now = new Date('2026-10-05T00:05:00.000Z');
    await repository.ingestHistory(
      station,
      {
        readings: [{ field: 'moisture', value: 12, observedAt: '2026-10-05T00:04:00.000Z' }],
        completeFields: ['moisture'],
        rawCount: 1,
        lastTimestamp: Date.parse('2026-10-05T00:04:00.000Z'),
      },
      now,
    );
    getLatest.mockResolvedValueOnce(
      parseWeatherLatestResponse({
        success: true,
        data: [
          {
            station: 'DURABLE01',
            latest: {
              soil: {
                ts: now.getTime(),
                time: now.toISOString(),
                moisture: 15,
                _fieldTs: { moisture: Date.parse('2026-10-05T00:03:00.000Z') },
              },
            },
          },
        ],
      }).data,
    );

    const result = await service().getLatest(station, { fields: ['moisture'] });
    expect(result.fields[0]).toMatchObject({ value: 12, observedAt: '2026-10-05T00:04:00.000Z' });
    expect(result).toMatchObject({ dataOrigin: 'stored', isStale: true, isFromCache: true });
  });
});
