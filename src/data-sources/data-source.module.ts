import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { SecurityAuditModule } from '../security-audit/security-audit.module.js';
import { DataSourceController } from './data-source.controller.js';
import { DataSourceRepository } from './data-source.repository.js';
import { DataSourceService } from './data-source.service.js';
import { SourceSecretService } from './source-secret.service.js';
import { SourceUpstreamService } from './source-upstream.service.js';

@Module({
  imports: [AuthModule, SecurityAuditModule],
  controllers: [DataSourceController],
  providers: [DataSourceRepository, DataSourceService, SourceSecretService, SourceUpstreamService],
  exports: [DataSourceService, SourceSecretService, SourceUpstreamService],
})
export class DataSourceModule {}
