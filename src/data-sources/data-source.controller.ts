import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import {
  CurrentPrincipal,
  type CurrentPrincipalValue,
} from '../authorization/current-principal.js';
import {
  createDataSourceOpenApiSchema,
  dataSourceOpenApiSchema,
  parseCreateDataSource,
  parseDataSourceId,
  parseGrantUserId,
  parseListDataSources,
  parseRevealDataSource,
  parseSetDataSourceGrant,
  revealDataSourceOpenApiSchema,
  setDataSourceGrantOpenApiSchema,
} from './data-source.contracts.js';
import { DataSourceService } from './data-source.service.js';

@ApiTags('data-sources')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('data-sources')
export class DataSourceController {
  constructor(private readonly sources: DataSourceService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiBody({ schema: createDataSourceOpenApiSchema })
  @ApiCreatedResponse({
    schema: { properties: { success: { enum: [true] }, data: dataSourceOpenApiSchema } },
  })
  async create(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.sources.create(principal, parseCreateDataSource(body), request.id),
    };
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Sources visible to the current Admin or Farmer' })
  async list(@CurrentPrincipal() principal: CurrentPrincipalValue, @Query() query: unknown) {
    return { success: true, data: await this.sources.list(principal, parseListDataSources(query)) };
  }

  @Get(':sourceId')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    schema: { properties: { success: { enum: [true] }, data: dataSourceOpenApiSchema } },
  })
  async get(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('sourceId') sourceId: string,
  ) {
    return { success: true, data: await this.sources.get(principal, parseDataSourceId(sourceId)) };
  }

  @Put(':sourceId/grants/:userId')
  @Header('Cache-Control', 'no-store')
  async grant(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('sourceId') sourceId: string,
    @Param('userId') userId: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.sources.setGrant(
        principal,
        parseDataSourceId(sourceId),
        parseGrantUserId(userId),
        true,
        request.id,
      ),
    };
  }

  @Put(':sourceId/grants/:userId/stations')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ schema: setDataSourceGrantOpenApiSchema })
  async setGrantStations(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('sourceId') sourceId: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.sources.setGrantStations(
        principal,
        parseDataSourceId(sourceId),
        parseGrantUserId(userId),
        parseSetDataSourceGrant(body),
        request.id,
      ),
    };
  }

  @Get(':sourceId/grants')
  @Header('Cache-Control', 'no-store')
  async listGrants(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('sourceId') sourceId: string,
    @Query() query: unknown,
  ) {
    return {
      success: true,
      data: await this.sources.listGrants(
        principal,
        parseDataSourceId(sourceId),
        parseListDataSources(query),
      ),
    };
  }

  @Delete(':sourceId/grants/:userId')
  @Header('Cache-Control', 'no-store')
  async revoke(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('sourceId') sourceId: string,
    @Param('userId') userId: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.sources.setGrant(
        principal,
        parseDataSourceId(sourceId),
        parseGrantUserId(userId),
        false,
        request.id,
      ),
    };
  }

  @Delete(':sourceId/grants/:userId/stations/:stationId')
  @Header('Cache-Control', 'no-store')
  async revokeGrantStation(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('sourceId') sourceId: string,
    @Param('userId') userId: string,
    @Param('stationId') stationId: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.sources.revokeGrantStation(
        principal,
        parseDataSourceId(sourceId),
        parseGrantUserId(userId),
        parseDataSourceId(stationId),
        request.id,
      ),
    };
  }

  @Post(':sourceId/reveal')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ schema: revealDataSourceOpenApiSchema })
  async reveal(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('sourceId') sourceId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.sources.reveal(
        principal,
        parseDataSourceId(sourceId),
        parseRevealDataSource(body),
        request.id,
      ),
    };
  }

  @Post(':sourceId/test')
  @Header('Cache-Control', 'no-store')
  async testConnection(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('sourceId') sourceId: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.sources.testConnection(principal, parseDataSourceId(sourceId), request.id),
    };
  }
}
