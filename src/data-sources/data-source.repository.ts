import { Injectable } from '@nestjs/common';

import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { SecurityAuditService } from '../security-audit/security-audit.service.js';
import type {
  DataSourceDto,
  DataSourceGrantDto,
  ListDataSourcesQuery,
} from './data-source.contracts.js';
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
      const createdSource = await transaction.dataSource.create({
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
        },
        select: { id: true },
      });
      await transaction.station.updateMany({
        where: {
          plotId: plot.id,
          upstreamCode: { in: [...input.stationCodes] },
          dataSource: { kind: 'SYSTEM' },
        },
        data: { dataSourceId: createdSource.id },
      });
      await transaction.station.createMany({
        data: input.stationCodes.map((code) => ({
          plotId: plot.id,
          dataSourceId: createdSource.id,
          upstreamCode: code,
          name: code,
        })),
        skipDuplicates: true,
      });
      const source = await transaction.dataSource.findUniqueOrThrow({
        where: { id: createdSource.id },
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

  async setGrant(input: {
    principal: CurrentPrincipalValue;
    sourceId: string;
    userId: string;
    assigned: boolean;
    requestId: string;
  }): Promise<{ assigned: boolean }> {
    return this.prisma.$transaction(async (transaction) => {
      const [source, target] = await Promise.all([
        transaction.dataSource.findFirst({
          where: { id: input.sourceId, kind: 'MANAGED' },
          select: { ownerUserId: true },
        }),
        transaction.user.findUnique({
          where: { id: input.userId },
          select: { id: true, role: true, status: true },
        }),
      ]);
      if (!source || !target) throw new AppError('NOT_FOUND', 404, 'Resource not found');
      if (source.ownerUserId !== input.principal.userId) {
        throw new AppError('FORBIDDEN', 403, 'Only the source owner can manage access');
      }
      if (target.role !== 'FARMER' || target.status !== 'ACTIVE') {
        throw new AppError('CONFLICT', 409, 'Only active Farmer accounts can receive access');
      }
      if (target.id === source.ownerUserId) {
        throw new AppError('CONFLICT', 409, 'The source owner already has access');
      }
      if (input.assigned) {
        await transaction.dataSourceGrant.upsert({
          where: {
            dataSourceId_userId: { dataSourceId: input.sourceId, userId: input.userId },
          },
          create: { dataSourceId: input.sourceId, userId: input.userId },
          update: {},
        });
      } else {
        await transaction.dataSourceGrant.deleteMany({
          where: { dataSourceId: input.sourceId, userId: input.userId },
        });
      }
      await this.audits.record(transaction, {
        actorUserId: input.principal.userId,
        action: input.assigned ? 'DATA_SOURCE_ACCESS_GRANTED' : 'DATA_SOURCE_ACCESS_REVOKED',
        targetType: 'DataSourceGrant',
        targetId: `${input.sourceId}:${input.userId}`,
        requestId: input.requestId,
      });
      return { assigned: input.assigned };
    });
  }

  async listGrants(
    principal: CurrentPrincipalValue,
    sourceId: string,
    query: ListDataSourcesQuery,
  ): Promise<{ items: DataSourceGrantDto[]; nextCursor: string | null }> {
    const source = await this.prisma.dataSource.findFirst({
      where: { id: sourceId, kind: 'MANAGED' },
      select: { ownerUserId: true },
    });
    if (!source) throw new AppError('NOT_FOUND', 404, 'Resource not found');
    if (source.ownerUserId !== principal.userId) {
      throw new AppError('FORBIDDEN', 403, 'Only the source owner can manage access');
    }
    const cursor = query.cursor
      ? await this.prisma.dataSourceGrant.findUnique({
          where: { dataSourceId_userId: { dataSourceId: sourceId, userId: query.cursor } },
          select: { userId: true, createdAt: true },
        })
      : null;
    if (query.cursor && !cursor) throw new AppError('VALIDATION_ERROR', 400, 'Cursor is invalid');
    const rows = await this.prisma.dataSourceGrant.findMany({
      where: {
        dataSourceId: sourceId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, userId: { lt: cursor.userId } },
              ],
            }
          : {}),
      },
      select: {
        userId: true,
        createdAt: true,
        user: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
      take: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map((grant) => ({
        user: grant.user,
        createdAt: grant.createdAt.toISOString(),
      })),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.userId ?? null) : null,
    };
  }

  async getOwnedSecret(principal: CurrentPrincipalValue, sourceId: string) {
    const source = await this.prisma.dataSource.findFirst({
      where: { id: sourceId, kind: 'MANAGED' },
      select: {
        ownerUserId: true,
        keyCiphertext: true,
        keyNonce: true,
        keyAuthTag: true,
        owner: { select: { passwordHash: true } },
      },
    });
    if (!source) throw new AppError('NOT_FOUND', 404, 'Resource not found');
    if (source.ownerUserId !== principal.userId) {
      throw new AppError('FORBIDDEN', 403, 'Only the source owner can reveal the key');
    }
    if (!source.owner || !source.keyCiphertext || !source.keyNonce || !source.keyAuthTag) {
      throw new AppError('INTERNAL_ERROR', 500, 'Stored source credential is invalid');
    }
    return {
      passwordHash: source.owner.passwordHash,
      encrypted: {
        ciphertext: source.keyCiphertext,
        nonce: source.keyNonce,
        authTag: source.keyAuthTag,
      },
    };
  }

  async getOwnedConnection(principal: CurrentPrincipalValue, sourceId: string) {
    const source = await this.prisma.dataSource.findFirst({
      where: { id: sourceId, kind: 'MANAGED' },
      select: {
        ownerUserId: true,
        baseUrl: true,
        keyCiphertext: true,
        keyNonce: true,
        keyAuthTag: true,
      },
    });
    if (!source) throw new AppError('NOT_FOUND', 404, 'Resource not found');
    if (source.ownerUserId !== principal.userId) {
      throw new AppError('FORBIDDEN', 403, 'Only the source owner can test the connection');
    }
    if (!source.keyCiphertext || !source.keyNonce || !source.keyAuthTag) {
      throw new AppError('INTERNAL_ERROR', 500, 'Stored source credential is invalid');
    }
    return {
      baseUrl: source.baseUrl,
      encrypted: {
        ciphertext: source.keyCiphertext,
        nonce: source.keyNonce,
        authTag: source.keyAuthTag,
      },
    };
  }

  async recordConnectionTest(input: {
    principal: CurrentPrincipalValue;
    sourceId: string;
    connected: boolean;
    stationCount: number;
    requestId: string;
  }): Promise<string> {
    return this.prisma.$transaction(async (transaction) => {
      const source = await transaction.dataSource.findFirst({
        where: { id: input.sourceId, kind: 'MANAGED' },
        select: { ownerUserId: true },
      });
      if (!source) throw new AppError('NOT_FOUND', 404, 'Resource not found');
      if (source.ownerUserId !== input.principal.userId) {
        throw new AppError('FORBIDDEN', 403, 'Only the source owner can test the connection');
      }
      const lastCheckedAt = new Date();
      await transaction.dataSource.update({
        where: { id: input.sourceId },
        data: {
          connectionStatus: input.connected ? 'CONNECTED' : 'FAILED',
          lastCheckedAt,
        },
      });
      await this.audits.record(transaction, {
        actorUserId: input.principal.userId,
        action: 'DATA_SOURCE_CONNECTION_TESTED',
        targetType: 'DataSource',
        targetId: input.sourceId,
        requestId: input.requestId,
        metadata: { stationCount: input.stationCount },
      });
      return lastCheckedAt.toISOString();
    });
  }

  async recordReveal(principal: CurrentPrincipalValue, sourceId: string, requestId: string) {
    await this.prisma.$transaction(async (transaction) => {
      const source = await transaction.dataSource.findFirst({
        where: { id: sourceId, kind: 'MANAGED' },
        select: { ownerUserId: true },
      });
      if (!source) throw new AppError('NOT_FOUND', 404, 'Resource not found');
      if (source.ownerUserId !== principal.userId) {
        throw new AppError('FORBIDDEN', 403, 'Only the source owner can reveal the key');
      }
      await this.audits.record(transaction, {
        actorUserId: principal.userId,
        action: 'DATA_SOURCE_KEY_REVEALED',
        targetType: 'DataSource',
        targetId: sourceId,
        requestId,
      });
    });
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
