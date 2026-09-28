import { Injectable } from '@nestjs/common';

import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import type {
  CreateDataSourceInput,
  DataSourceDto,
  ListDataSourcesQuery,
} from './data-source.contracts.js';
import { DataSourceRepository } from './data-source.repository.js';
import { SourceSecretService } from './source-secret.service.js';
import { SourceUpstreamService } from './source-upstream.service.js';

@Injectable()
export class DataSourceService {
  constructor(
    private readonly repository: DataSourceRepository,
    private readonly upstream: SourceUpstreamService,
    private readonly secrets: SourceSecretService,
  ) {}

  async create(
    principal: CurrentPrincipalValue,
    input: CreateDataSourceInput,
    requestId: string,
  ): Promise<DataSourceDto> {
    this.requireSupportedRole(principal);
    await this.repository.requirePlotAccess(principal, input.plotId);
    const baseUrl = this.upstream.normalizeBaseUrl(input.baseUrl);
    const stationCodes = await this.upstream.listStations(baseUrl, input.xApiKey);
    return this.repository.create({
      principal,
      name: input.name,
      baseUrl,
      plotId: input.plotId,
      keyPreview: input.xApiKey.slice(-4),
      encrypted: this.secrets.encrypt(input.xApiKey),
      stationCodes,
      requestId,
    });
  }

  list(
    principal: CurrentPrincipalValue,
    query: ListDataSourcesQuery,
  ): Promise<{ items: DataSourceDto[]; nextCursor: string | null }> {
    this.requireSupportedRole(principal);
    return this.repository.list(principal, query);
  }

  get(principal: CurrentPrincipalValue, sourceId: string): Promise<DataSourceDto> {
    this.requireSupportedRole(principal);
    return this.repository.get(principal, sourceId);
  }

  private requireSupportedRole(principal: CurrentPrincipalValue): void {
    if (principal.status !== 'ACTIVE' || !['ADMIN', 'FARMER'].includes(principal.role)) {
      throw new AppError('FORBIDDEN', 403, 'Access is forbidden');
    }
  }
}
