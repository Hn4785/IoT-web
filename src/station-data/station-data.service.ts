import { Inject, Injectable, Optional } from '@nestjs/common';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { WeatherClientService } from '../integrations/weather/weather-client.service.js';
import { AppError } from '../common/errors/app-error.js';
import { SoilReadingRepository } from './soil-reading.repository.js';
import { StoredHistoryRepository } from './stored-history.repository.js';
import { normalizeRawHistory } from './raw-history.js';
import { decodeCursor } from './cursor.js';
import {
  BoundedAsyncCache,
  HISTORY_SOIL_CACHE,
  LATEST_SOIL_CACHE,
  STATION_DATA_CLOCK,
  type StationDataClock,
} from './bounded-cache.js';
import { mapLatestSoil, toLatestSoilDto } from './soil.mapper.js';
import { decodeHistoryCursor, historyQueryFingerprint, mapHistoryPage } from './history.mapper.js';
import type {
  LatestSoilDataDto,
  LatestSoilQuery,
  NormalizedHistoryPage,
  NormalizedLatestSoil,
  SoilHistoryDto,
  SoilHistoryQuery,
} from './station-data.contracts.js';
import type { AuthorizedStation } from './station.repository.js';
import { StationSourceClientResolver } from './station-source-client.resolver.js';

@Injectable()
export class StationDataService {
  private readonly cache: BoundedAsyncCache<NormalizedLatestSoil>;
  private readonly historyCache: BoundedAsyncCache<NormalizedHistoryPage>;
  private readonly clock: StationDataClock;

  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    private readonly weather: WeatherClientService,
    @Optional()
    @Inject(LATEST_SOIL_CACHE)
    cache?: BoundedAsyncCache<NormalizedLatestSoil>,
    @Optional()
    @Inject(STATION_DATA_CLOCK)
    clock?: StationDataClock,
    @Optional()
    @Inject(HISTORY_SOIL_CACHE)
    historyCache?: BoundedAsyncCache<NormalizedHistoryPage>,
    @Optional()
    private readonly sourceClients?: StationSourceClientResolver,
    @Optional()
    private readonly readings?: SoilReadingRepository,
    @Optional()
    private readonly storedHistory?: StoredHistoryRepository,
  ) {
    this.clock = clock ?? { now: () => new Date() };
    this.cache =
      cache ??
      new BoundedAsyncCache<NormalizedLatestSoil>({
        ttlMs: config.soilLatestCacheTtlMs,
        staleIfErrorMs: config.soilStaleIfErrorMs,
        maxEntries: config.soilCacheMaxEntries,
        now: () => this.clock.now().getTime(),
      });
    this.historyCache =
      historyCache ??
      new BoundedAsyncCache<NormalizedHistoryPage>({
        ttlMs: config.soilHistoryCacheTtlMs,
        staleIfErrorMs: config.soilStaleIfErrorMs,
        maxEntries: config.soilCacheMaxEntries,
        now: () => this.clock.now().getTime(),
      });
  }

  async getLatest(station: AuthorizedStation, query: LatestSoilQuery): Promise<LatestSoilDataDto> {
    await this.readings?.requireActive(station);
    const now = this.clock.now();
    const key = `latest:${station.dataSourceId}:${station.id}:${station.upstreamCode}:${[...query.fields].sort().join(',')}`;

    try {
      const cacheResult = await this.cache.get(key, async () => {
        const weather = this.sourceClients
          ? await this.sourceClients.resolve(station.dataSourceId)
          : this.weather;
        const upstream = await weather.getLatest({
          station: [station.upstreamCode],
          type: ['soil'],
          fields: [...query.fields],
        });
        const value = mapLatestSoil({
          station,
          upstream,
          fields: query.fields,
          fetchedAt: now,
        });
        await this.readings?.ingestLatest(station, value);
        return value;
      });

      const canonical = await this.readings?.getLatest(station, query.fields);
      const value = canonical
        ? {
            ...canonical,
            dataOrigin: cacheResult.isStale ? ('stored' as const) : ('upstream' as const),
          }
        : cacheResult.value;
      const result = toLatestSoilDto(value, now, this.config.soilStaleAfterMs, cacheResult);
      if (!cacheResult.isFromCache)
        await this.sourceClients?.markConnected(station.dataSourceId, now);
      return result;
    } catch (error) {
      if (
        !this.readings ||
        !(error instanceof AppError) ||
        ![
          'UPSTREAM_TIMEOUT',
          'UPSTREAM_UNAVAILABLE',
          'RATE_LIMITED',
          'UPSTREAM_INVALID_RESPONSE',
        ].includes(error.code)
      )
        throw error;
      const stored = await this.readings.getLatest(station, query.fields);
      if (!stored) throw error;
      return toLatestSoilDto(stored, now, this.config.soilStaleAfterMs, {
        isFromCache: true,
        isStale: true,
      });
    }
  }

  async getHistory(station: AuthorizedStation, query: SoilHistoryQuery): Promise<SoilHistoryDto> {
    await this.readings?.requireActive(station);
    if (query.cursor && this.storedHistory) {
      try {
        decodeCursor(query.cursor, 'stored-soil-history');
        const stored = await this.storedHistory.getHistory(station, query);
        if (!stored) throw new AppError('NOT_FOUND', 404, 'Resource not found');
        return stored;
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== 'VALIDATION_ERROR') throw error;
        // A v1 upstream cursor is validated below; never reinterpret its boundary locally.
      }
    }
    const now = this.clock.now();
    const queryWithoutCursor = {
      begin: query.begin,
      end: query.end,
      fields: query.fields,
      interval: query.interval,
      ...(query.aggregate ? { aggregate: query.aggregate } : {}),
      order: query.order,
      limit: query.limit,
    };
    const queryFingerprint = historyQueryFingerprint({
      stationCode: `${station.dataSourceId}:${station.id}:${station.upstreamCode}`,
      query: queryWithoutCursor,
    });
    const continuation = query.cursor
      ? decodeHistoryCursor(query.cursor, queryFingerprint)
      : undefined;
    const key = `history:${station.dataSourceId}:${station.upstreamCode}:${queryFingerprint}:${query.cursor ?? 'start'}`;
    try {
      const cacheResult = await this.historyCache.get(
        key,
        async () => {
          const weather = this.sourceClients
            ? await this.sourceClients.resolve(station.dataSourceId)
            : this.weather;
          const requestBegin =
            query.order === 'asc' && continuation ? continuation.boundaryTime : query.begin;
          const requestEnd =
            query.order === 'desc' && continuation ? continuation.boundaryTime : query.end;
          const requestLimit = Math.min(5000, query.limit * 2 + 1);
          const upstream = await weather.getHistory({
            station: [station.upstreamCode],
            type: ['soil'],
            fields: [...query.fields],
            begin: requestBegin,
            end: requestEnd,
            interval: query.interval,
            ...(query.aggregate ? { aggregate: query.aggregate } : {}),
            order: query.order,
            limit: requestLimit,
          });
          const batch =
            query.interval === 'raw'
              ? normalizeRawHistory({
                  upstream,
                  stationCode: station.upstreamCode,
                  fields: query.fields,
                  begin: new Date(requestBegin),
                  end: new Date(requestEnd),
                  order: query.order,
                })
              : undefined;
          const value =
            batch?.rawCount === 0
              ? {
                  stationId: station.id,
                  series: [],
                  fetchedAt: now.toISOString(),
                  nextCursor: null,
                }
              : mapHistoryPage({
                  stationId: station.id,
                  stationCode: station.upstreamCode,
                  upstream,
                  fields: query.fields,
                  order: query.order,
                  limit: query.limit,
                  queryFingerprint,
                  ...(continuation
                    ? {
                        boundaryFingerprint: continuation.boundaryFingerprint,
                        boundaryOccurrence: continuation.boundaryOccurrence,
                      }
                    : {}),
                  fetchedAt: now,
                });
          if (batch)
            await this.readings?.ingestHistory(
              station,
              batch,
              now,
              batch.rawCount < requestLimit
                ? { begin: new Date(requestBegin), end: new Date(requestEnd) }
                : undefined,
            );
          return value;
        },
        !this.storedHistory,
      );
      const coverage = this.storedHistory
        ? await this.storedHistory.getCoverage(station, query)
        : undefined;
      if (!cacheResult.isFromCache)
        await this.sourceClients?.markConnected(station.dataSourceId, now);
      return {
        stationId: cacheResult.value.stationId,
        dataOrigin: 'upstream',
        ...(coverage ? { coverage } : {}),
        measurement: 'soil',
        series: cacheResult.value.series,
        page: { nextCursor: cacheResult.value.nextCursor },
        fetchedAt: cacheResult.value.fetchedAt,
        isFromCache: cacheResult.isFromCache,
        isStale: cacheResult.isStale,
      };
    } catch (error) {
      if (
        !this.storedHistory ||
        query.cursor ||
        !(error instanceof AppError) ||
        ![
          'UPSTREAM_TIMEOUT',
          'UPSTREAM_UNAVAILABLE',
          'RATE_LIMITED',
          'UPSTREAM_INVALID_RESPONSE',
        ].includes(error.code)
      )
        throw error;
      const stored = await this.storedHistory.getHistory(station, query);
      if (!stored) throw error;
      return stored;
    }
  }
}
