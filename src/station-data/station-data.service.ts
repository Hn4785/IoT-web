import { Inject, Injectable, Optional } from '@nestjs/common';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { WeatherClientService } from '../integrations/weather/weather-client.service.js';
import {
  BoundedAsyncCache,
  LATEST_SOIL_CACHE,
  STATION_DATA_CLOCK,
  type StationDataClock,
} from './bounded-cache.js';
import { mapLatestSoil, toLatestSoilDto } from './soil.mapper.js';
import type {
  LatestSoilDataDto,
  LatestSoilQuery,
  NormalizedLatestSoil,
} from './station-data.contracts.js';
import type { AuthorizedStation } from './station.repository.js';

@Injectable()
export class StationDataService {
  private readonly cache: BoundedAsyncCache<NormalizedLatestSoil>;
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
}
