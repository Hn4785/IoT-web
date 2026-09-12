import { Controller, Get, Inject } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';

export class HealthDataResponse {
  @ApiProperty({ example: 'iot-api', enum: ['iot-api'] })
  readonly service!: 'iot-api';

  @ApiProperty({ example: '0.1.0', enum: ['0.1.0'] })
  readonly version!: '0.1.0';

  @ApiProperty({ example: 'healthy', enum: ['healthy'] })
  readonly status!: 'healthy';

  @ApiProperty({ example: 'development', enum: ['development', 'test', 'production'] })
  readonly environment!: RuntimeConfig['nodeEnv'];

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z', format: 'date-time' })
  readonly time!: string;
}

export class HealthResponse {
  @ApiProperty({ example: true, enum: [true] })
  readonly success!: true;

  @ApiProperty({ type: HealthDataResponse })
  readonly data!: HealthDataResponse;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig) {}

  @Get()
  @RouteConfig({ rateLimit: false })
  @ApiOkResponse({
    description: 'Service is alive and ready to receive requests',
    type: HealthResponse,
  })
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
