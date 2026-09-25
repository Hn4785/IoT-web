import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { OperationsModule } from '../operations/operations.module.js';
import { NotificationController } from './notification.controller.js';
import { NotificationDeliveryWorker } from './notification-delivery.worker.js';
import { NotificationService } from './notification.service.js';

@Module({
  imports: [AuthModule, OperationsModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationDeliveryWorker],
  exports: [NotificationService],
})
export class NotificationModule {}
