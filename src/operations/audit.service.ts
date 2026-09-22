import { Injectable } from '@nestjs/common';

import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  type AuditEventDto,
  auditCursorFilters,
  decodeAuditCursor,
  encodeAuditCursor,
  type ListAuditEventsQuery,
} from './audit.contracts.js';

const SAFE_METADATA_KEYS = new Set([
  'apiKeysPurged',
  'familyId',
  'idempotencyClaimsPurged',
  'newRole',
  'newStatus',
  'notificationsPurged',
  'previousApiKeyId',
  'previousHolderUserId',
  'previousRole',
  'previousStatus',
  'role',
  'sessionsPurged',
  'source',
  'stationCount',
  'usersAnonymized',
  'alertsPurged',
]);

function safeMetadata(value: Prisma.JsonValue): Record<string, string | number | boolean | null> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') return {};
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string | number | boolean | null] =>
      SAFE_METADATA_KEYS.has(entry[0]) &&
      (entry[1] === null || ['string', 'number', 'boolean'].includes(typeof entry[1])),
  );
  return Object.fromEntries(entries);
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    principal: CurrentPrincipalValue,
    query: ListAuditEventsQuery,
  ): Promise<{ items: AuditEventDto[]; nextCursor: string | null }> {
    if (principal.status !== 'ACTIVE' || !principal.isSuperAdmin) {
      throw new AppError('FORBIDDEN', 403, 'Super Admin access is required');
    }
    const cursor = query.cursor ? decodeAuditCursor(query.cursor, query) : undefined;
    const rows = await this.prisma.securityAuditEvent.findMany({
      where: {
        ...(query.action ? { action: query.action } : {}),
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.result ? { result: query.result } : {}),
        ...(query.from && query.to
          ? { createdAt: { gte: new Date(query.from), lte: new Date(query.to) } }
          : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({
        id: row.id,
        actorUserId: row.actorUserId,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        result: row.result,
        requestId: row.requestId,
        metadata: safeMetadata(row.metadata),
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor:
        rows.length > query.limit && last
          ? encodeAuditCursor({
              v: 1,
              kind: 'audit',
              filters: auditCursorFilters(query),
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }
}
