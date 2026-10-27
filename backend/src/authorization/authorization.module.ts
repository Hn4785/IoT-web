import { Module } from '@nestjs/common';

import { AuthorizationPolicy } from './authorization.policy.js';
import { ScopeRepository } from './scope.repository.js';
import { ScopeService } from './scope.service.js';

@Module({
  providers: [AuthorizationPolicy, ScopeRepository, ScopeService],
  exports: [AuthorizationPolicy, ScopeService],
})
export class AuthorizationModule {}
