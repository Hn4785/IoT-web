import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

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
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const rawKey = request.headers['x-api-key'];
    if (typeof rawKey !== 'string') {
      clearRateLimitHeaders(reply);
      throw new AppError('INVALID_API_KEY', 401, 'API key is invalid');
    }
    try {
      request.apiKeyPrincipal = await this.apiKeys.authenticateCredential(rawKey);
    } catch (error) {
      clearRateLimitHeaders(reply);
      throw error;
    }
    return true;
  }
}

function clearRateLimitHeaders(reply: FastifyReply): void {
  reply.removeHeader('X-RateLimit-Limit');
  reply.removeHeader('X-RateLimit-Remaining');
  reply.removeHeader('X-RateLimit-Reset');
}
