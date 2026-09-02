import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import {
  AllowPendingPasswordChange,
  CurrentPrincipal,
  type CurrentPrincipalValue,
} from '../authorization/current-principal.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { parseChangePassword, parseLogin } from './auth.contracts.js';
import { AuthService } from './auth.service.js';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.login(parseLogin(body), request.id);
    reply.setCookie('refreshToken', result.refreshToken, {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: this.config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
    });
    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: result.user,
      },
    };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @AllowPendingPasswordChange()
  @Header('Cache-Control', 'no-store')
  async me(@CurrentPrincipal() principal: CurrentPrincipalValue) {
    return { success: true, data: await this.auth.me(principal) };
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @AllowPendingPasswordChange()
  @Header('Cache-Control', 'no-store')
  async changePassword(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      data: await this.auth.changePassword(
        principal,
        parseChangePassword(body),
        request.id,
      ),
    };
  }
}
