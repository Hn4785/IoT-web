import { Injectable } from '@nestjs/common';

import type { ApiKeyPrincipal } from '../api-keys/api-key.service.js';
import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import type {
  CursorPage,
  FarmDto,
  HierarchyQuery,
  PlotDto,
  StationDto,
} from './station-data.contracts.js';

const NO_ACCESS_ID = '00000000-0000-4000-8000-000000000000';

export type AuthorizedStation = Readonly<StationDto & { upstreamCode: string }>;

const keyset = (name: string, id: string) => ({
  OR: [{ name: { gt: name } }, { name, id: { gt: id } }],
});

const notFound = (): AppError => new AppError('NOT_FOUND', 404, 'Resource not found');

@Injectable()
export class StationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listFarms(
    principal: CurrentPrincipalValue,
    query: HierarchyQuery,
  ): Promise<CursorPage<FarmDto>> {
    const cursor = query.cursor ? decodeCursor(query.cursor, 'farm') : undefined;
    const scope: Prisma.FarmWhereInput =
      principal.role === 'ADMIN'
        ? {}
        : principal.role === 'FARMER'
          ? { memberships: { some: { userId: principal.userId } } }
          : { id: NO_ACCESS_ID };
    const rows = await this.prisma.farm.findMany({
      where: { AND: [scope, ...(cursor ? [keyset(cursor.name, cursor.id)] : [])] },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ v: 1, kind: 'farm', name: last.name, id: last.id })
          : null,
    };
  }

  async listPlots(
    principal: CurrentPrincipalValue,
    farmId: string,
    query: HierarchyQuery,
  ): Promise<CursorPage<PlotDto>> {
    const cursor = query.cursor ? decodeCursor(query.cursor, 'plot') : undefined;
    if (cursor && cursor.parentId !== farmId) {
      throw new AppError('VALIDATION_ERROR', 400, 'Cursor is invalid');
    }
    await this.requireFarm(principal, farmId);
    const rows = await this.prisma.plot.findMany({
      where: {
        AND: [
          { farmId },
          ...(cursor ? [keyset(cursor.name, cursor.id)] : []),
          this.plotScope(principal),
        ],
      },
      select: { id: true, farmId: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({
              v: 1,
              kind: 'plot',
              parentId: farmId,
              name: last.name,
              id: last.id,
            })
          : null,
    };
  }

  async listStations(
    principal: CurrentPrincipalValue,
    plotId: string,
    query: HierarchyQuery,
  ): Promise<CursorPage<StationDto>> {
    const cursor = query.cursor ? decodeCursor(query.cursor, 'station') : undefined;
    if (cursor && cursor.parentId !== plotId) {
      throw new AppError('VALIDATION_ERROR', 400, 'Cursor is invalid');
    }
    await this.requirePlot(principal, plotId);
    const rows = await this.prisma.station.findMany({
      where: {
        AND: [
          { plotId },
          ...(cursor ? [keyset(cursor.name, cursor.id)] : []),
          this.stationScope(principal),
        ],
      },
      select: {
        id: true,
        plotId: true,
        name: true,
        upstreamCode: true,
        plot: { select: { farmId: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit).map((row) => this.toStationDto(row));
    const lastRow = rows[Math.min(query.limit, rows.length) - 1];
    return {
      items,
      nextCursor:
        rows.length > query.limit && lastRow
          ? encodeCursor({
              v: 1,
              kind: 'station',
              parentId: plotId,
              name: lastRow.name,
              id: lastRow.id,
            })
          : null,
    };
  }

  async getStation(
    principal: CurrentPrincipalValue,
    stationId: string,
  ): Promise<StationDto | null> {
    const station = await this.findAuthorizedStation(principal, stationId);
    return station ? this.toStationDto(station) : null;
  }

  async getAuthorizedStation(
    principal: CurrentPrincipalValue,
    stationId: string,
  ): Promise<AuthorizedStation | null> {
    const station = await this.findAuthorizedStation(principal, stationId);
    if (!station) return null;
    return { ...this.toStationDto(station), upstreamCode: station.upstreamCode };
  }

  async listClientStations(
    principal: ApiKeyPrincipal,
    query: HierarchyQuery,
  ): Promise<CursorPage<StationDto>> {
    const cursor = query.cursor ? decodeCursor(query.cursor, 'client-station') : undefined;
    const scope: Prisma.StationWhereInput = {
      clientGrants: { some: { userId: principal.ownerUserId } },
      apiKeyScopes: { some: { apiKeyId: principal.apiKeyId } },
    };
    const rows = await this.prisma.station.findMany({
      where: { AND: [scope, ...(cursor ? [keyset(cursor.name, cursor.id)] : [])] },
      select: {
        id: true,
        plotId: true,
        name: true,
        upstreamCode: true,
        plot: { select: { farmId: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit).map((row) => this.toStationDto(row));
    const lastRow = rows[Math.min(query.limit, rows.length) - 1];
    return {
      items,
      nextCursor:
        rows.length > query.limit && lastRow
          ? encodeCursor({ v: 1, kind: 'client-station', name: lastRow.name, id: lastRow.id })
          : null,
    };
  }

  async getClientStationByCode(
    principal: ApiKeyPrincipal,
    code: string,
  ): Promise<AuthorizedStation | null> {
    const station = await this.prisma.station.findFirst({
      where: {
        upstreamCode: code,
        clientGrants: { some: { userId: principal.ownerUserId } },
        apiKeyScopes: { some: { apiKeyId: principal.apiKeyId } },
      },
      select: {
        id: true,
        plotId: true,
        name: true,
        upstreamCode: true,
        plot: { select: { farmId: true } },
      },
    });
    if (!station) return null;
    return { ...this.toStationDto(station), upstreamCode: station.upstreamCode };
  }

  private async requireFarm(principal: CurrentPrincipalValue, farmId: string): Promise<void> {
    const farm = await this.prisma.farm.findFirst({
      where: { AND: [{ id: farmId }, this.farmScope(principal)] },
      select: { id: true },
    });
    if (!farm) throw notFound();
  }

  private async requirePlot(principal: CurrentPrincipalValue, plotId: string): Promise<void> {
    const plot = await this.prisma.plot.findFirst({
      where: { AND: [{ id: plotId }, this.plotScope(principal)] },
      select: { id: true },
    });
    if (!plot) throw notFound();
  }

  private findAuthorizedStation(principal: CurrentPrincipalValue, stationId: string) {
    return this.prisma.station.findFirst({
      where: { AND: [{ id: stationId }, this.stationScope(principal)] },
      select: {
        id: true,
        plotId: true,
        name: true,
        upstreamCode: true,
        plot: { select: { farmId: true } },
      },
    });
  }

  private farmScope(principal: CurrentPrincipalValue): Prisma.FarmWhereInput {
    return principal.role === 'ADMIN'
      ? {}
      : principal.role === 'FARMER'
        ? { memberships: { some: { userId: principal.userId } } }
        : { id: NO_ACCESS_ID };
  }

  private plotScope(principal: CurrentPrincipalValue): Prisma.PlotWhereInput {
    return principal.role === 'ADMIN'
      ? {}
      : principal.role === 'FARMER'
        ? { farm: { memberships: { some: { userId: principal.userId } } } }
        : { id: NO_ACCESS_ID };
  }

  private stationScope(principal: CurrentPrincipalValue): Prisma.StationWhereInput {
    return principal.role === 'ADMIN'
      ? {}
      : principal.role === 'FARMER'
        ? { plot: { farm: { memberships: { some: { userId: principal.userId } } } } }
        : { id: NO_ACCESS_ID };
  }

  private toStationDto(station: {
    id: string;
    plotId: string;
    name: string;
    upstreamCode: string;
    plot: { farmId: string };
  }): StationDto {
    return {
      id: station.id,
      farmId: station.plot.farmId,
      plotId: station.plotId,
      name: station.name,
      code: station.upstreamCode,
    };
  }
}
