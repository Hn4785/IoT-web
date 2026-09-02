import { Inject, Injectable } from '@nestjs/common';
import { jwtVerify } from 'jose';

import { AppError } from '../common/errors/app-error.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';

@Injectable()
export class AccessTokenService {
  private readonly key: Uint8Array;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    this.key = new TextEncoder().encode(config.jwtSecret);
  }

  async verify(token: string): Promise<string> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        issuer: 'iot-api',
        audience: 'iot-web',
      });
      if (!payload.sub || payload.tokenType !== 'access') {
        throw new Error('Invalid access token claims');
      }
      return payload.sub;
    } catch {
      throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required');
    }
  }
}
