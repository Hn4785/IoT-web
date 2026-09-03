import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import {
  CurrentPrincipal,
  type CurrentPrincipalValue,
} from '../authorization/current-principal.js';
import { HierarchyService } from './hierarchy.service.js';
import {
  farmOpenApiSchema,
  hierarchyCursorOpenApiSchema,
  hierarchyLimitOpenApiSchema,
  parseHierarchyQuery,
  parseUuid,
  plotOpenApiSchema,
  stationOpenApiSchema,
} from './station-data.contracts.js';

const pageSchema = (item: object) => ({
  type: 'object' as const,
  additionalProperties: false,
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean' as const, enum: [true] },
    data: {
      type: 'object' as const,
      additionalProperties: false,
      required: ['items', 'nextCursor'],
      properties: {
        items: { type: 'array' as const, items: item },
        nextCursor: { type: 'string' as const, nullable: true, maxLength: 2048 },
      },
    },
  },
});

@ApiTags('station-data')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class BrowserStationController {
  constructor(private readonly hierarchy: HierarchyService) {}

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
}
