import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { OperationsMetrics } from './operations-signals.js';
import { ReadinessController } from './readiness.controller.js';
import { ReadinessService } from './readiness.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AuditController, ReadinessController],
  providers: [AuditService, OperationsMetrics, ReadinessService],
  exports: [OperationsMetrics],
})
export class OperationsModule {}
