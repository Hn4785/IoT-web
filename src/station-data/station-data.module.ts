import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { WeatherModule } from '../integrations/weather/weather.module.js';
import {
  BoundedAsyncCache,
  HISTORY_SOIL_CACHE,
  LATEST_SOIL_CACHE,
  STATION_DATA_CLOCK,
  type StationDataClock,
} from './bounded-cache.js';
import { BrowserStationController } from './browser.controller.js';
import { HierarchyService } from './hierarchy.service.js';
import {
  SOIL_METADATA_PROVIDER,
  UnconfirmedSoilMetadataProvider,
} from './soil-metadata.provider.js';
import type { NormalizedHistoryPage, NormalizedLatestSoil } from './station-data.contracts.js';
import { StationDataService } from './station-data.service.js';
import { StationRepository } from './station.repository.js';

@Module({
  imports: [AuthModule, WeatherModule],
  controllers: [BrowserStationController],
  providers: [
    StationRepository,
    HierarchyService,
    StationDataService,
    {
      provide: STATION_DATA_CLOCK,
      useValue: { now: () => new Date() },
    },
    {
      provide: LATEST_SOIL_CACHE,
      inject: [RUNTIME_CONFIG, STATION_DATA_CLOCK],
      useFactory: (config: RuntimeConfig, clock: StationDataClock) =>
        new BoundedAsyncCache<NormalizedLatestSoil>({
          ttlMs: config.soilLatestCacheTtlMs,
          staleIfErrorMs: config.soilStaleIfErrorMs,
          maxEntries: config.soilCacheMaxEntries,
          now: () => clock.now().getTime(),
        }),
    },
    {
      provide: HISTORY_SOIL_CACHE,
      inject: [RUNTIME_CONFIG, STATION_DATA_CLOCK],
      useFactory: (config: RuntimeConfig, clock: StationDataClock) =>
        new BoundedAsyncCache<NormalizedHistoryPage>({
          ttlMs: config.soilHistoryCacheTtlMs,
          staleIfErrorMs: config.soilStaleIfErrorMs,
          maxEntries: config.soilCacheMaxEntries,
          now: () => clock.now().getTime(),
        }),
    },
    {
      provide: SOIL_METADATA_PROVIDER,
      useClass: UnconfirmedSoilMetadataProvider,
    },
  ],
  exports: [StationRepository, HierarchyService, StationDataService, SOIL_METADATA_PROVIDER],
})
export class StationDataModule {}
