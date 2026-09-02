import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { AppError } from '../common/errors/app-error.js';
import { PrismaService } from '../database/prisma.service.js';
import { AccessTokenService } from './access-token.service.js';
import type { CurrentPrincipalValue } from './current-principal.js';

type RequestWithPrincipal = {
  headers: { authorization?: string };
  principal?: CurrentPrincipalValue;
};

@Injectable()
export class AdminAccessGuard implements CanActivate {
  constructor(
    private readonly tokens: AccessTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required');
    }

    const userId = await this.tokens.verify(authorization.slice('Bearer '.length));
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        heldAuthority: { select: { authority: true } },
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required');
    }
    if (user.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 403, 'Administrator access is required');
    }

    request.principal = {
      userId: user.id,
      role: 'ADMIN',
      isSuperAdmin: user.heldAuthority?.authority === 'SUPER_ADMIN',
    };
    return true;
  }
}
