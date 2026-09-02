import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';

import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { TOKEN_HASH_SERVICE, TokenHashService } from '../auth/token-hash.service.js';
import { AppError } from '../common/errors/app-error.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { SecurityAuditService } from '../security-audit/security-audit.service.js';
import type { ApiKeyDto, CreateApiKeyInput } from './api-key.contracts.js';

const API_KEY_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const API_KEY_PATTERN = /^iot_live_([A-Za-z0-9_-]{8})_([A-Za-z0-9_-]{43})$/;
const DEFAULT_REQUESTS_PER_MINUTE = 60;
const DUMMY_HASH = '0'.repeat(64);
const NIL_STATION_ID = '00000000-0000-4000-8000-000000000000';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const apiKeyWithScopes = {
  id: true,
  ownerUserId: true,
  name: true,
  prefix: true,
  expiresAt: true,
  requestsPerMinute: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
  scopes: { select: { stationId: true }, orderBy: { stationId: 'asc' as const } },
} satisfies Prisma.ApiKeySelect;

type ApiKeyRecord = Prisma.ApiKeyGetPayload<{ select: typeof apiKeyWithScopes }>;

export type ApiKeyPrincipal = Readonly<{
  apiKeyId: string;
  ownerUserId: string;
  stationId: string;
  requestsPerMinute: number;
}>;

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: SecurityAuditService,
    @Inject(TOKEN_HASH_SERVICE) private readonly tokenHashes: TokenHashService,
  ) {}

  async list(principal: CurrentPrincipalValue): Promise<readonly ApiKeyDto[]> {
    this.requireClientDeveloper(principal);
    const keys = await this.prisma.apiKey.findMany({
      where: { ownerUserId: principal.userId },
      select: apiKeyWithScopes,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return keys.map(toApiKeyDto);
  }

  async create(
    principal: CurrentPrincipalValue,
    input: CreateApiKeyInput,
    requestId: string,
  ): Promise<{ key: string; apiKey: ApiKeyDto }> {
    this.requireClientDeveloper(principal);
    const stationIds = [...new Set(input.stationIds)];
    return this.createCredential({
      ownerUserId: principal.userId,
      name: input.name,
      stationIds,
      requestId,
      action: 'API_KEY_CREATED',
    });
  }

  async rotate(
    principal: CurrentPrincipalValue,
    apiKeyId: string,
    requestId: string,
  ): Promise<{ key: string; apiKey: ApiKeyDto }> {
    this.requireClientDeveloper(principal);
    const current = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: apiKeyWithScopes,
    });
    if (!current || current.ownerUserId !== principal.userId) {
      throw new AppError('NOT_FOUND', 404, 'API key not found');
    }
    if (current.revokedAt) throw new AppError('CONFLICT', 409, 'API key is already revoked');
    const stationIds = current.scopes.map((scope) => scope.stationId);

    const credential = generateCredential();
    const now = new Date();
    return this.prisma.$transaction(
      async (transaction) => {
        await this.requireCurrentGrants(transaction, principal.userId, stationIds);
        const revoked = await transaction.apiKey.updateMany({
          where: { id: current.id, ownerUserId: principal.userId, revokedAt: null },
          data: { revokedAt: now },
        });
        if (revoked.count !== 1) throw new AppError('CONFLICT', 409, 'API key changed');
        const replacement = await transaction.apiKey.create({
          data: {
            ownerUserId: principal.userId,
            name: current.name,
            prefix: credential.prefix,
            keyHash: this.tokenHashes.hash(credential.key),
            expiresAt: new Date(now.getTime() + API_KEY_LIFETIME_MS),
            requestsPerMinute: current.requestsPerMinute,
            scopes: { create: stationIds.map((stationId) => ({ stationId })) },
          },
          select: apiKeyWithScopes,
        });
        await this.audits.record(transaction, {
          actorUserId: principal.userId,
          action: 'API_KEY_ROTATED',
          targetType: 'ApiKey',
          targetId: replacement.id,
          requestId,
          metadata: { previousApiKeyId: current.id },
        });
        return { key: credential.key, apiKey: toApiKeyDto(replacement) };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async revoke(
    principal: CurrentPrincipalValue,
    apiKeyId: string,
    requestId: string,
  ): Promise<{ revoked: boolean }> {
    const current = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { id: true, ownerUserId: true, revokedAt: true },
    });
    if (!current || (principal.role !== 'ADMIN' && current.ownerUserId !== principal.userId)) {
      throw new AppError('NOT_FOUND', 404, 'API key not found');
    }
    if (principal.role !== 'ADMIN' && principal.role !== 'CLIENT_DEVELOPER') {
      throw new AppError('FORBIDDEN', 403, 'API-key access is not allowed');
    }
    if (current.revokedAt) return { revoked: true };
    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.apiKey.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count === 1) {
        await this.audits.record(transaction, {
          actorUserId: principal.userId,
          action: 'API_KEY_REVOKED',
          targetType: 'ApiKey',
          targetId: current.id,
          requestId,
        });
      }
    });
    return { revoked: true };
  }

  async authenticate(rawKey: string, stationId: string): Promise<ApiKeyPrincipal> {
    const match = API_KEY_PATTERN.exec(rawKey);
    const stationIdIsValid = UUID_PATTERN.test(stationId);
    const queriedStationId = stationIdIsValid ? stationId : NIL_STATION_ID;
    const prefix = match?.[1] ?? 'invalid_';
    const presentedHash = this.tokenHashes.hash(match ? rawKey : 'invalid-api-key');
    const key = await this.prisma.apiKey.findUnique({
      where: { prefix },
      select: {
        id: true,
        ownerUserId: true,
        keyHash: true,
        expiresAt: true,
        revokedAt: true,
        requestsPerMinute: true,
        owner: {
          select: {
            role: true,
            status: true,
            clientStationGrants: {
              where: { stationId: queriedStationId },
              select: { stationId: true },
            },
          },
        },
        scopes: { where: { stationId: queriedStationId }, select: { stationId: true } },
      },
    });
    const hashesMatch = constantTimeHashEquals(presentedHash, key?.keyHash ?? DUMMY_HASH);
    if (
      !match ||
      !stationIdIsValid ||
      !hashesMatch ||
      !key ||
      key.revokedAt ||
      key.expiresAt <= new Date() ||
      key.owner.role !== 'CLIENT_DEVELOPER' ||
      key.owner.status !== 'ACTIVE' ||
      key.scopes.length !== 1 ||
      key.owner.clientStationGrants.length !== 1
    ) {
      this.invalidKey();
    }
    await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return {
      apiKeyId: key.id,
      ownerUserId: key.ownerUserId,
      stationId,
      requestsPerMinute: key.requestsPerMinute,
    };
  }

  private async createCredential(input: {
    ownerUserId: string;
    name: string;
    stationIds: readonly string[];
    requestId: string;
    action: string;
  }): Promise<{ key: string; apiKey: ApiKeyDto }> {
    const credential = generateCredential();
    return this.prisma.$transaction(async (transaction) => {
      await this.requireCurrentGrants(transaction, input.ownerUserId, input.stationIds);
      const created = await transaction.apiKey.create({
        data: {
          ownerUserId: input.ownerUserId,
          name: input.name,
          prefix: credential.prefix,
          keyHash: this.tokenHashes.hash(credential.key),
          expiresAt: new Date(Date.now() + API_KEY_LIFETIME_MS),
          requestsPerMinute: DEFAULT_REQUESTS_PER_MINUTE,
          scopes: { create: input.stationIds.map((stationId) => ({ stationId })) },
        },
        select: apiKeyWithScopes,
      });
      await this.audits.record(transaction, {
        actorUserId: input.ownerUserId,
        action: input.action,
        targetType: 'ApiKey',
        targetId: created.id,
        requestId: input.requestId,
        metadata: { stationCount: input.stationIds.length },
      });
      return { key: credential.key, apiKey: toApiKeyDto(created) };
    });
  }

  private requireClientDeveloper(principal: CurrentPrincipalValue): void {
    if (principal.role !== 'CLIENT_DEVELOPER') {
      throw new AppError('FORBIDDEN', 403, 'Client Developer access is required');
    }
  }

  private async requireCurrentGrants(
    transaction: Prisma.TransactionClient,
    userId: string,
    stationIds: readonly string[],
  ): Promise<void> {
    if (stationIds.length === 0) return;
    const count = await transaction.clientStationGrant.count({
      where: { userId, stationId: { in: [...stationIds] } },
    });
    if (count !== stationIds.length) {
      throw new AppError('FORBIDDEN', 403, 'One or more stations are not granted');
    }
  }

  private invalidKey(): never {
    throw new AppError('INVALID_API_KEY', 401, 'API key is invalid');
  }
}

function generateCredential(): { prefix: string; key: string } {
  const prefix = randomBytes(6).toString('base64url');
  return { prefix, key: `iot_live_${prefix}_${randomBytes(32).toString('base64url')}` };
}

function constantTimeHashEquals(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first, 'hex');
  const secondBuffer = Buffer.from(second, 'hex');
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

function toApiKeyDto(key: ApiKeyRecord): ApiKeyDto {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    expiresAt: key.expiresAt.toISOString(),
    requestsPerMinute: key.requestsPerMinute,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
    stationIds: key.scopes.map((scope) => scope.stationId),
  };
}
