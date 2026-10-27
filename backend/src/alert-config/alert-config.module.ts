import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { OperationsModule } from '../operations/operations.module.js';
import { StationDataModule } from '../station-data/station-data.module.js';
import { AlertRuleController } from './alert-rule.controller.js';
import { AlertEvaluationService } from './alert-evaluation.service.js';
import { AlertLifecycleController } from './alert-lifecycle.controller.js';
import { AlertLifecycleService } from './alert-lifecycle.service.js';
import { AlertRuleService } from './alert-rule.service.js';
import { DeviceConfigurationCapabilityController } from './device-configuration-capability.controller.js';

@Module({
  imports: [AuthModule, OperationsModule, StationDataModule],
  controllers: [
    AlertRuleController,
    AlertLifecycleController,
    DeviceConfigurationCapabilityController,
  ],
  providers: [AlertRuleService, AlertEvaluationService, AlertLifecycleService],
  exports: [AlertRuleService, AlertEvaluationService, AlertLifecycleService],
})
export class AlertConfigModule {}
