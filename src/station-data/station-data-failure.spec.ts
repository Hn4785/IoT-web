import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../common/errors/app-error.js';
import type { WeatherClientService } from '../integrations/weather/weather-client.service.js';
import {
  parseWeatherHistoryResponse,
  parseWeatherLatestResponse,
} from '../integrations/weather/contracts.js';
import { makeTestRuntimeConfig } from '../../test/helpers/runtime-config.js';
import type { SoilReadingRepository } from './soil-reading.repository.js';
import type { StoredHistoryRepository } from './stored-history.repository.js';
import type { StationSourceClientResolver } from './station-source-client.resolver.js';
import type { AuthorizedStation } from './station.repository.js';
import { parseSoilHistoryQuery } from './station-data.contracts.js';
import { StationDataService } from './station-data.service.js';

describe('durable data failure boundaries', () => {
  const station = {
    id: '11111111-1111-4111-8111-111111111111',
    dataSourceId: '22222222-2222-4222-8222-222222222222',
    upstreamCode: 'NODE01',
    code: 'NODE01',
    name: 'Node',
  } as AuthorizedStation;
  const begin = '2026-10-01T00:00:00.000Z';
  const end = '2026-10-01T01:00:00.000Z';
  const timeout = new AppError('UPSTREAM_TIMEOUT', 504, 'Timed out');
  let now = new Date(end);
  const getHistory = vi.fn<WeatherClientService['getHistory']>();
  const getLatest = vi.fn<WeatherClientService['getLatest']>();
  const markConnected = vi.fn().mockResolvedValue(undefined);
  const requireActive = vi.fn().mockResolvedValue(undefined);
  const ingestLatest = vi.fn().mockResolvedValue({ storageLimited: false });
  const ingestHistory = vi.fn().mockResolvedValue({ storageLimited: false });
  const readLatest = vi.fn().mockResolvedValue(null);
  const getCoverage = vi.fn().mockResolvedValue({ status: 'unknown', fields: [] });
  const readHistory = vi.fn().mockResolvedValue(null);
  const weather = { getLatest, getHistory } as unknown as WeatherClientService;
  const readings = {
    requireActive,
    ingestLatest,
    ingestHistory,
    getLatest: readLatest,
  } as unknown as SoilReadingRepository;
  const stored = { getCoverage, getHistory: readHistory } as unknown as StoredHistoryRepository;
  const sources = {
    resolve: () => Promise.resolve(weather),
    markConnected,
  } as unknown as StationSourceClientResolver;
  const service = () =>
    new StationDataService(
      makeTestRuntimeConfig(),
      weather,
      undefined,
      { now: () => now },
      undefined,
      sources,
      readings,
      stored,
    );
  const query = (extra = {}) => parseSoilHistoryQuery({ begin, end, fields: 'moisture', ...extra });
  const history = () =>
    parseWeatherHistoryResponse({
      success: true,
      data: [
        {
          station: station.code,
          history: {
            soil: [
              { ts: Date.parse(begin), time: begin, moisture: 10 },
              { ts: Date.parse(begin) + 60_000, time: '2026-10-01T00:01:00.000Z', moisture: 20 },
              { ts: Date.parse(begin) + 120_000, time: '2026-10-01T00:02:00.000Z', moisture: 30 },
            ],
          },
        },
      ],
    }).data;
  beforeEach(() => {
    vi.clearAllMocks();
    now = new Date(end);
    getHistory.mockReset().mockResolvedValue(history());
    getLatest.mockReset().mockResolvedValue(
      parseWeatherLatestResponse({
        success: true,
        data: [
          {
            station: station.code,
            latest: {
              soil: {
                ts: Date.parse(begin),
                time: begin,
                moisture: 10,
                _fieldTs: { moisture: Date.parse(begin) },
              },
            },
          },
        ],
      }).data,
    );
    readLatest.mockReset().mockResolvedValue(null);
    getCoverage.mockReset().mockResolvedValue({ status: 'unknown', fields: [] });
    requireActive.mockReset().mockResolvedValue(undefined);
    ingestLatest.mockReset().mockResolvedValue({ storageLimited: false });
  });
  it('never relabels cached upstream aggregates as durable raw-derived history during outage', async () => {
    const live = service();
    const aggregate = query({ interval: '1h', aggregate: 'mean' });
    await live.getHistory(station, aggregate);
    expect(ingestHistory).not.toHaveBeenCalled();
    now = new Date(now.getTime() + 300_001);
    getHistory.mockRejectedValue(timeout);
    await expect(live.getHistory(station, aggregate)).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
    });
  });
  it('never switches a warmed upstream cursor chain to a stale stored origin', async () => {
    const live = service();
    const first = await live.getHistory(station, query({ limit: 1 }));
    const continuation = query({ limit: 1, cursor: first.page.nextCursor });
    await live.getHistory(station, continuation);
    now = new Date(now.getTime() + 300_001);
    getHistory.mockRejectedValue(timeout);
    await expect(live.getHistory(station, continuation)).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
    });
    expect(readHistory).not.toHaveBeenCalled();
  });
  it('binds upstream cursors to the registry station identity, not just reused source/code', async () => {
    const live = service();
    const first = await live.getHistory(station, query({ limit: 1 }));
    getHistory.mockClear();
    await expect(
      live.getHistory(
        { ...station, id: '33333333-3333-4333-8333-333333333333' },
        query({ limit: 1, cursor: first.page.nextCursor }),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(getHistory).not.toHaveBeenCalled();
  });
  it('does not mark connected if a canonical latest read fails after successful ingestion', async () => {
    readLatest.mockRejectedValue(new Error('Injected database read failure'));
    await expect(service().getLatest(station, { fields: ['moisture'] })).rejects.toThrow(
      'Injected database read failure',
    );
    expect(markConnected).not.toHaveBeenCalled();
  });
  it('does not reuse latest cache for a replacement station sharing the source/code', async () => {
    const live = service();
    await live.getLatest(station, { fields: ['moisture'] });
    const replacement = { ...station, id: '33333333-3333-4333-8333-333333333333' };
    const result = await live.getLatest(replacement, { fields: ['moisture'] });
    expect(result.station.id).toBe(replacement.id);
    expect(getLatest).toHaveBeenCalledTimes(2);
  });
  it('does not mark connected if history coverage cannot be read', async () => {
    getCoverage.mockRejectedValue(new Error('Injected database read failure'));
    await expect(service().getHistory(station, query())).rejects.toThrow(
      'Injected database read failure',
    );
    expect(markConnected).not.toHaveBeenCalled();
  });
  it.each(['active', 'ingest', 'canonical'] as const)(
    'does not hide %s database failures behind warm latest cache',
    async (stage) => {
      const live = service();
      await live.getLatest(station, { fields: ['moisture'] });
      markConnected.mockClear();
      const error = new Error('Injected database failure');
      ({ active: requireActive, ingest: ingestLatest, canonical: readLatest })[
        stage
      ].mockRejectedValue(error);
      now = new Date(now.getTime() + 30_001);
      await expect(live.getLatest(station, { fields: ['moisture'] })).rejects.toThrow(
        'Injected database failure',
      );
      expect(markConnected).not.toHaveBeenCalled();
    },
  );
});
