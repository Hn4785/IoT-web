import {
  Body,
  applyDecorators,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
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
  parseAlertRuleId,
  parseCreateAlertRule,
  parseListAlertRulesQuery,
  parsePatchAlertRule,
} from './alert-rule.contracts.js';
import { AlertRuleService } from './alert-rule.service.js';

const errorResponses = () =>
  applyDecorators(
    ApiResponse({ status: 400, description: 'Invalid request' }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 403, description: 'Access forbidden' }),
    ApiResponse({ status: 404, description: 'Resource not found' }),
    ApiResponse({ status: 409, description: 'State conflict' }),
  );

@ApiTags('alert-rules')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class AlertRuleController {
  constructor(private readonly rules: AlertRuleService) {}

  @Get('stations/:stationId/alert-rules')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'stationId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100 },
  })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string', maxLength: 2048 } })
  @ApiOkResponse({ description: 'Alert rules page' })
  @errorResponses()
  async list(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('stationId') stationId: string,
    @Query() query: unknown,
  ) {
    return {
      success: true,
      data: await this.rules.listRules(
        principal,
        parseAlertRuleId(stationId),
        parseListAlertRulesQuery(query),
      ),
    };
  }

  @Post('stations/:stationId/alert-rules')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'stationId', schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', maxLength: 160 },
  })
  @ApiBody({ description: 'Alert rule definition' })
  @ApiCreatedResponse({ description: 'Created or replayed alert rule' })
  @errorResponses()
  async create(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('stationId') stationId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    return {
      success: true,
      data: await this.rules.createRule(
        principal,
        parseAlertRuleId(stationId),
        idempotencyKey ?? '',
        parseCreateAlertRule(body),
      ),
    };
  }

  @Get('alert-rules/:ruleId')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'ruleId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Alert rule' })
  @errorResponses()
  async get(@CurrentPrincipal() principal: CurrentPrincipalValue, @Param('ruleId') ruleId: string) {
    return { success: true, data: await this.rules.getRule(principal, parseAlertRuleId(ruleId)) };
  }

  @Patch('alert-rules/:ruleId')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'ruleId', schema: { type: 'string', format: 'uuid' } })
  @ApiBody({ description: 'Alert rule patch with expectedRevision' })
  @ApiOkResponse({ description: 'Updated alert rule' })
  @errorResponses()
  async patch(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('ruleId') ruleId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.rules.patchRule(
        principal,
        parseAlertRuleId(ruleId),
        parsePatchAlertRule(body),
        request.id,
      ),
    };
  }
}
