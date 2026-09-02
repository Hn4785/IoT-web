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
import { RouteConfig } from '@nestjs/platform-fastify';

import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import {
  AllowPendingPasswordChange,
  CurrentPrincipal,
  type CurrentPrincipalValue,
} from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { parseChangePassword, parseLogin } from './auth.contracts.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  @RouteConfig({ rateLimit: { max: 20, timeWindow: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.login(parseLogin(body), request.id);
    this.setRefreshCookie(reply, result.refreshToken);
    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: result.user,
      },
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @RouteConfig({ rateLimit: { max: 20, timeWindow: 60_000 } })
  @AllowPendingPasswordChange()
  @Header('Cache-Control', 'no-store')
  async refresh(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    this.requireFrontendOrigin(request);
    const token = request.cookies[REFRESH_COOKIE];
    if (!token) throw new AppError('SESSION_EXPIRED', 401, 'Session is invalid or expired');
    const result = await this.sessions.rotate(token, request.id);
    this.setRefreshCookie(reply, result.refreshToken);
    return {
      success: true,
      data: { accessToken: result.accessToken, expiresIn: result.expiresIn },
    };
  }

  @Post('logout')
  @HttpCode(200)
  @AllowPendingPasswordChange()
  @Header('Cache-Control', 'no-store')
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    this.requireFrontendOrigin(request);
    await this.sessions.logout(request.cookies[REFRESH_COOKIE], request.id);
    reply.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    return { success: true, data: { loggedOut: true } };
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
      data: await this.auth.changePassword(principal, parseChangePassword(body), request.id),
    };
  }

  private requireFrontendOrigin(request: FastifyRequest): void {
    if (request.headers.origin !== this.config.frontendOrigin) {
      throw new AppError('FORBIDDEN', 403, 'Request origin is not allowed');
    }
  }

  private setRefreshCookie(reply: FastifyReply, token: string): void {
    reply.setCookie(REFRESH_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
    });
  }

  private cookieOptions() {
    return {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: this.config.nodeEnv === 'production',
      sameSite: 'strict' as const,
    };
  }
}
