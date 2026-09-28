import { Injectable } from '@nestjs/common';

import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { SecurityAuditService } from '../security-audit/security-audit.service.js';
import type { DataSourceDto, ListDataSourcesQuery } from './data-source.contracts.js';
import type { EncryptedSourceSecret } from './source-secret.service.js';

const sourceSelect = {
  id: true,
  name: true,
  baseUrl: true,
  keyPreview: true,
  connectionStatus: true,
  lastCheckedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, displayName: true, role: true } },
  _count: { select: { stations: true, grants: true } },
} satisfies Prisma.DataSourceSelect;

type SourceRecord = Prisma.DataSourceGetPayload<{ select: typeof sourceSelect }>;

@Injectable()
export class DataSourceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: SecurityAuditService,
  ) {}

  async requirePlotAccess(principal: CurrentPrincipalValue, plotId: string): Promise<void> {
    const plot = await this.prisma.plot.findFirst({
      where: {
        id: plotId,
        ...(principal.role === 'FARMER'
          ? { farm: { memberships: { some: { userId: principal.userId } } } }
          : {}),
      },
      select: { id: true },
    });
    if (!plot) throw new AppError('NOT_FOUND', 404, 'Resource not found');
  }

  async create(input: {
    principal: CurrentPrincipalValue;
    name: string;
    baseUrl: string;
    plotId: string;
    keyPreview: string;
    encrypted: EncryptedSourceSecret;
    stationCodes: readonly string[];
    requestId: string;
  }): Promise<DataSourceDto> {
    return this.prisma.$transaction(async (transaction) => {
      const plot = await transaction.plot.findFirst({
        where: {
          id: input.plotId,
          ...(input.principal.role === 'FARMER'
            ? { farm: { memberships: { some: { userId: input.principal.userId } } } }
            : {}),
        },
        select: { id: true },
      });
      if (!plot) throw new AppError('NOT_FOUND', 404, 'Resource not found');
      const source = await transaction.dataSource.create({
        data: {
          ownerUserId: input.principal.userId,
          name: input.name,
          baseUrl: input.baseUrl,
          keyCiphertext: input.encrypted.ciphertext,
          keyNonce: input.encrypted.nonce,
          keyAuthTag: input.encrypted.authTag,
          keyPreview: input.keyPreview,
          connectionStatus: 'CONNECTED',
          lastCheckedAt: new Date(),
          stations: {
            create: input.stationCodes.map((code) => ({
              plotId: plot.id,
              upstreamCode: code,
              name: code,
            })),
          },
        },
        select: sourceSelect,
      });
      await this.audits.record(transaction, {
        actorUserId: input.principal.userId,
        action: 'DATA_SOURCE_CREATED',
        targetType: 'DataSource',
        targetId: source.id,
        requestId: input.requestId,
        metadata: { stationCount: input.stationCodes.length },
      });
      return this.toDto(source, input.principal.userId);
    });
  }

  async list(
    principal: CurrentPrincipalValue,
    query: ListDataSourcesQuery,
  ): Promise<{ items: DataSourceDto[]; nextCursor: string | null }> {
    const cursor = query.cursor
      ? await this.prisma.dataSource.findUnique({
          where: { id: query.cursor },
          select: { id: true, createdAt: true },
        })
      : null;
    if (query.cursor && !cursor) throw new AppError('VALIDATION_ERROR', 400, 'Cursor is invalid');
    const access: Prisma.DataSourceWhereInput =
      principal.role === 'ADMIN'
        ? {}
        : {
            OR: [
              { ownerUserId: principal.userId },
              { grants: { some: { userId: principal.userId } } },
            ],
          };
    const rows = await this.prisma.dataSource.findMany({
      where: {
        kind: 'MANAGED',
        AND: [
          access,
          ...(cursor
            ? [
                {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      select: sourceSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map((source) => this.toDto(source, principal.userId)),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async get(principal: CurrentPrincipalValue, sourceId: string): Promise<DataSourceDto> {
    const source = await this.prisma.dataSource.findFirst({
      where: {
        id: sourceId,
        kind: 'MANAGED',
        ...(principal.role === 'ADMIN'
          ? {}
          : {
              OR: [
                { ownerUserId: principal.userId },
                { grants: { some: { userId: principal.userId } } },
              ],
            }),
      },
      select: sourceSelect,
    });
    if (!source) throw new AppError('NOT_FOUND', 404, 'Resource not found');
    return this.toDto(source, principal.userId);
  }

  private toDto(source: SourceRecord, principalId: string): DataSourceDto {
    if (!source.owner || !['ADMIN', 'FARMER'].includes(source.owner.role)) {
      throw new AppError('INTERNAL_ERROR', 500, 'Data source owner is invalid');
    }
    const isOwner = source.owner.id === principalId;
    return {
      id: source.id,
      name: source.name,
      owner: {
        id: source.owner.id,
        displayName: source.owner.displayName,
        role: source.owner.role as 'ADMIN' | 'FARMER',
      },
      baseUrl: source.baseUrl,
      keyPreview: source.keyPreview,
      stationCount: source._count.stations,
      visibleAccountCount: 1 + source._count.grants,
      connectionStatus: source.connectionStatus,
      lastCheckedAt: source.lastCheckedAt.toISOString(),
      canManageAccess: isOwner,
      canRevealKey: isOwner,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    };
  }
}
