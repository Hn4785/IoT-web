import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import {
  CurrentPrincipal,
  type CurrentPrincipalValue,
} from '../authorization/current-principal.js';
import {
  alertActionOpenApiSchema,
  alertEnvelopeOpenApiSchema,
  alertPageEnvelopeOpenApiSchema,
  parseAlertAction,
  parseAlertId,
  parseListAlerts,
} from './alert-lifecycle.contracts.js';
import { AlertLifecycleService } from './alert-lifecycle.service.js';

const errorResponses = () =>
  applyDecorators(
    ApiResponse({ status: 400, description: 'Invalid request' }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 403, description: 'Access forbidden' }),
    ApiResponse({ status: 404, description: 'Resource not found' }),
    ApiResponse({ status: 409, description: 'State conflict' }),
  );

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('alerts')
export class AlertLifecycleController {
  constructor(private readonly alerts: AlertLifecycleService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'stationId', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] })
  @ApiQuery({ name: 'severity', required: false, enum: ['WARNING', 'CRITICAL'] })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100 },
  })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string', maxLength: 2048 } })
  @ApiOkResponse({ schema: alertPageEnvelopeOpenApiSchema })
  @errorResponses()
  async list(@CurrentPrincipal() principal: CurrentPrincipalValue, @Query() query: unknown) {
    return { success: true, data: await this.alerts.list(principal, parseListAlerts(query)) };
  }

  @Get(':alertId')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'alertId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ schema: alertEnvelopeOpenApiSchema })
  @errorResponses()
  async get(@CurrentPrincipal() principal: CurrentPrincipalValue, @Param('alertId') id: string) {
    return { success: true, data: await this.alerts.get(principal, parseAlertId(id)) };
  }

  @Post(':alertId/acknowledgements')
  @Header('Cache-Control', 'no-store')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ schema: alertActionOpenApiSchema })
  @ApiCreatedResponse({ schema: alertEnvelopeOpenApiSchema })
  @errorResponses()
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
  @Header('Cache-Control', 'no-store')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ schema: alertActionOpenApiSchema })
  @ApiCreatedResponse({ schema: alertEnvelopeOpenApiSchema })
  @errorResponses()
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
