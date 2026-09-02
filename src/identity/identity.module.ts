import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { SecurityAuditModule } from '../security-audit/security-audit.module.js';
import { IdentityController } from './identity.controller.js';
import { IdentityRepository } from './identity.repository.js';
import { IdentityService } from './identity.service.js';

@Module({
  imports: [AuthModule, SecurityAuditModule],
  controllers: [IdentityController],
  providers: [IdentityRepository, IdentityService],
})
export class IdentityModule {}
