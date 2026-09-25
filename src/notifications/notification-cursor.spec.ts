import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  decodeNotificationCursor,
  encodeNotificationCursor,
  type NotificationCursorPayload,
} from './notification-cursor.js';

describe('notification cursor codec', () => {
  const payload: NotificationCursorPayload = {
    v: 1,
    kind: 'notification',
    sort: 'createdAt_desc',
    isRead: false,
    createdAt: '2026-09-18T00:00:00.000Z',
    id: randomUUID(),
  };

  it('round-trips and binds the read filter', () => {
    const encoded = encodeNotificationCursor(payload);
    expect(decodeNotificationCursor(encoded, false)).toEqual(payload);
    expect(() => decodeNotificationCursor(encoded, true)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
    );
  });

  it('rejects malformed notification cursors', () => {
    expect(() => decodeNotificationCursor('not-a-cursor')).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
    );
  });
});
