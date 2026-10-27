import { Injectable } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';

export type AuditInput = Readonly<{
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  requestId: string;
  metadata?: Prisma.InputJsonObject;
}>;

const SENSITIVE_METADATA_KEYS = new Set(
  [
    'accessToken',
    'apiKey',
    'authorization',
    'cookie',
    'credentialPepper',
    'currentPassword',
    'databaseUrl',
    'jwtSecret',
    'key',
    'keyHash',
    'newPassword',
    'password',
    'passwordHash',
    'refreshToken',
    'secret',
    'temporaryPassword',
    'token',
    'tokenHash',
  ].map((key) => key.toLowerCase()),
);

const REDACTED = '[REDACTED]';
const TRUNCATED = '[TRUNCATED]';
const MAX_METADATA_DEPTH = 8;
const MAX_ARRAY_ITEMS = 100;

function sanitizeAuditValue(value: unknown, depth: number): Prisma.InputJsonValue | null {
  if (depth > MAX_METADATA_DEPTH) {
    return TRUNCATED;
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeAuditValue(item, depth + 1));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value !== null && typeof value === 'object') {
    return sanitizeAuditObject(value as Record<string, unknown>, depth + 1);
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  return typeof value === 'bigint' ? value.toString() : '[UNSUPPORTED]';
}

function sanitizeAuditObject(
  metadata: Readonly<Record<string, unknown>>,
  depth: number,
): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      SENSITIVE_METADATA_KEYS.has(key.toLowerCase()) ? REDACTED : sanitizeAuditValue(value, depth),
    ]),
  );
}

export function sanitizeAuditMetadata(metadata: Prisma.InputJsonObject): Prisma.InputJsonObject {
  return sanitizeAuditObject(metadata, 0);
}

@Injectable()
export class SecurityAuditService {
  async record(transaction: Prisma.TransactionClient, input: AuditInput): Promise<void> {
    await transaction.securityAuditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        requestId: input.requestId,
        result: 'SUCCESS',
        metadata: sanitizeAuditMetadata(input.metadata ?? {}),
      },
    });
  }
}
