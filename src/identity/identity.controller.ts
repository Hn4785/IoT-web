import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AdminAccessGuard } from '../auth/admin-access.guard.js';
import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import {
  CurrentPrincipal,
  type CurrentPrincipalValue,
} from '../authorization/current-principal.js';
import {
  createUserOpenApiSchema,
  parseCreateUser,
  parseListUsersQuery,
  parseUpdateUser,
  parseUserId,
  provisionUserOpenApiSchema,
  updateUserOpenApiSchema,
  userOpenApiSchema,
} from './identity.contracts.js';
import { IdentityService } from './identity.service.js';

@ApiTags('admin-users')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, AdminAccessGuard)
@Controller('admin/users')
export class IdentityController {
  constructor(private readonly identities: IdentityService) {}

  @Post()
  @ApiBody({ schema: createUserOpenApiSchema })
  @ApiCreatedResponse({ schema: provisionUserOpenApiSchema })
  async create(
    @CurrentPrincipal() actor: CurrentPrincipalValue,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    reply.header('cache-control', 'no-store');
    return {
      success: true,
      data: await this.identities.createUser(actor, parseCreateUser(body), request.id),
    };
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'cursor', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: userOpenApiSchema },
            nextCursor: { type: 'string', format: 'uuid', nullable: true },
          },
        },
      },
    },
  })
  async list(@Query() query: unknown) {
    return { success: true, data: await this.identities.listUsers(parseListUsersQuery(query)) };
  }

  @Get(':userId')
  @ApiParam({ name: 'userId', format: 'uuid' })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean', enum: [true] }, data: userOpenApiSchema },
    },
  })
  async get(@Param('userId') userId: string) {
    return { success: true, data: await this.identities.getUser(parseUserId(userId)) };
  }

  @Patch(':userId')
  @ApiParam({ name: 'userId', format: 'uuid' })
  @Header('Cache-Control', 'no-store')
  @ApiBody({ schema: updateUserOpenApiSchema })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean', enum: [true] }, data: userOpenApiSchema },
    },
  })
  async update(
    @CurrentPrincipal() actor: CurrentPrincipalValue,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.identities.updateUser(
        actor,
        parseUserId(userId),
        parseUpdateUser(body),
        request.id,
      ),
    };
  }

  @Post(':userId/reset-password')
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiCreatedResponse({ schema: provisionUserOpenApiSchema })
  async resetPassword(
    @CurrentPrincipal() actor: CurrentPrincipalValue,
    @Param('userId') userId: string,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    reply.header('cache-control', 'no-store');
    return {
      success: true,
      data: await this.identities.resetPassword(actor, parseUserId(userId), request.id),
    };
  }

  @Put(':userId/farm-memberships/:farmId')
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiParam({ name: 'farmId', format: 'uuid' })
  async assignFarmMembership(
    @CurrentPrincipal() actor: CurrentPrincipalValue,
    @Param('userId') userId: string,
    @Param('farmId') farmId: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.identities.setFarmMembership(
        actor,
        parseUserId(userId),
        parseUserId(farmId),
        true,
        request.id,
      ),
    };
  }

  @Delete(':userId/farm-memberships/:farmId')
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiParam({ name: 'farmId', format: 'uuid' })
  async removeFarmMembership(
    @CurrentPrincipal() actor: CurrentPrincipalValue,
    @Param('userId') userId: string,
    @Param('farmId') farmId: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.identities.setFarmMembership(
        actor,
        parseUserId(userId),
        parseUserId(farmId),
        false,
        request.id,
      ),
    };
  }

  @Put(':userId/station-grants/:stationId')
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiParam({ name: 'stationId', format: 'uuid' })
  async assignStationGrant(
    @CurrentPrincipal() actor: CurrentPrincipalValue,
    @Param('userId') userId: string,
    @Param('stationId') stationId: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.identities.setStationGrant(
        actor,
        parseUserId(userId),
        parseUserId(stationId),
        true,
        request.id,
      ),
    };
  }

  @Delete(':userId/station-grants/:stationId')
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiParam({ name: 'stationId', format: 'uuid' })
  async removeStationGrant(
    @CurrentPrincipal() actor: CurrentPrincipalValue,
    @Param('userId') userId: string,
    @Param('stationId') stationId: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.identities.setStationGrant(
        actor,
        parseUserId(userId),
        parseUserId(stationId),
        false,
        request.id,
      ),
    };
  }
}
