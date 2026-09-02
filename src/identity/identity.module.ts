import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { SecurityAuditModule } from '../security-audit/security-audit.module.js';
import { IdentityController } from './identity.controller.js';
import { AuthorityController } from './authority.controller.js';
import { AuthorityService } from './authority.service.js';
import { IdentityRepository } from './identity.repository.js';
import { IdentityService } from './identity.service.js';

@Module({
  imports: [AuthModule, AuthorizationModule, SecurityAuditModule],
  controllers: [AuthorityController, IdentityController],
  providers: [AuthorityService, IdentityRepository, IdentityService],
})
export class IdentityModule {}
