import { Inject, Injectable, Optional } from '@nestjs/common';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { WeatherClientService } from '../integrations/weather/weather-client.service.js';
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
    const now = this.clock.now();
    const key = `latest:${station.upstreamCode}:${[...query.fields].sort().join(',')}`;

    const cacheResult = await this.cache.get(key, async () => {
      const upstream = await this.weather.getLatest({
        station: [station.upstreamCode],
        type: ['soil'],
        fields: [...query.fields],
      });
      return mapLatestSoil({
        station,
        upstream,
        fields: query.fields,
        fetchedAt: now,
      });
    });

    return toLatestSoilDto(cacheResult.value, now, this.config.soilStaleAfterMs, cacheResult);
  }

  async getHistory(station: AuthorizedStation, query: SoilHistoryQuery): Promise<SoilHistoryDto> {
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
      stationCode: station.upstreamCode,
      query: queryWithoutCursor,
    });
    const continuation = query.cursor
      ? decodeHistoryCursor(query.cursor, queryFingerprint)
      : undefined;
    const key = `history:${station.upstreamCode}:${queryFingerprint}:${query.cursor ?? 'start'}`;
    const cacheResult = await this.historyCache.get(key, async () => {
      const upstream = await this.weather.getHistory({
        station: [station.upstreamCode],
        type: ['soil'],
        fields: [...query.fields],
        begin: query.order === 'asc' && continuation ? continuation.boundaryTime : query.begin,
        end: query.order === 'desc' && continuation ? continuation.boundaryTime : query.end,
        interval: query.interval,
        ...(query.aggregate ? { aggregate: query.aggregate } : {}),
        order: query.order,
        limit: Math.min(5000, query.limit * 2 + 1),
      });
      return mapHistoryPage({
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
    });
    return {
      stationId: cacheResult.value.stationId,
      measurement: 'soil',
      series: cacheResult.value.series,
      page: { nextCursor: cacheResult.value.nextCursor },
      fetchedAt: cacheResult.value.fetchedAt,
      isFromCache: cacheResult.isFromCache,
      isStale: cacheResult.isStale,
    };
  }
}
