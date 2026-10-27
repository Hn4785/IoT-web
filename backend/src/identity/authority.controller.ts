import { Body, Controller, Header, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { RouteConfig } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';

import { AdminAccessGuard } from '../auth/admin-access.guard.js';
import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import {
  CurrentPrincipal,
  type CurrentPrincipalValue,
} from '../authorization/current-principal.js';
import { parseTransferSuperAdmin, transferSuperAdminOpenApiSchema } from './authority.contracts.js';
import { AuthorityService } from './authority.service.js';

@ApiTags('super-admin')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, AdminAccessGuard)
@Controller('admin/super-admin')
export class AuthorityController {
  constructor(private readonly authority: AuthorityService) {}

  @Post('transfer')
  @ApiBody({ schema: transferSuperAdminOpenApiSchema })
  @HttpCode(200)
  @RouteConfig({ rateLimit: { max: 10, timeWindow: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async transfer(
    @CurrentPrincipal() actor: CurrentPrincipalValue,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.authority.transfer(actor, parseTransferSuperAdmin(body), request.id),
    };
  }
}
