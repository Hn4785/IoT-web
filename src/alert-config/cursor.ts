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

function invalidCursor(): AppError {
  return new AppError('VALIDATION_ERROR', 400, 'Cursor is invalid');
}

export function encodeAlertRuleCursor(value: AlertRuleCursorPayload): string {
  const parsed = alertRuleCursorPayloadSchema.safeParse(value);
  if (!parsed.success) throw invalidCursor();

  const payload = {
    v: 1,
    kind: 'alert-rule' as const,
    stationId: parsed.data.stationId,
    sort: parsed.data.sort,
    createdAt: parsed.data.createdAt,
    id: parsed.data.id,
  };

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  if (encoded.length > 2048) throw invalidCursor();
  return encoded;
}

export function decodeAlertRuleCursor(
  value: string,
  expectedStationId: string,
  expectedSort: AlertRuleSortContract = 'createdAt_asc',
): AlertRuleCursorPayload {
  try {
    if (typeof value !== 'string' || value.length < 1 || value.length > 2048) {
      throw invalidCursor();
    }
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = alertRuleCursorPayloadSchema.safeParse(JSON.parse(decoded));
    if (
      !parsed.success ||
      parsed.data.stationId !== expectedStationId ||
      parsed.data.sort !== expectedSort
    ) {
      throw invalidCursor();
    }
    return parsed.data;
  } catch {
    throw invalidCursor();
  }
}
