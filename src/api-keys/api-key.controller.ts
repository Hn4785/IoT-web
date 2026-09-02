import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import {
  CurrentPrincipal,
  type CurrentPrincipalValue,
} from '../authorization/current-principal.js';
import { parseApiKeyId, parseCreateApiKey } from './api-key.contracts.js';
import { ApiKeyService } from './api-key.service.js';

@ApiTags('developer-api-keys')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('developer/api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@CurrentPrincipal() principal: CurrentPrincipalValue) {
    return { success: true, data: { items: await this.apiKeys.list(principal) } };
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  async create(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.apiKeys.create(principal, parseCreateApiKey(body), request.id),
    };
  }

  @Post(':apiKeyId/rotate')
  @Header('Cache-Control', 'no-store')
  async rotate(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('apiKeyId') apiKeyId: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.apiKeys.rotate(principal, parseApiKeyId(apiKeyId), request.id),
    };
  }

  @Post(':apiKeyId/revoke')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async revoke(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('apiKeyId') apiKeyId: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.apiKeys.revoke(principal, parseApiKeyId(apiKeyId), request.id),
    };
  }
}
