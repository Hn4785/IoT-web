import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';

const schema = z.strictObject({
  v: z.literal(1),
  kind: z.literal('notification'),
  sort: z.literal('createdAt_desc'),
  isRead: z.boolean().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

export type NotificationCursorPayload = z.infer<typeof schema>;

function invalidCursor(): AppError {
  return new AppError('VALIDATION_ERROR', 400, 'Cursor is invalid');
}

export function encodeNotificationCursor(value: NotificationCursorPayload): string {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidCursor();
  const encoded = Buffer.from(JSON.stringify(parsed.data), 'utf8').toString('base64url');
  if (encoded.length > 2048) throw invalidCursor();
  return encoded;
}

export function decodeNotificationCursor(
  value: string,
  expectedIsRead?: boolean,
): NotificationCursorPayload {
  try {
    if (value.length < 1 || value.length > 2048) throw invalidCursor();
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = schema.safeParse(JSON.parse(decoded));
    if (!parsed.success || parsed.data.isRead !== (expectedIsRead ?? null)) throw invalidCursor();
    return parsed.data;
  } catch {
    throw invalidCursor();
  }
}
