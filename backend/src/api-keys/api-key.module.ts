import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { SecurityAuditModule } from '../security-audit/security-audit.module.js';
import { ApiKeyController } from './api-key.controller.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { ApiKeyService } from './api-key.service.js';

@Module({
  imports: [AuthModule, SecurityAuditModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyGuard, ApiKeyService],
  exports: [ApiKeyGuard, ApiKeyService],
})
export class ApiKeyModule {}
