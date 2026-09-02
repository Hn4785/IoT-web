import { Injectable } from '@nestjs/common';

import type { CurrentPrincipalValue } from './current-principal.js';
import { AuthorizationPolicy } from './authorization.policy.js';
import { ScopeRepository } from './scope.repository.js';

@Injectable()
export class ScopeService {
  constructor(
    private readonly policy: AuthorizationPolicy,
    private readonly scopes: ScopeRepository,
  ) {}

  async canReadStation(principal: CurrentPrincipalValue, stationId: string): Promise<boolean> {
    if (!this.policy.canUseBrowserStationData(principal.role)) return false;
    if (principal.role === 'ADMIN') return this.scopes.stationExists(stationId);
    return this.scopes.farmerCanReadStation(principal.userId, stationId);
  }
}
