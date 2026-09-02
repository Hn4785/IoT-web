import { Module } from '@nestjs/common';

import { AccessTokenService } from './access-token.service.js';
import { AdminAccessGuard } from './admin-access.guard.js';
import { PasswordService } from './password.service.js';

@Module({
  providers: [AccessTokenService, AdminAccessGuard, PasswordService],
  exports: [AccessTokenService, AdminAccessGuard, PasswordService],
})
export class AuthFoundationModule {}
