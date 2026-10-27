import { Injectable } from '@nestjs/common';

import type { ApiKeyPrincipal } from '../api-keys/api-key.service.js';
import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import type {
  CursorPage,
  FarmDto,
  HierarchyQuery,
  PlotDto,
  StationDto,
} from './station-data.contracts.js';
import { type AuthorizedStation, StationRepository } from './station.repository.js';

@Injectable()
export class HierarchyService {
  constructor(private readonly stations: StationRepository) {}

  listFarms(principal: CurrentPrincipalValue, query: HierarchyQuery): Promise<CursorPage<FarmDto>> {
    this.requireBrowserReader(principal);
    return this.stations.listFarms(principal, query);
  }

  listPlots(
    principal: CurrentPrincipalValue,
    farmId: string,
    query: HierarchyQuery,
  ): Promise<CursorPage<PlotDto>> {
    this.requireBrowserReader(principal);
    return this.stations.listPlots(principal, farmId, query);
  }

  listStations(
    principal: CurrentPrincipalValue,
    plotId: string,
    query: HierarchyQuery,
  ): Promise<CursorPage<StationDto>> {
    this.requireBrowserReader(principal);
    return this.stations.listStations(principal, plotId, query);
  }

  async getStation(principal: CurrentPrincipalValue, stationId: string): Promise<StationDto> {
    this.requireBrowserReader(principal);
    const station = await this.stations.getStation(principal, stationId);
    if (!station) throw new AppError('NOT_FOUND', 404, 'Resource not found');
    return station;
  }

  listClientStations(
    principal: ApiKeyPrincipal,
    query: HierarchyQuery,
  ): Promise<CursorPage<StationDto>> {
    return this.stations.listClientStations(principal, query);
  }

  async requireClientStationByCode(
    principal: ApiKeyPrincipal,
    code: string,
  ): Promise<AuthorizedStation> {
    const station = await this.stations.getClientStationByCode(principal, code);
    if (!station) throw new AppError('INVALID_API_KEY', 401, 'API key is invalid');
    return station;
  }

  private requireBrowserReader(principal: CurrentPrincipalValue): void {
    if (principal.status !== 'ACTIVE' || !['ADMIN', 'FARMER'].includes(principal.role)) {
      throw new AppError('FORBIDDEN', 403, 'Access is forbidden');
    }
  }
}
