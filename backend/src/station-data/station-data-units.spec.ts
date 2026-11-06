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
import {
  parseSoilHistoryQuery,
  type NormalizedLatestSoil,
  type SoilHistoryDto,
} from './station-data.contracts.js';
import {
  CanonicalSoilMetadataProvider,
  UnconfirmedSoilMetadataProvider,
  type SoilMetadataProvider,
} from './soil-metadata.provider.js';
import { encodeCursor } from './cursor.js';
import { historyQueryFingerprint } from './history.mapper.js';
import { StationDataService } from './station-data.service.js';

describe('StationDataService confirmed-unit projection', () => {
  const station: AuthorizedStation = {
    id: '11111111-1111-4111-8111-111111111111',
    farmId: '33333333-3333-4333-8333-333333333333',
    plotId: '44444444-4444-4444-8444-444444444444',
    dataSourceId: '22222222-2222-4222-8222-222222222222',
    upstreamCode: 'NODE01',
    code: 'NODE01',
    name: 'Node 01',
  };
  const begin = '2026-10-01T00:00:00.000Z';
  const end = '2026-10-01T00:05:00.000Z';
  const timeout = new AppError('UPSTREAM_TIMEOUT', 504, 'Timed out');
  let now = new Date(Date.parse(begin) + 60_000);

  const getHistory = vi.fn<WeatherClientService['getHistory']>();
  const getLatest = vi.fn<WeatherClientService['getLatest']>();
  const markConnected = vi.fn().mockResolvedValue(undefined);
  const requireActive = vi.fn().mockResolvedValue(undefined);
  const ingestLatest = vi.fn().mockResolvedValue({ storageLimited: false });
  const ingestHistory = vi.fn().mockResolvedValue({ storageLimited: false });
  const readLatest = vi.fn<SoilReadingRepository['getLatest']>().mockResolvedValue(null);
  const getCoverage = vi.fn().mockResolvedValue({ status: 'unknown', fields: [] });
  const readHistory = vi.fn<StoredHistoryRepository['getHistory']>().mockResolvedValue(null);

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

  const createService = (metadataProvider?: SoilMetadataProvider) =>
    new StationDataService(
      makeTestRuntimeConfig(),
      weather,
      undefined,
      { now: () => now },
      undefined,
      sources,
      readings,
      stored,
      metadataProvider,
    );

  const query = (extra = {}) =>
    parseSoilHistoryQuery({ begin, end, fields: 'moisture,temperature', ...extra });

  beforeEach(() => {
    vi.clearAllMocks();
    now = new Date(Date.parse(begin) + 60_000);
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
                moisture: 42.5,
                temperature: 21.0,
                _fieldTs: { moisture: Date.parse(begin), temperature: Date.parse(begin) },
              },
            },
          },
        ],
      }).data,
    );
    getHistory.mockReset().mockResolvedValue(
      parseWeatherHistoryResponse({
        success: true,
        data: [
          {
            station: station.code,
            history: {
              soil: [
                { ts: Date.parse(begin), time: begin, moisture: 40.0, temperature: 20.0 },
                {
                  ts: Date.parse(begin) + 60_000,
                  time: '2026-10-01T00:01:00.000Z',
                  moisture: 41.0,
                  temperature: 20.5,
                },
              ],
            },
          },
        ],
      }).data,
    );
    readLatest.mockReset().mockResolvedValue(null);
    readHistory.mockReset().mockResolvedValue(null);
    getCoverage.mockReset().mockResolvedValue({ status: 'unknown', fields: [] });
  });

  it('enriches latest outgoing fields with confirmed % and °C units while preserving all other properties', async () => {
    const service = createService(new CanonicalSoilMetadataProvider());
    const res = await service.getLatest(station, { fields: ['moisture', 'temperature'] });

    expect(res.fields).toEqual([
      {
        field: 'moisture',
        value: 42.5,
        unit: '%',
        observedAt: begin,
        quality: 'good',
        sensorId: null,
        depthCm: null,
      },
      {
        field: 'temperature',
        value: 21.0,
        unit: '°C',
        observedAt: begin,
        quality: 'good',
        sensorId: null,
        depthCm: null,
      },
    ]);
    expect(res.measurement).toBe('soil');
    expect(res.dataOrigin).toBe('upstream');
    expect(res.isFromCache).toBe(false);
    expect(res.isStale).toBe(false);
  });

  it('enriches history series with confirmed units without modifying points or provenance', async () => {
    const service = createService(new CanonicalSoilMetadataProvider());
    const res = await service.getHistory(station, query());

    expect(res.series).toHaveLength(2);
    expect(res.series[0]).toMatchObject({
      field: 'moisture',
      unit: '%',
      sensorId: null,
      depthCm: null,
    });
    expect(res.series[0]?.points).toHaveLength(2);
    expect(res.series[0]?.points[0]).toEqual({
      observedAt: begin,
      value: 40.0,
      quality: 'good',
    });
    expect(res.series[1]).toMatchObject({
      field: 'temperature',
      unit: '°C',
      sensorId: null,
      depthCm: null,
    });
    expect(res.measurement).toBe('soil');
    expect(res.dataOrigin).toBe('upstream');
  });

  it('leaves units null when provider confirms false or provider is not configured', async () => {
    const unconfirmedService = createService(new UnconfirmedSoilMetadataProvider());
    const latestUnconfirmed = await unconfirmedService.getLatest(station, { fields: ['moisture'] });
    expect(latestUnconfirmed.fields[0]?.unit).toBeNull();

    const historyUnconfirmed = await unconfirmedService.getHistory(
      station,
      query({ fields: 'moisture' }),
    );
    expect(historyUnconfirmed.series[0]?.unit).toBeNull();

    // Compatibly handles manual constructor calls without metadata provider
    const noProviderService = createService(undefined);
    const latestNoProvider = await noProviderService.getLatest(station, { fields: ['moisture'] });
    expect(latestNoProvider.fields[0]?.unit).toBeNull();

    const historyNoProvider = await noProviderService.getHistory(
      station,
      query({ fields: 'moisture' }),
    );
    expect(historyNoProvider.series[0]?.unit).toBeNull();
  });

  it('falls back to station.id when upstreamCode metadata is unconfirmed', async () => {
    const getFieldMetadata = vi
      .fn<SoilMetadataProvider['getFieldMetadata']>()
      .mockImplementation((target: string, field: string) => {
        if (target === station.upstreamCode) {
          return Promise.resolve({ field: field as 'moisture', isConfirmed: false });
        }
        if (target === station.id && field === 'moisture') {
          return Promise.resolve({
            field: 'moisture',
            isConfirmed: true,
            unit: '%',
            revision: 'rev:1',
          });
        }
        return Promise.resolve({ field: field as 'moisture', isConfirmed: false });
      });
    const fallbackProvider: SoilMetadataProvider = { getFieldMetadata };
    const service = createService(fallbackProvider);
    const res = await service.getLatest(station, { fields: ['moisture'] });
    expect(res.fields[0]?.unit).toBe('%');

    const historyRes = await service.getHistory(station, query({ fields: 'moisture' }));
    expect(historyRes.series[0]?.unit).toBe('%');
    expect(getFieldMetadata).toHaveBeenCalledWith(station.upstreamCode, 'moisture');
    expect(getFieldMetadata).toHaveBeenCalledWith(station.id, 'moisture');
  });

  it('preserves confirmed units and flags on latest and history cache hits', async () => {
    const service = createService(new CanonicalSoilMetadataProvider());
    const firstLatest = await service.getLatest(station, { fields: ['moisture'] });
    expect(firstLatest.isFromCache).toBe(false);
    expect(firstLatest.fields[0]?.unit).toBe('%');

    const cachedLatest = await service.getLatest(station, { fields: ['moisture'] });
    expect(cachedLatest.isFromCache).toBe(true);
    expect(cachedLatest.fields[0]?.unit).toBe('%');

    const firstHistory = await service.getHistory(station, query({ fields: 'moisture' }));
    expect(firstHistory.isFromCache).toBe(false);
    expect(firstHistory.series[0]?.unit).toBe('%');

    const cachedHistory = await service.getHistory(station, query({ fields: 'moisture' }));
    expect(cachedHistory.isFromCache).toBe(true);
    expect(cachedHistory.series[0]?.unit).toBe('%');
  });

  it('attaches confirmed units to stored latest fallback during upstream outage', async () => {
    getLatest.mockRejectedValue(timeout);
    const storedLatest: NormalizedLatestSoil = {
      station: { id: station.id, code: station.code, name: station.name },
      fields: [{ field: 'moisture', value: 38.0, observedAt: begin }],
      fetchedAt: now.toISOString(),
      dataOrigin: 'stored',
    };
    readLatest.mockResolvedValue(storedLatest);

    const service = createService(new CanonicalSoilMetadataProvider());
    const res = await service.getLatest(station, { fields: ['moisture'] });
    expect(res.dataOrigin).toBe('stored');
    expect(res.isFromCache).toBe(true);
    expect(res.isStale).toBe(true);
    expect(res.fields[0]?.unit).toBe('%');
    expect(res.fields[0]?.value).toBe(38.0);
  });

  it('attaches confirmed units to stored aggregate history fallback during upstream outage', async () => {
    getHistory.mockRejectedValue(timeout);
    const storedHistoryData: SoilHistoryDto = {
      stationId: station.id,
      measurement: 'soil',
      dataOrigin: 'stored',
      coverage: { status: 'complete', fields: [] },
      series: [
        {
          field: 'moisture',
          unit: null,
          sensorId: null,
          depthCm: null,
          points: [{ observedAt: begin, value: 39.0, quality: 'good' }],
        },
      ],
      page: { nextCursor: null },
      fetchedAt: now.toISOString(),
      isFromCache: false,
      isStale: false,
    };
    readHistory.mockResolvedValue(storedHistoryData);

    const service = createService(new CanonicalSoilMetadataProvider());
    const res = await service.getHistory(
      station,
      query({ fields: 'moisture', interval: '1h', aggregate: 'mean' }),
    );
    expect(res.dataOrigin).toBe('stored');
    expect(res.series[0]?.unit).toBe('%');
    expect(res.series[0]?.points[0]?.value).toBe(39.0);
  });

  it('attaches confirmed units to stored history cursor continuation', async () => {
    const storedQuery = query({ fields: 'moisture', interval: 'raw' });
    const fingerprint = historyQueryFingerprint({
      stationCode: `stored:${station.dataSourceId}:${station.id}`,
      query: storedQuery,
    });
    const cursor = encodeCursor({
      v: 2,
      kind: 'stored-soil-history',
      queryFingerprint: fingerprint,
      boundaryTime: begin,
    });

    const storedContinuationData: SoilHistoryDto = {
      stationId: station.id,
      measurement: 'soil',
      dataOrigin: 'stored',
      coverage: { status: 'complete', fields: [] },
      series: [
        {
          field: 'moisture',
          unit: null,
          sensorId: null,
          depthCm: null,
          points: [{ observedAt: '2026-10-01T00:02:00.000Z', value: 41.5, quality: 'good' }],
        },
      ],
      page: { nextCursor: null },
      fetchedAt: now.toISOString(),
      isFromCache: false,
      isStale: false,
    };
    readHistory.mockResolvedValue(storedContinuationData);

    const service = createService(new CanonicalSoilMetadataProvider());
    const res = await service.getHistory(station, { ...storedQuery, cursor });
    expect(res.dataOrigin).toBe('stored');
    expect(res.series[0]?.unit).toBe('%');
    expect(res.series[0]?.points[0]?.value).toBe(41.5);
  });

  it('queries metadata only for emitted fields and avoids unnecessary per-point lookups', async () => {
    const getFieldMetadata = vi.fn<SoilMetadataProvider['getFieldMetadata']>().mockResolvedValue({
      field: 'moisture',
      isConfirmed: true,
      unit: '%',
      revision: 'rev:1',
    });
    const mockProvider: SoilMetadataProvider = { getFieldMetadata };
    const service = createService(mockProvider);
    await service.getHistory(station, query({ fields: 'moisture' }));

    // History had 2 points for moisture, but provider is only queried once for moisture
    expect(getFieldMetadata).toHaveBeenCalledTimes(1);
    expect(getFieldMetadata).toHaveBeenCalledWith(station.upstreamCode, 'moisture');
  });

  it('leaves units null and preserves values and provenance when metadata lookup throws', async () => {
    const getFieldMetadata = vi
      .fn<SoilMetadataProvider['getFieldMetadata']>()
      .mockRejectedValue(new Error('Metadata service unavailable'));
    const failingProvider: SoilMetadataProvider = { getFieldMetadata };
    const service = createService(failingProvider);

    const latest = await service.getLatest(station, { fields: ['moisture'] });
    expect(latest.fields[0]?.unit).toBeNull();
    expect(latest.fields[0]?.value).toBe(42.5);
    expect(latest.dataOrigin).toBe('upstream');
    expect(latest.isFromCache).toBe(false);

    const history = await service.getHistory(station, query({ fields: 'moisture' }));
    expect(history.series[0]?.unit).toBeNull();
    expect(history.series[0]?.points[0]?.value).toBe(40.0);
    expect(history.dataOrigin).toBe('upstream');
  });
});
