import { describe, expect, it } from 'vitest';

import { ClientRateLimitStore } from './client-rate-limit.guard.js';

describe('ClientRateLimitStore', () => {
  it('isolates keys and resets at the next minute', () => {
    let now = new Date(1_700_000_005_000);
    const store = new ClientRateLimitStore({ now: () => now });
    const principal = { apiKeyId: 'key-1', ownerUserId: 'user-1', requestsPerMinute: 2 };

    expect(store.consume(principal)).toEqual({
      limit: 2,
      remaining: 1,
      resetEpochSeconds: 1_700_000_040,
    });
    expect(store.consume(principal).remaining).toBe(0);
    expect(() => store.consume(principal)).toThrow(
      expect.objectContaining({ code: 'RATE_LIMITED', statusCode: 429 }),
    );
    expect(
      store.consume({ apiKeyId: 'key-2', ownerUserId: 'user-2', requestsPerMinute: 5 }).remaining,
    ).toBe(4);

    now = new Date(1_700_000_065_000);
    expect(store.consume(principal).remaining).toBe(1);
  });

  it('evicts expired entries before the least recently used entry', () => {
    let now = new Date(1_700_000_000_000);
    const store = new ClientRateLimitStore({ now: () => now }, 2);
    const principal = (apiKeyId: string) => ({
      apiKeyId,
      ownerUserId: 'owner',
      requestsPerMinute: 10,
    });

    store.consume(principal('key-1'));
    store.consume(principal('key-2'));
    now = new Date(1_700_000_065_000);
    store.consume(principal('key-3'));
    store.consume(principal('key-4'));
    store.consume(principal('key-3'));
    store.consume(principal('key-5'));

    expect(store.consume(principal('key-3')).remaining).toBe(7);
    expect(store.consume(principal('key-4')).remaining).toBe(9);
  });
});
