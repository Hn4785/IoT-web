import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import {
  CurrentPrincipal,
  type CurrentPrincipalValue,
} from '../authorization/current-principal.js';
import { parseAlertAction, parseAlertId, parseListAlerts } from './alert-lifecycle.contracts.js';
import { AlertLifecycleService } from './alert-lifecycle.service.js';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('alerts')
export class AlertLifecycleController {
  constructor(private readonly alerts: AlertLifecycleService) {}

  @Get()
  @ApiOkResponse({ description: 'Scoped alerts' })
  async list(@CurrentPrincipal() principal: CurrentPrincipalValue, @Query() query: unknown) {
    return { success: true, data: await this.alerts.list(principal, parseListAlerts(query)) };
  }

  @Get(':alertId')
  @ApiParam({ name: 'alertId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Alert detail' })
  async get(@CurrentPrincipal() principal: CurrentPrincipalValue, @Param('alertId') id: string) {
    return { success: true, data: await this.alerts.get(principal, parseAlertId(id)) };
  }

  @Post(':alertId/acknowledgements')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async acknowledge(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('alertId') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.alerts.acknowledge(
        principal,
        parseAlertId(id),
        key ?? '',
        parseAlertAction(body),
        request.id,
      ),
    };
  }

  @Post(':alertId/resolutions')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async resolve(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('alertId') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.alerts.resolve(
        principal,
        parseAlertId(id),
        key ?? '',
        parseAlertAction(body),
        request.id,
      ),
    };
  }
}
