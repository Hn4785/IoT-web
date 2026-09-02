import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { JwtService } from '../auth/jwt.service.js';
import { AppError } from '../common/errors/app-error.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  ALLOW_PENDING_PASSWORD_CHANGE,
  type RequestWithPrincipal,
} from './current-principal.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ') || authorization.length > 4103) {
      throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required');
    }
    const claims = await this.tokens.verify(authorization.slice('Bearer '.length));
    const session = await this.prisma.session.findUnique({
      where: { id: claims.sessionId },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            role: true,
            status: true,
            heldAuthority: { select: { authority: true } },
          },
        },
      },
    });
    if (
      !session ||
      session.userId !== claims.userId ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new AppError('SESSION_EXPIRED', 401, 'Session is invalid or expired');
    }
    if (session.user.status === 'DISABLED') {
      throw new AppError('ACCOUNT_DISABLED', 403, 'Account is disabled');
    }
    const allowPending = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_PASSWORD_CHANGE,
      [context.getHandler(), context.getClass()],
    );
    if (session.user.status === 'PENDING_PASSWORD_CHANGE' && !allowPending) {
      throw new AppError('PASSWORD_CHANGE_REQUIRED', 403, 'Password change is required');
    }
    request.principal = {
      userId: session.user.id,
      sessionId: session.id,
      role: session.user.role,
      status: session.user.status,
      isSuperAdmin: session.user.heldAuthority?.authority === 'SUPER_ADMIN',
    };
    return true;
  }
}
