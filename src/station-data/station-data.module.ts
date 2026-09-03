import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { BrowserStationController } from './browser.controller.js';
import { HierarchyService } from './hierarchy.service.js';
import { StationRepository } from './station.repository.js';

@Module({
  imports: [AuthModule],
  controllers: [BrowserStationController],
  providers: [StationRepository, HierarchyService],
  exports: [StationRepository, HierarchyService],
})
export class StationDataModule {}
