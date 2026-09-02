import { Module } from '@nestjs/common';

import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { SecurityAuditModule } from '../security-audit/security-audit.module.js';
import { AdminAccessGuard } from './admin-access.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService, TOKEN_HASH_SERVICE } from './auth.service.js';
import { JwtService } from './jwt.service.js';
import { PasswordService } from './password.service.js';
import { TokenHashService } from './token-hash.service.js';

@Module({
  imports: [SecurityAuditModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtService,
    PasswordService,
    AccessTokenGuard,
    AdminAccessGuard,
    {
      provide: TOKEN_HASH_SERVICE,
      inject: [RUNTIME_CONFIG],
      useFactory: (config: RuntimeConfig) => new TokenHashService(config.credentialPepper),
    },
  ],
  exports: [JwtService, PasswordService, AccessTokenGuard, AdminAccessGuard, TOKEN_HASH_SERVICE],
})
export class AuthModule {}
