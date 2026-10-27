import { Injectable } from '@nestjs/common';

import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import type { SourceConnectionStatusDto } from './data-source.contracts.js';
import { DataSourceRepository } from './data-source.repository.js';
import { SourceSecretService } from './source-secret.service.js';
import { SourceUpstreamService } from './source-upstream.service.js';

@Injectable()
export class SourceConnectionStatusService {
  private readonly results = new Map<
    string,
    { value: SourceConnectionStatusDto; expiresAt: number }
  >();
  private readonly pending = new Map<string, Promise<SourceConnectionStatusDto>>();

  constructor(
    private readonly repository: DataSourceRepository,
    private readonly secrets: SourceSecretService,
    private readonly upstream: SourceUpstreamService,
  ) {}

  async check(
    principal: CurrentPrincipalValue,
    sourceId: string,
  ): Promise<SourceConnectionStatusDto> {
    if (principal.status !== 'ACTIVE' || !['ADMIN', 'FARMER'].includes(principal.role)) {
      throw new AppError('FORBIDDEN', 403, 'Access is forbidden');
    }
    // Authorization happens on every request, before cache/in-flight lookup.
    const connection = await this.repository.getVisibleConnection(principal, sourceId);
    const cached = this.results.get(sourceId);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.value, isFromCache: true };
    }
    let task = this.pending.get(sourceId);
    if (!task) {
      if (this.pending.size >= 4) {
        throw new AppError(
          'REQUEST_IN_PROGRESS',
          503,
          'Connection checks are busy. Try again shortly.',
        );
      }
      task = this.probe(sourceId, connection).finally(() => this.pending.delete(sourceId));
      this.pending.set(sourceId, task);
    }
    const result = await task;
    // A grant/source may have been revoked while the upstream request ran.
    await this.repository.getVisibleConnection(principal, sourceId);
    return result;
  }

  private async probe(
    sourceId: string,
    connection: Awaited<ReturnType<DataSourceRepository['getVisibleConnection']>>,
  ): Promise<SourceConnectionStatusDto> {
    const baseUrl = this.upstream.normalizeBaseUrl(connection.baseUrl);
    const key = this.secrets.decrypt(connection.encrypted);
    const checkedAt = new Date();
    let connected = true;
    try {
      await this.upstream.listStations(baseUrl, key);
    } catch (error) {
      if (
        !(error instanceof AppError) ||
        !['UPSTREAM_UNAVAILABLE', 'UPSTREAM_INVALID_RESPONSE', 'UPSTREAM_TIMEOUT'].includes(
          error.code,
        )
      ) {
        throw error;
      }
      connected = false;
    }
    await this.repository.recordConnectionStatus(sourceId, connected, checkedAt);
    const value: SourceConnectionStatusDto = {
      connectionStatus: connected ? 'CONNECTED' : 'FAILED',
      lastCheckedAt: checkedAt.toISOString(),
      isFromCache: false,
    };
    // Age starts when the probe started; a slow request never extends freshness.
    this.results.delete(sourceId);
    if (this.results.size >= 500) {
      const oldest = this.results.keys().next().value;
      if (oldest) this.results.delete(oldest);
    }
    this.results.set(sourceId, { value, expiresAt: checkedAt.getTime() + 30_000 });
    return value;
  }
}
