import { DynamicModule, Module } from '@nestjs/common';

import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { DatabaseModule } from '../database/database.module.js';
import { HealthModule } from '../health/health.module.js';
import { IdentityModule } from '../identity/identity.module.js';

@Module({})
export class AppModule {
  static register(config: RuntimeConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [RuntimeConfigModule.register(config), DatabaseModule, HealthModule, IdentityModule],
    };
  }
}
