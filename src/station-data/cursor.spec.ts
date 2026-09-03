import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { decodeCursor, encodeCursor } from './cursor.js';

describe('station-data cursor codec', () => {
  it('round-trips a bounded typed hierarchy cursor', () => {
    const encoded = encodeCursor({ v: 1, kind: 'farm', name: 'Farm A', id: randomUUID() });

    expect(decodeCursor(encoded, 'farm')).toMatchObject({
      v: 1,
      kind: 'farm',
      name: 'Farm A',
    });
    expect(encoded).not.toContain('Farm A');
  });

  it.each(['', 'not-base64', Buffer.from('{}').toString('base64url'), 'x'.repeat(2049)])(
    'rejects malformed cursor %s',
    (cursor) =>
      expect(() => decodeCursor(cursor, 'farm')).toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
      ),
  );

  it('rejects a cursor from another route kind', () => {
    const cursor = encodeCursor({ v: 1, kind: 'farm', name: 'A', id: randomUUID() });

    expect(() => decodeCursor(cursor, 'plot')).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
    );
  });

  it('rejects unexpected fields in a cursor payload', () => {
    const cursor = Buffer.from(
      JSON.stringify({ v: 1, kind: 'farm', name: 'A', id: randomUUID(), leaked: true }),
      'utf8',
    ).toString('base64url');

    expect(() => decodeCursor(cursor, 'farm')).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });
});
