import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import {
  CurrentPrincipal,
  type CurrentPrincipalValue,
} from '../authorization/current-principal.js';
import { auditEventPageEnvelopeOpenApiSchema, parseListAuditEvents } from './audit.contracts.js';
import { AuditService } from './audit.service.js';

@ApiTags('operations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('admin/audit-events')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'targetType', required: false })
  @ApiQuery({ name: 'result', required: false, enum: ['SUCCESS', 'DENIED', 'FAILURE'] })
  @ApiQuery({ name: 'from', required: false, schema: { type: 'string', format: 'date-time' } })
  @ApiQuery({ name: 'to', required: false, schema: { type: 'string', format: 'date-time' } })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100 },
  })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string', maxLength: 2048 } })
  @ApiOkResponse({ schema: auditEventPageEnvelopeOpenApiSchema })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Super Admin required' })
  async list(@CurrentPrincipal() principal: CurrentPrincipalValue, @Query() query: unknown) {
    return { success: true, data: await this.audit.list(principal, parseListAuditEvents(query)) };
  }
}
