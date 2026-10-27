import { Controller, Get } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { ApiOkResponse, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AppError } from '../common/errors/app-error.js';
import { ReadinessService } from './readiness.service.js';

@ApiTags('health')
@Controller('readiness')
export class ReadinessController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get()
  @RouteConfig({ rateLimit: false })
  @ApiOkResponse({ description: 'Required local dependencies are ready' })
  @ApiResponse({ status: 503, description: 'A required local dependency is unavailable' })
  async getReadiness() {
    const database = await this.readiness.probe();
    if (database.status !== 'ready') {
      throw new AppError('DATABASE_UNAVAILABLE', 503, 'Database is temporarily unavailable');
    }
    return {
      success: true as const,
      data: { status: 'ready' as const, dependencies: { database } },
    };
  }
}
