import { Controller, Get, Inject } from '@nestjs/common';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';

export type HealthResponse = Readonly<{
  success: true;
  data: Readonly<{
    service: 'iot-api';
    version: '0.1.0';
    status: 'healthy';
    environment: RuntimeConfig['nodeEnv'];
    time: string;
  }>;
}>;

@Controller('health')
export class HealthController {
  constructor(@Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig) {}

  @Get()
  getHealth(): HealthResponse {
    return {
      success: true,
      data: {
        service: 'iot-api',
        version: '0.1.0',
        status: 'healthy',
        environment: this.config.nodeEnv,
        time: new Date().toISOString(),
      },
    };
  }
}
