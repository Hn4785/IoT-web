import { Body, Controller, Get, Header, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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
  parseListDataSources,
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
}
