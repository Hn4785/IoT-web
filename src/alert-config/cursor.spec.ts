import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  decodeAlertCursor,
  decodeAlertRuleCursor,
  decodeNotificationCursor,
  encodeAlertCursor,
  encodeAlertRuleCursor,
  encodeNotificationCursor,
  type AlertCursorPayload,
  type AlertRuleCursorPayload,
  type NotificationCursorPayload,
} from './cursor.js';

describe('alert-rule cursor codec', () => {
  const stationId = randomUUID();
  const ruleId = randomUUID();
  const sampleTime = '2026-09-02T12:00:00.000Z';

  const validPayload: AlertRuleCursorPayload = {
    v: 1,
    kind: 'alert-rule',
    stationId,
    sort: 'createdAt_asc',
    createdAt: sampleTime,
    id: ruleId,
  };

  it('round-trips an opaque alert-rule cursor', () => {
    const encoded = encodeAlertRuleCursor(validPayload);
    expect(typeof encoded).toBe('string');
    expect(encoded).not.toContain(stationId);
    expect(encoded).not.toContain(ruleId);

    const decoded = decodeAlertRuleCursor(encoded, stationId);
    expect(decoded).toEqual(validPayload);
  });

  it('remains deterministic for identical payloads', () => {
    const encoded1 = encodeAlertRuleCursor(validPayload);
    const encoded2 = encodeAlertRuleCursor(validPayload);
    expect(encoded1).toBe(encoded2);
  });

  it.each([
    ['empty string', ''],
    ['not base64', '!!!invalid-base64???'],
    ['invalid JSON', Buffer.from('{bad-json').toString('base64url')],
    ['empty object', Buffer.from('{}').toString('base64url')],
    ['exceeds length limit', 'a'.repeat(2049)],
    [
      'wrong kind',
      Buffer.from(JSON.stringify({ ...validPayload, kind: 'other' })).toString('base64url'),
    ],
    ['wrong version', Buffer.from(JSON.stringify({ ...validPayload, v: 2 })).toString('base64url')],
  ])('rejects malformed cursor: %s', (_desc, cursor) => {
    expect(() => decodeAlertRuleCursor(cursor, stationId)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
    );
  });

  it('rejects cursor when stationId does not match expected station', () => {
    const encoded = encodeAlertRuleCursor(validPayload);
    const otherStationId = randomUUID();

    expect(() => decodeAlertRuleCursor(encoded, otherStationId)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
    );
  });

  it('rejects cursor when sort contract does not match', () => {
    const encoded = encodeAlertRuleCursor(validPayload);

    expect(() => decodeAlertRuleCursor(encoded, stationId, 'createdAt_desc')).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
    );
  });

  it('rejects unexpected fields in cursor payload', () => {
    const tampered = Buffer.from(
      JSON.stringify({ ...validPayload, extraField: 'injected' }),
      'utf8',
    ).toString('base64url');

    expect(() => decodeAlertRuleCursor(tampered, stationId)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
    );
  });
});

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

describe('alert cursor codec', () => {
  const filters = { stationId: randomUUID(), status: 'OPEN', severity: 'CRITICAL' } as const;
  const payload: AlertCursorPayload = {
    v: 1,
    kind: 'alert',
    sort: 'updatedAt_desc',
    filters,
    updatedAt: '2026-09-17T00:00:00.000Z',
    id: randomUUID(),
  };

  it('round-trips and binds the active filters', () => {
    const encoded = encodeAlertCursor(payload);
    expect(decodeAlertCursor(encoded, filters)).toEqual(payload);
    expect(() => decodeAlertCursor(encoded, { ...filters, severity: 'WARNING' })).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
    );
  });

  it('rejects malformed alert cursors', () => {
    expect(() => decodeAlertCursor('not-a-cursor', filters)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
    );
  });
});
