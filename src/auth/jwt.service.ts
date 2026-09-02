import { Inject, Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';

import { AppError } from '../common/errors/app-error.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';

export type AccessTokenClaims = Readonly<{ userId: string; sessionId: string }>;

@Injectable()
export class JwtService {
  private readonly key: Uint8Array;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    this.key = new TextEncoder().encode(config.jwtSecret);
  }

  async sign(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ sessionId: claims.sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer('iot-api')
      .setAudience('iot-web')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(this.key);
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        issuer: 'iot-api',
        audience: 'iot-web',
      });
      if (!payload.sub || typeof payload.sessionId !== 'string') {
        throw new Error('Invalid access token claims');
      }
      return { userId: payload.sub, sessionId: payload.sessionId };
    } catch {
      throw new AppError('SESSION_EXPIRED', 401, 'Session is invalid or expired');
    }
  }
}
