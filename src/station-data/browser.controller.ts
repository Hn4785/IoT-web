import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import {
  CurrentPrincipal,
  type CurrentPrincipalValue,
} from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import { HierarchyService } from './hierarchy.service.js';
import {
  cursorPageOpenApiSchema,
  farmOpenApiSchema,
  hierarchyCursorOpenApiSchema,
  hierarchyLimitOpenApiSchema,
  parseHierarchyQuery,
  parseLatestSoilQuery,
  parseSoilHistoryQuery,
  parseUuid,
  plotOpenApiSchema,
  SOIL_FIELDS,
  stationOpenApiSchema,
} from './station-data.contracts.js';
import { StationDataService } from './station-data.service.js';
import { StationRepository } from './station.repository.js';

const pageSchema = (item: object) => ({
  type: 'object' as const,
  additionalProperties: false,
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean' as const, enum: [true] },
    data: cursorPageOpenApiSchema(item),
  },
});

@ApiTags('station-data')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class BrowserStationController {
  constructor(
    private readonly hierarchy: HierarchyService,
    private readonly stationRepository: StationRepository,
    private readonly stationDataService: StationDataService,
  ) {}

  @Get('farms')
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'limit', required: false, schema: hierarchyLimitOpenApiSchema })
  @ApiQuery({ name: 'cursor', required: false, schema: hierarchyCursorOpenApiSchema })
  @ApiOkResponse({ schema: pageSchema(farmOpenApiSchema) })
  async listFarms(@CurrentPrincipal() principal: CurrentPrincipalValue, @Query() query: unknown) {
    return {
      success: true,
      data: await this.hierarchy.listFarms(principal, parseHierarchyQuery(query)),
    };
  }

  @Get('farms/:farmId/plots')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'farmId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'limit', required: false, schema: hierarchyLimitOpenApiSchema })
  @ApiQuery({ name: 'cursor', required: false, schema: hierarchyCursorOpenApiSchema })
  @ApiOkResponse({ schema: pageSchema(plotOpenApiSchema) })
  async listPlots(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('farmId') farmId: string,
    @Query() query: unknown,
  ) {
    return {
      success: true,
      data: await this.hierarchy.listPlots(
        principal,
        parseUuid(farmId),
        parseHierarchyQuery(query),
      ),
    };
  }

  @Get('plots/:plotId/stations')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'plotId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'limit', required: false, schema: hierarchyLimitOpenApiSchema })
  @ApiQuery({ name: 'cursor', required: false, schema: hierarchyCursorOpenApiSchema })
  @ApiOkResponse({ schema: pageSchema(stationOpenApiSchema) })
  async listStations(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('plotId') plotId: string,
    @Query() query: unknown,
  ) {
    return {
      success: true,
      data: await this.hierarchy.listStations(
        principal,
        parseUuid(plotId),
        parseHierarchyQuery(query),
      ),
    };
  }

  @Get('stations/:stationId')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'stationId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['success', 'data'],
      properties: { success: { type: 'boolean', enum: [true] }, data: stationOpenApiSchema },
    },
  })
  async getStation(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('stationId') stationId: string,
  ) {
    return {
      success: true,
      data: await this.hierarchy.getStation(principal, parseUuid(stationId)),
    };
  }

  @Get('stations/:stationId/data/latest')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'stationId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({
    name: 'fields',
    required: false,
    schema: {
      type: 'string',
      description: 'Comma-separated soil fields',
      example: 'temperature,moisture',
    },
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['success', 'data'],
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          additionalProperties: false,
          required: ['station', 'measurement', 'fields', 'fetchedAt', 'isFromCache', 'isStale'],
          properties: {
            station: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'name', 'code'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                code: { type: 'string' },
              },
            },
            measurement: { type: 'string', enum: ['soil'] },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'field',
                  'value',
                  'unit',
                  'observedAt',
                  'quality',
                  'sensorId',
                  'depthCm',
                ],
                properties: {
                  field: { type: 'string', enum: [...SOIL_FIELDS] },
                  value: { type: 'number' },
                  unit: { type: 'string', nullable: true },
                  observedAt: { type: 'string', format: 'date-time' },
                  quality: { type: 'string', enum: ['good', 'stale', 'unknown'] },
                  sensorId: { type: 'string', nullable: true },
                  depthCm: { type: 'number', nullable: true },
                },
              },
            },
            fetchedAt: { type: 'string', format: 'date-time' },
            isFromCache: { type: 'boolean' },
            isStale: { type: 'boolean' },
          },
        },
      },
    },
  })
  async getLatestSoil(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('stationId') stationId: string,
    @Query() query: unknown,
  ) {
    const validStationId = parseUuid(stationId);
    const validQuery = parseLatestSoilQuery(query);
    if (principal.status !== 'ACTIVE' || !['ADMIN', 'FARMER'].includes(principal.role)) {
      throw new AppError('FORBIDDEN', 403, 'Access is forbidden');
    }
    const station = await this.stationRepository.getAuthorizedStation(principal, validStationId);
    if (!station) {
      throw new AppError('NOT_FOUND', 404, 'Resource not found');
    }
    return {
      success: true,
      data: await this.stationDataService.getLatest(station, validQuery),
    };
  }

  @Get('stations/:stationId/data/history')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'stationId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'fields', required: false, schema: { type: 'string' } })
  @ApiQuery({ name: 'begin', required: true, schema: { type: 'string', format: 'date-time' } })
  @ApiQuery({ name: 'end', required: true, schema: { type: 'string', format: 'date-time' } })
  @ApiQuery({ name: 'interval', required: false, enum: ['raw', '5m', '30m', '1h', '1d'] })
  @ApiQuery({ name: 'aggregate', required: false, enum: ['mean', 'min', 'max', 'first', 'last'] })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 500 },
  })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string', maxLength: 2048 } })
  @ApiOkResponse({ description: 'Bounded soil history grouped into per-field series' })
  async getSoilHistory(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('stationId') stationId: string,
    @Query() query: unknown,
  ) {
    const validStationId = parseUuid(stationId);
    const validQuery = parseSoilHistoryQuery(query);
    if (principal.status !== 'ACTIVE' || !['ADMIN', 'FARMER'].includes(principal.role)) {
      throw new AppError('FORBIDDEN', 403, 'Access is forbidden');
    }
    const station = await this.stationRepository.getAuthorizedStation(principal, validStationId);
    if (!station) throw new AppError('NOT_FOUND', 404, 'Resource not found');
    return {
      success: true,
      data: await this.stationDataService.getHistory(station, validQuery),
    };
  }
}
