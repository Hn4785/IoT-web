import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';

const auditResultSchema = z.enum(['SUCCESS', 'DENIED', 'FAILURE']);
const auditFilterToken = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Z][A-Z0-9_]*$/);
const auditTimestamp = z.iso.datetime({ offset: true });

const listAuditEventsSchema = z
  .strictObject({
    action: auditFilterToken.optional(),
    targetType: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z][A-Za-z0-9]*$/)
      .optional(),
    result: auditResultSchema.optional(),
    from: auditTimestamp.optional(),
    to: auditTimestamp.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().trim().min(1).max(2048).optional(),
  })
  .superRefine((value, context) => {
    if ((value.from === undefined) !== (value.to === undefined)) {
      context.addIssue({ code: 'custom', message: 'from and to must be provided together' });
      return;
    }
    if (value.from && value.to) {
      const from = Date.parse(value.from);
      const to = Date.parse(value.to);
      if (from > to || to - from > 31 * 24 * 60 * 60 * 1000) {
        context.addIssue({ code: 'custom', message: 'Audit time range is invalid' });
      }
    }
  });

const auditCursorSchema = z.strictObject({
  v: z.literal(1),
  kind: z.literal('audit'),
  filters: z.strictObject({
    action: z.string().nullable(),
    targetType: z.string().nullable(),
    result: auditResultSchema.nullable(),
    from: z.string().nullable(),
    to: z.string().nullable(),
  }),
  createdAt: auditTimestamp,
  id: z.uuid(),
});

export type ListAuditEventsQuery = z.infer<typeof listAuditEventsSchema>;
export type AuditCursor = z.infer<typeof auditCursorSchema>;

export type AuditEventDto = Readonly<{
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  result: 'SUCCESS' | 'DENIED' | 'FAILURE';
  requestId: string;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  createdAt: string;
}>;

export function parseListAuditEvents(value: unknown): ListAuditEventsQuery {
  const parsed = listAuditEventsSchema.safeParse(value ?? {});
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 400, 'Audit query is invalid');
  }
  return parsed.data;
}

function normalizedFilters(query: ListAuditEventsQuery): AuditCursor['filters'] {
  return {
    action: query.action ?? null,
    targetType: query.targetType ?? null,
    result: query.result ?? null,
    from: query.from ?? null,
    to: query.to ?? null,
  };
}

function invalidCursor(): never {
  throw new AppError('VALIDATION_ERROR', 400, 'Cursor is invalid');
}

export function encodeAuditCursor(value: AuditCursor): string {
  const parsed = auditCursorSchema.safeParse(value);
  if (!parsed.success) return invalidCursor();
  const encoded = Buffer.from(JSON.stringify(parsed.data), 'utf8').toString('base64url');
  if (encoded.length > 2048) return invalidCursor();
  return encoded;
}

export function decodeAuditCursor(value: string, query: ListAuditEventsQuery): AuditCursor {
  try {
    if (value.length > 2048) return invalidCursor();
    const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const parsed = auditCursorSchema.safeParse(decoded);
    if (
      !parsed.success ||
      JSON.stringify(parsed.data.filters) !== JSON.stringify(normalizedFilters(query))
    ) {
      return invalidCursor();
    }
    return parsed.data;
  } catch {
    return invalidCursor();
  }
}

export function auditCursorFilters(query: ListAuditEventsQuery): AuditCursor['filters'] {
  return normalizedFilters(query);
}

export const auditEventPageEnvelopeOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['items', 'nextCursor'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'id',
              'actorUserId',
              'action',
              'targetType',
              'targetId',
              'result',
              'requestId',
              'metadata',
              'createdAt',
            ],
            properties: {
              id: { type: 'string', format: 'uuid' },
              actorUserId: { type: 'string', format: 'uuid', nullable: true },
              action: { type: 'string' },
              targetType: { type: 'string' },
              targetId: { type: 'string', nullable: true },
              result: { type: 'string', enum: ['SUCCESS', 'DENIED', 'FAILURE'] },
              requestId: { type: 'string' },
              metadata: { type: 'object', additionalProperties: true },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        nextCursor: { type: 'string', nullable: true },
      },
    },
  },
};
