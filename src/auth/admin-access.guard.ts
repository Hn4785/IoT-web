import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { AppError } from '../common/errors/app-error.js';
import type { RequestWithPrincipal } from '../authorization/current-principal.js';

@Injectable()
export class AdminAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    if (request.principal?.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 403, 'Administrator access is required');
    }
    return true;
  }
}
