import { Module } from '@nestjs/common';

import { SecurityAuditService } from './security-audit.service.js';

@Module({ providers: [SecurityAuditService], exports: [SecurityAuditService] })
export class SecurityAuditModule {}
