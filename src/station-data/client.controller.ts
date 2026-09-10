import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import { ApiKeyGuard, type ApiKeyRequest } from '../api-keys/api-key.guard.js';
import { AppError } from '../common/errors/app-error.js';
import { ClientRateLimitGuard } from './client-rate-limit.guard.js';
import { HierarchyService } from './hierarchy.service.js';
import {
  cursorPageOpenApiSchema,
  hierarchyLimitOpenApiSchema,
  parseHierarchyQuery,
  parseLatestSoilQuery,
  parseSoilHistoryQuery,
  parseStationCode,
  stationOpenApiSchema,
} from './station-data.contracts.js';
import { StationDataService } from './station-data.service.js';

@ApiTags('station-data')
@ApiSecurity('apiKey')
@UseGuards(ApiKeyGuard, ClientRateLimitGuard)
@Controller('client')
export class ClientController {
  constructor(
    private readonly hierarchy: HierarchyService,
    private readonly stationDataService: StationDataService,
  ) {}

  @Get('stations')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List client-accessible stations' })
  @ApiHeader({ name: 'X-API-Key', required: true })
  @ApiQuery({ name: 'limit', required: false, schema: hierarchyLimitOpenApiSchema })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string' } })
  @ApiOkResponse({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['success', 'data'],
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: cursorPageOpenApiSchema(stationOpenApiSchema),
      },
    },
  })
  async listStations(@Req() req: ApiKeyRequest, @Query() query: unknown) {
    const principal = req.apiKeyPrincipal;
    if (!principal) {
      throw new AppError('INVALID_API_KEY', 401, 'API key is invalid');
    }
    const validQuery = parseHierarchyQuery(query);
    return {
      success: true,
      data: await this.hierarchy.listClientStations(principal, validQuery),
    };
  }

  @Get('data/latest')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get latest soil data for station' })
  @ApiHeader({ name: 'X-API-Key', required: true })
  @ApiQuery({ name: 'station', required: true, schema: { type: 'string' } })
  @ApiQuery({ name: 'fields', required: false, schema: { type: 'string' } })
  @ApiOkResponse({ description: 'Latest soil sensor readings' })
  async getLatestSoil(@Req() req: ApiKeyRequest, @Query() query: Record<string, unknown>) {
    const principal = req.apiKeyPrincipal;
    if (!principal) {
      throw new AppError('INVALID_API_KEY', 401, 'API key is invalid');
    }
    const code = parseStationCode(query.station);
    const fieldsPayload = query.fields !== undefined ? { fields: query.fields } : {};
    const validQuery = parseLatestSoilQuery(fieldsPayload);
    const station = await this.hierarchy.requireClientStationByCode(principal, code);
    return {
      success: true,
      data: await this.stationDataService.getLatest(station, validQuery),
    };
  }

  @Get('data/history')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get soil history data for station' })
  @ApiHeader({ name: 'X-API-Key', required: true })
  @ApiQuery({ name: 'station', required: true, schema: { type: 'string' } })
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
  async getSoilHistory(@Req() req: ApiKeyRequest, @Query() query: Record<string, unknown>) {
    const principal = req.apiKeyPrincipal;
    if (!principal) {
      throw new AppError('INVALID_API_KEY', 401, 'API key is invalid');
    }
    const code = parseStationCode(query.station);
    const historyQueryRaw = { ...query };
    delete historyQueryRaw.station;
    const validQuery = parseSoilHistoryQuery(historyQueryRaw);
    const station = await this.hierarchy.requireClientStationByCode(principal, code);
    return {
      success: true,
      data: await this.stationDataService.getHistory(station, validQuery),
    };
  }
}
