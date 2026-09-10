import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { AppError } from '../common/errors/app-error.js';
import type { ApiKeyPrincipal } from './api-key.service.js';
import { ApiKeyService } from './api-key.service.js';

export type ApiKeyRequest = {
  headers: { 'x-api-key'?: string | string[] };
  apiKeyPrincipal?: ApiKeyPrincipal;
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const rawKey = request.headers['x-api-key'];
    if (typeof rawKey !== 'string') {
      throw new AppError('INVALID_API_KEY', 401, 'API key is invalid');
    }
    request.apiKeyPrincipal = await this.apiKeys.authenticateCredential(rawKey);
    return true;
  }
}
