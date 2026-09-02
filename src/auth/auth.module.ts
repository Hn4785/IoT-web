import { Module } from '@nestjs/common';

import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { SecurityAuditModule } from '../security-audit/security-audit.module.js';
import { AdminAccessGuard } from './admin-access.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtService } from './jwt.service.js';
import { PasswordService } from './password.service.js';
import { SessionRepository } from './session.repository.js';
import { SessionService } from './session.service.js';
import { TOKEN_HASH_SERVICE, TokenHashService } from './token-hash.service.js';

@Module({
  imports: [SecurityAuditModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtService,
    PasswordService,
    AccessTokenGuard,
    AdminAccessGuard,
    SessionRepository,
    SessionService,
    {
      provide: TOKEN_HASH_SERVICE,
      inject: [RUNTIME_CONFIG],
      useFactory: (config: RuntimeConfig) => new TokenHashService(config.credentialPepper),
    },
  ],
  exports: [
    JwtService,
    PasswordService,
    SessionService,
    AccessTokenGuard,
    AdminAccessGuard,
    TOKEN_HASH_SERVICE,
  ],
})
export class AuthModule {}
