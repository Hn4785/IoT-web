import { DynamicModule, Global, Module } from '@nestjs/common';

import type { RuntimeConfig } from './runtime-config.js';

export const RUNTIME_CONFIG = Symbol('RUNTIME_CONFIG');

@Global()
@Module({})
export class RuntimeConfigModule {
  static register(config: RuntimeConfig): DynamicModule {
    return {
      module: RuntimeConfigModule,
      providers: [{ provide: RUNTIME_CONFIG, useValue: config }],
      exports: [RUNTIME_CONFIG],
    };
  }
}
