import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';

export const ALERT_RULE_SORT_CONTRACTS = ['createdAt_asc', 'createdAt_desc'] as const;
export type AlertRuleSortContract = (typeof ALERT_RULE_SORT_CONTRACTS)[number];

const alertRuleCursorPayloadSchema = z.strictObject({
  v: z.literal(1),
  kind: z.literal('alert-rule'),
  stationId: z.uuid(),
  sort: z.enum(ALERT_RULE_SORT_CONTRACTS).default('createdAt_asc'),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

export type AlertRuleCursorPayload = z.infer<typeof alertRuleCursorPayloadSchema>;

const alertCursorFiltersSchema = z.strictObject({
  stationId: z.uuid().nullable(),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).nullable(),
  severity: z.enum(['WARNING', 'CRITICAL']).nullable(),
});
const alertCursorPayloadSchema = z.strictObject({
  v: z.literal(1),
  kind: z.literal('alert'),
  sort: z.literal('updatedAt_desc'),
  filters: alertCursorFiltersSchema,
  updatedAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

export type AlertCursorFilters = Readonly<{
  stationId?: string;
  status?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  severity?: 'WARNING' | 'CRITICAL';
}>;
export type AlertCursorPayload = z.infer<typeof alertCursorPayloadSchema>;

const notificationCursorPayloadSchema = z.strictObject({
  v: z.literal(1),
  kind: z.literal('notification'),
  sort: z.literal('createdAt_desc'),
  isRead: z.boolean().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});
export type NotificationCursorPayload = z.infer<typeof notificationCursorPayloadSchema>;

function invalidCursor(): AppError {
  return new AppError('VALIDATION_ERROR', 400, 'Cursor is invalid');
}

function encodeCursor<T>(schema: z.ZodType<T>, value: T): string {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidCursor();

  const encoded = Buffer.from(JSON.stringify(parsed.data), 'utf8').toString('base64url');
  if (encoded.length > 2048) throw invalidCursor();
  return encoded;
}

function decodeCursor<T>(
  schema: z.ZodType<T>,
  value: string,
  matchesExpectedContext: (payload: T) => boolean,
): T {
  try {
    if (value.length < 1 || value.length > 2048) throw invalidCursor();

    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = schema.safeParse(JSON.parse(decoded));
    if (!parsed.success || !matchesExpectedContext(parsed.data)) throw invalidCursor();
    return parsed.data;
  } catch {
    throw invalidCursor();
  }
}

export function encodeAlertRuleCursor(value: AlertRuleCursorPayload): string {
  return encodeCursor(alertRuleCursorPayloadSchema, value);
}

export function decodeAlertRuleCursor(
  value: string,
  expectedStationId: string,
  expectedSort: AlertRuleSortContract = 'createdAt_asc',
): AlertRuleCursorPayload {
  return decodeCursor(
    alertRuleCursorPayloadSchema,
    value,
    (payload) => payload.stationId === expectedStationId && payload.sort === expectedSort,
  );
}

function normalizeAlertFilters(filters: AlertCursorFilters) {
  return {
    stationId: filters.stationId ?? null,
    status: filters.status ?? null,
    severity: filters.severity ?? null,
  };
}

export function encodeAlertCursor(value: AlertCursorPayload): string {
  return encodeCursor(alertCursorPayloadSchema, value);
}

export function decodeAlertCursor(
  value: string,
  expectedFilters: AlertCursorFilters,
): AlertCursorPayload {
  const normalizedFilters = JSON.stringify(normalizeAlertFilters(expectedFilters));
  return decodeCursor(
    alertCursorPayloadSchema,
    value,
    (payload) => JSON.stringify(payload.filters) === normalizedFilters,
  );
}

export function encodeNotificationCursor(value: NotificationCursorPayload): string {
  return encodeCursor(notificationCursorPayloadSchema, value);
}

export function decodeNotificationCursor(
  value: string,
  expectedIsRead?: boolean,
): NotificationCursorPayload {
  return decodeCursor(
    notificationCursorPayloadSchema,
    value,
    (payload) => payload.isRead === (expectedIsRead ?? null),
  );
}
