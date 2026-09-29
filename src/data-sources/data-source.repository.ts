import { Injectable } from '@nestjs/common';

import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { SecurityAuditService } from '../security-audit/security-audit.service.js';
import { queueLifecycleNotifications } from '../notifications/notification-delivery.js';
import type {
  DataSourceDto,
  DataSourceGrantCandidateDto,
  DataSourceGrantDto,
  ListDataSourcesQuery,
  ResourceChoice,
} from './data-source.contracts.js';
import type { EncryptedSourceSecret } from './source-secret.service.js';

const soilStationWhere = { upstreamCode: { not: 'CENTER' } } as const;

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
  grants: {
    select: {
      userId: true,
      _count: { select: { stations: { where: { station: soilStationWhere } } } },
    },
  },
  _count: { select: { stations: { where: soilStationWhere }, grants: true } },
} satisfies Prisma.DataSourceSelect;

type SourceRecord = Prisma.DataSourceGetPayload<{ select: typeof sourceSelect }>;

@Injectable()
export class DataSourceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: SecurityAuditService,
  ) {}

  async requireHierarchyAccess(
    principal: CurrentPrincipalValue,
    farmChoice: ResourceChoice,
    plotChoice: ResourceChoice,
  ): Promise<void> {
    const farm = await this.prisma.farm.findFirst({
      where: {
        ...('id' in farmChoice ? { id: farmChoice.id } : { name: farmChoice.name }),
        ...(principal.role === 'FARMER'
          ? { memberships: { some: { userId: principal.userId } } }
          : {}),
      },
      select: { id: true },
    });
    if (!farm) {
      const namedFarmDoesNotExist =
        'name' in farmChoice &&
        !(await this.prisma.farm.findUnique({
          where: { name: farmChoice.name },
          select: { id: true },
        }));
      if (namedFarmDoesNotExist && 'name' in plotChoice) return;
      throw new AppError('NOT_FOUND', 404, 'Resource not found');
    }
    if ('id' in plotChoice) {
      const plot = await this.prisma.plot.findFirst({
        where: { id: plotChoice.id, farmId: farm.id },
        select: { id: true },
      });
      if (!plot) throw new AppError('NOT_FOUND', 404, 'Resource not found');
    }
  }

  async create(input: {
    principal: CurrentPrincipalValue;
    name: string;
    baseUrl: string;
    farm: ResourceChoice;
    plot: ResourceChoice;
    keyPreview: string;
    encrypted: EncryptedSourceSecret;
    stationCodes: readonly string[];
    requestId: string;
  }): Promise<DataSourceDto> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.createTransaction(input);
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2002', 'P2034'].includes(error.code);
        if (!retryable || attempt === 1) throw error;
      }
    }
    throw new AppError('INTERNAL_ERROR', 500, 'Data source creation failed');
  }

  private createTransaction(input: {
    principal: CurrentPrincipalValue;
    name: string;
    baseUrl: string;
    farm: ResourceChoice;
    plot: ResourceChoice;
    keyPreview: string;
    encrypted: EncryptedSourceSecret;
    stationCodes: readonly string[];
    requestId: string;
  }): Promise<DataSourceDto> {
    return this.prisma.$transaction(
      async (transaction) => {
        const farm = await this.resolveFarm(transaction, input.principal, input.farm);
        const plot = await this.resolvePlot(transaction, farm.id, input.plot);
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
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private async resolveFarm(
    transaction: Prisma.TransactionClient,
    principal: CurrentPrincipalValue,
    choice: ResourceChoice,
  ): Promise<{ id: string }> {
    if ('id' in choice) {
      const farm = await transaction.farm.findFirst({
        where: {
          id: choice.id,
          ...(principal.role === 'FARMER'
            ? { memberships: { some: { userId: principal.userId } } }
            : {}),
        },
        select: { id: true },
      });
      if (!farm) throw new AppError('NOT_FOUND', 404, 'Resource not found');
      return farm;
    }

    const existing = await transaction.farm.findUnique({
      where: { name: choice.name },
      select: {
        id: true,
        memberships: { where: { userId: principal.userId }, select: { userId: true } },
      },
    });
    if (existing) {
      if (principal.role === 'FARMER' && existing.memberships.length === 0) {
        throw new AppError('NOT_FOUND', 404, 'Resource not found');
      }
      return { id: existing.id };
    }

    const farm = await transaction.farm.create({
      data: { name: choice.name },
      select: { id: true },
    });
    if (principal.role === 'FARMER') {
      await transaction.farmMembership.create({
        data: { userId: principal.userId, farmId: farm.id },
      });
    }
    return farm;
  }

  private async resolvePlot(
    transaction: Prisma.TransactionClient,
    farmId: string,
    choice: ResourceChoice,
  ): Promise<{ id: string }> {
    if ('id' in choice) {
      const plot = await transaction.plot.findFirst({
        where: { id: choice.id, farmId },
        select: { id: true },
      });
      if (!plot) throw new AppError('NOT_FOUND', 404, 'Resource not found');
      return plot;
    }
    return transaction.plot.upsert({
      where: { farmId_name: { farmId, name: choice.name } },
      create: { farmId, name: choice.name },
      update: {},
      select: { id: true },
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
        removedAt: null,
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
        removedAt: null,
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
    if (input.assigned) {
      const stationIds = (
        await this.prisma.station.findMany({
          where: { dataSourceId: input.sourceId },
          select: { id: true },
          orderBy: { id: 'asc' },
        })
      ).map(({ id }) => id);
      if (stationIds.length === 0) throw new AppError('CONFLICT', 409, 'Source has no stations');
      await this.replaceGrantStations({ ...input, stationIds });
      return { assigned: true };
    }
    return this.prisma.$transaction(async (transaction) => {
      const [source, target] = await Promise.all([
        transaction.dataSource.findFirst({
          where: { id: input.sourceId, kind: 'MANAGED', removedAt: null },
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
      await transaction.dataSourceGrant.deleteMany({
        where: { dataSourceId: input.sourceId, userId: input.userId },
      });
      await this.audits.record(transaction, {
        actorUserId: input.principal.userId,
        action: 'DATA_SOURCE_ACCESS_REVOKED',
        targetType: 'DataSourceGrant',
        targetId: `${input.sourceId}:${input.userId}`,
        requestId: input.requestId,
      });
      return { assigned: false };
    });
  }

  async replaceGrantStations(input: {
    principal: CurrentPrincipalValue;
    sourceId: string;
    userId: string;
    stationIds: readonly string[];
    requestId: string;
  }): Promise<{ assigned: true; stationIds: readonly string[] }> {
    return this.prisma.$transaction(async (transaction) => {
      const [source, target, stations] = await Promise.all([
        transaction.dataSource.findFirst({
          where: { id: input.sourceId, kind: 'MANAGED', removedAt: null },
          select: { ownerUserId: true },
        }),
        transaction.user.findUnique({
          where: { id: input.userId },
          select: { id: true, role: true, status: true },
        }),
        transaction.station.findMany({
          where: {
            id: { in: [...input.stationIds] },
            dataSourceId: input.sourceId,
            ...soilStationWhere,
          },
          select: { id: true },
          orderBy: { id: 'asc' },
        }),
      ]);
      this.requireGrantMutation(input.principal, source, target);
      if (stations.length !== input.stationIds.length) {
        throw new AppError('NOT_FOUND', 404, 'Resource not found');
      }
      await transaction.dataSourceGrant.upsert({
        where: {
          dataSourceId_userId: { dataSourceId: input.sourceId, userId: input.userId },
        },
        create: { dataSourceId: input.sourceId, userId: input.userId },
        update: {},
      });
      await transaction.dataSourceGrantStation.deleteMany({
        where: {
          dataSourceId: input.sourceId,
          userId: input.userId,
          stationId: { notIn: [...input.stationIds] },
        },
      });
      await transaction.dataSourceGrantStation.createMany({
        data: stations.map(({ id }) => ({
          dataSourceId: input.sourceId,
          userId: input.userId,
          stationId: id,
        })),
        skipDuplicates: true,
      });
      await this.audits.record(transaction, {
        actorUserId: input.principal.userId,
        action: 'DATA_SOURCE_ACCESS_GRANTED',
        targetType: 'DataSourceGrant',
        targetId: `${input.sourceId}:${input.userId}`,
        requestId: input.requestId,
        metadata: { stationCount: stations.length },
      });
      return { assigned: true, stationIds: stations.map(({ id }) => id) };
    });
  }

  async removeGrantStation(input: {
    principal: CurrentPrincipalValue;
    sourceId: string;
    userId: string;
    stationId: string;
    requestId: string;
  }): Promise<{ assigned: boolean; stationIds: readonly string[] }> {
    return this.prisma.$transaction(async (transaction) => {
      const [source, target, station] = await Promise.all([
        transaction.dataSource.findFirst({
          where: { id: input.sourceId, kind: 'MANAGED', removedAt: null },
          select: { ownerUserId: true },
        }),
        transaction.user.findUnique({
          where: { id: input.userId },
          select: { id: true, role: true, status: true },
        }),
        transaction.station.findFirst({
          where: { id: input.stationId, dataSourceId: input.sourceId },
          select: { id: true },
        }),
      ]);
      this.requireGrantMutation(input.principal, source, target);
      if (!station) throw new AppError('NOT_FOUND', 404, 'Resource not found');
      await transaction.dataSourceGrantStation.deleteMany({
        where: {
          dataSourceId: input.sourceId,
          userId: input.userId,
          stationId: input.stationId,
        },
      });
      const remaining = await transaction.dataSourceGrantStation.findMany({
        where: { dataSourceId: input.sourceId, userId: input.userId },
        select: { stationId: true },
        orderBy: { stationId: 'asc' },
      });
      if (remaining.length === 0) {
        await transaction.dataSourceGrant.deleteMany({
          where: { dataSourceId: input.sourceId, userId: input.userId },
        });
      }
      await this.audits.record(transaction, {
        actorUserId: input.principal.userId,
        action: 'DATA_SOURCE_STATION_ACCESS_REVOKED',
        targetType: 'DataSourceGrantStation',
        targetId: `${input.sourceId}:${input.userId}:${input.stationId}`,
        requestId: input.requestId,
      });
      return {
        assigned: remaining.length > 0,
        stationIds: remaining.map(({ stationId }) => stationId),
      };
    });
  }

  async listGrants(
    principal: CurrentPrincipalValue,
    sourceId: string,
    query: ListDataSourcesQuery,
  ): Promise<{ items: DataSourceGrantDto[]; nextCursor: string | null }> {
    const source = await this.prisma.dataSource.findFirst({
      where: { id: sourceId, kind: 'MANAGED', removedAt: null },
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
        stations: {
          where: { station: soilStationWhere },
          select: { stationId: true },
          orderBy: { stationId: 'asc' },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
      take: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map((grant) => ({
        user: grant.user,
        stationIds: grant.stations.map(({ stationId }) => stationId),
        createdAt: grant.createdAt.toISOString(),
      })),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.userId ?? null) : null,
    };
  }

  async listGrantCandidates(
    principal: CurrentPrincipalValue,
    sourceId: string,
    query: ListDataSourcesQuery,
  ): Promise<{ items: DataSourceGrantCandidateDto[]; nextCursor: string | null }> {
    const source = await this.prisma.dataSource.findFirst({
      where: { id: sourceId, kind: 'MANAGED', removedAt: null },
      select: { ownerUserId: true },
    });
    if (!source) throw new AppError('NOT_FOUND', 404, 'Resource not found');
    if (source.ownerUserId !== principal.userId) {
      throw new AppError('FORBIDDEN', 403, 'Only the source owner can manage access');
    }

    const cursor = query.cursor
      ? await this.prisma.user.findFirst({
          where: { id: query.cursor, role: 'FARMER', status: 'ACTIVE' },
          select: { id: true, createdAt: true },
        })
      : null;
    if (query.cursor && !cursor) throw new AppError('VALIDATION_ERROR', 400, 'Cursor is invalid');

    const rows = await this.prisma.user.findMany({
      where: {
        role: 'FARMER',
        status: 'ACTIVE',
        id: { not: source.ownerUserId },
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: { id: true, displayName: true, email: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(({ id, displayName, email }) => ({ id, displayName, email })),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async listStations(principal: CurrentPrincipalValue, sourceId: string) {
    const source = await this.prisma.dataSource.findFirst({
      where: { id: sourceId, kind: 'MANAGED', removedAt: null },
      select: { ownerUserId: true },
    });
    if (!source) throw new AppError('NOT_FOUND', 404, 'Resource not found');
    if (source.ownerUserId !== principal.userId) {
      throw new AppError('FORBIDDEN', 403, 'Only the source owner can manage access');
    }
    const items = await this.prisma.station.findMany({
      where: { dataSourceId: sourceId, ...soilStationWhere },
      select: { id: true, name: true, upstreamCode: true },
      orderBy: [{ upstreamCode: 'asc' }, { id: 'asc' }],
    });
    return {
      items: items.map(({ upstreamCode, ...station }) => ({ ...station, code: upstreamCode })),
    };
  }

  private requireGrantMutation(
    principal: CurrentPrincipalValue,
    source: { ownerUserId: string | null } | null,
    target: { id: string; role: string; status: string } | null,
  ): void {
    if (!source || !target) throw new AppError('NOT_FOUND', 404, 'Resource not found');
    if (source.ownerUserId !== principal.userId) {
      throw new AppError('FORBIDDEN', 403, 'Only the source owner can manage access');
    }
    if (target.role !== 'FARMER' || target.status !== 'ACTIVE') {
      throw new AppError('CONFLICT', 409, 'Only active Farmer accounts can receive access');
    }
    if (target.id === source.ownerUserId) {
      throw new AppError('CONFLICT', 409, 'The source owner already has access');
    }
  }

  async getOwnedSecret(principal: CurrentPrincipalValue, sourceId: string) {
    const source = await this.prisma.dataSource.findFirst({
      where: { id: sourceId, kind: 'MANAGED', removedAt: null },
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
      where: { id: sourceId, kind: 'MANAGED', removedAt: null },
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
        where: { id: input.sourceId, kind: 'MANAGED', removedAt: null },
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
        where: { id: sourceId, kind: 'MANAGED', removedAt: null },
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

  async remove(
    principal: CurrentPrincipalValue,
    sourceId: string,
    requestId: string,
  ): Promise<{ removed: true }> {
    return this.prisma.$transaction(
      async (transaction) => {
        const source = await transaction.dataSource.findFirst({
          where: { id: sourceId, kind: 'MANAGED' },
          select: { ownerUserId: true, removedAt: true },
        });
        if (!source) throw new AppError('NOT_FOUND', 404, 'Resource not found');
        if (source.ownerUserId !== principal.userId) {
          throw new AppError('FORBIDDEN', 403, 'Only the source owner can remove it');
        }
        if (source.removedAt) return { removed: true };

        const unresolved = await transaction.alert.findMany({
          where: {
            unresolvedRuleId: { not: null },
            rule: { station: { dataSourceId: sourceId } },
          },
          select: {
            id: true,
            revision: true,
            rule: { select: { station: { select: { plot: { select: { farmId: true } } } } } },
          },
        });
        await transaction.alertRule.updateMany({
          where: { station: { dataSourceId: sourceId } },
          data: { isEnabled: false, evaluationStatus: 'DISABLED', activeKey: null },
        });
        for (const alert of unresolved) {
          const revision = alert.revision + 1;
          const updated = await transaction.alert.updateMany({
            where: { id: alert.id, revision: alert.revision, unresolvedRuleId: { not: null } },
            data: {
              status: 'RESOLVED',
              unresolvedRuleId: null,
              resolvedAt: new Date(),
              resolvedBy: principal.userId,
              resolutionReason: 'SOURCE_REMOVED',
              revision,
            },
          });
          if (updated.count === 1) {
            const event = await transaction.alertLifecycleEvent.create({
              data: {
                alertId: alert.id,
                type: 'RESOLVED',
                revision,
                actorId: principal.userId,
                requestId,
              },
            });
            await queueLifecycleNotifications(
              transaction,
              event.id,
              alert.rule.station.plot.farmId,
            );
          }
        }
        await transaction.dataSourceGrant.deleteMany({ where: { dataSourceId: sourceId } });
        await transaction.dataSource.update({
          where: { id: sourceId },
          data: {
            removedAt: new Date(),
            keyCiphertext: null,
            keyNonce: null,
            keyAuthTag: null,
            keyPreview: null,
            connectionStatus: 'FAILED',
          },
        });
        await this.audits.record(transaction, {
          actorUserId: principal.userId,
          action: 'DATA_SOURCE_REMOVED',
          targetType: 'DataSource',
          targetId: sourceId,
          requestId,
          metadata: { resolvedAlertCount: unresolved.length },
        });
        return { removed: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private toDto(source: SourceRecord, principalId: string): DataSourceDto {
    if (!source.owner || !['ADMIN', 'FARMER'].includes(source.owner.role)) {
      throw new AppError('INTERNAL_ERROR', 500, 'Data source owner is invalid');
    }
    const isOwner = source.owner.id === principalId;
    const principalGrant = source.grants.find((grant) => grant.userId === principalId);
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
      stationCount: principalGrant?._count.stations ?? source._count.stations,
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
