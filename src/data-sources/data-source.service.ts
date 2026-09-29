import { Injectable } from '@nestjs/common';

import { PasswordService } from '../auth/password.service.js';
import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import type {
  CreateDataSourceInput,
  DataSourceDto,
  ListDataSourcesQuery,
  RevealDataSourceInput,
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
    private readonly passwords: PasswordService,
  ) {}

  async create(
    principal: CurrentPrincipalValue,
    input: CreateDataSourceInput,
    requestId: string,
  ): Promise<DataSourceDto> {
    this.requireSupportedRole(principal);
    await this.repository.requirePlotAccess(principal, input.plotId);
    const baseUrl = this.upstream.normalizeBaseUrl(input.baseUrl);
    const stationCodes = await this.upstream.discoverSoilStations(baseUrl, input.xApiKey);
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

  setGrant(
    principal: CurrentPrincipalValue,
    sourceId: string,
    userId: string,
    assigned: boolean,
    requestId: string,
  ): Promise<{ assigned: boolean }> {
    this.requireSupportedRole(principal);
    return this.repository.setGrant({ principal, sourceId, userId, assigned, requestId });
  }

  listGrants(principal: CurrentPrincipalValue, sourceId: string, query: ListDataSourcesQuery) {
    this.requireSupportedRole(principal);
    return this.repository.listGrants(principal, sourceId, query);
  }

  async reveal(
    principal: CurrentPrincipalValue,
    sourceId: string,
    input: RevealDataSourceInput,
    requestId: string,
  ): Promise<{ xApiKey: string; expiresInSeconds: 30 }> {
    this.requireSupportedRole(principal);
    const source = await this.repository.getOwnedSecret(principal, sourceId);
    if (!(await this.passwords.verify(source.passwordHash, input.currentPassword))) {
      throw new AppError('INVALID_CREDENTIALS', 401, 'Current password is invalid');
    }
    const xApiKey = this.secrets.decrypt(source.encrypted);
    await this.repository.recordReveal(principal, sourceId, requestId);
    return { xApiKey, expiresInSeconds: 30 };
  }

  async testConnection(
    principal: CurrentPrincipalValue,
    sourceId: string,
    requestId: string,
  ): Promise<{ connectionStatus: 'CONNECTED'; stationCount: number; lastCheckedAt: string }> {
    this.requireSupportedRole(principal);
    const source = await this.repository.getOwnedConnection(principal, sourceId);
    const xApiKey = this.secrets.decrypt(source.encrypted);
    try {
      const stations = await this.upstream.discoverSoilStations(source.baseUrl, xApiKey);
      const lastCheckedAt = await this.repository.recordConnectionTest({
        principal,
        sourceId,
        connected: true,
        stationCount: stations.length,
        requestId,
      });
      return { connectionStatus: 'CONNECTED', stationCount: stations.length, lastCheckedAt };
    } catch (error) {
      await this.repository.recordConnectionTest({
        principal,
        sourceId,
        connected: false,
        stationCount: 0,
        requestId,
      });
      throw error;
    }
  }

  private requireSupportedRole(principal: CurrentPrincipalValue): void {
    if (principal.status !== 'ACTIVE' || !['ADMIN', 'FARMER'].includes(principal.role)) {
      throw new AppError('FORBIDDEN', 403, 'Access is forbidden');
    }
  }
}
