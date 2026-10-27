import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../common/errors/app-error.js';
import { BoundedAsyncCache, type CacheResult } from './bounded-cache.js';

const defer = <T>() => {
  let resolve!: (v: T) => void;
  return {
    promise: new Promise<T>((res) => {
      resolve = res;
    }),
    resolve,
  };
};

const makeCache = <T = string>(
  opts: Partial<{
    ttlMs: number;
    staleIfErrorMs: number;
    maxEntries: number;
    now: () => number;
    canServeStale: (e: unknown) => boolean;
  }> = {},
  now = () => 1000,
) =>
  new BoundedAsyncCache<T>({
    ttlMs: 30_000,
    staleIfErrorMs: 60_000,
    maxEntries: 10,
    now,
    ...opts,
  });

describe('BoundedAsyncCache', () => {
  it('handles miss, fresh hit, LRU touch, and expiry reload', async () => {
    let now = 1000;
    const cache = makeCache({}, () => now);
    const loader = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');

    // Miss: isFromCache false, isStale false
    const miss = await cache.get('k1', loader);
    expect(miss).toEqual<CacheResult<string>>({ value: 'v1', isFromCache: false, isStale: false });
    expect(loader).toHaveBeenCalledTimes(1);

    // Fresh hit: isFromCache true, isStale false, no new loader call
    now += 15_000;
    const hit = await cache.get('k1', loader);
    expect(hit).toEqual<CacheResult<string>>({ value: 'v1', isFromCache: true, isStale: false });
    expect(loader).toHaveBeenCalledTimes(1);

    // Expiry reload: calls loader again
    now += 15_000;
    const reload = await cache.get('k1', loader);
    expect(reload).toEqual<CacheResult<string>>({
      value: 'v2',
      isFromCache: false,
      isStale: false,
    });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent requests for the same key and removes rejected loader', async () => {
    const d = defer<string>();
    const loader = vi.fn(() => d.promise);
    const cache = makeCache();

    const [c1, c2] = [cache.get('k1', loader), cache.get('k1', loader)];
    expect(loader).toHaveBeenCalledTimes(1);
    d.resolve('shared');
    expect(await Promise.all([c1, c2])).toEqual([
      { value: 'shared', isFromCache: false, isStale: false },
      { value: 'shared', isFromCache: false, isStale: false },
    ]);

    // Rejected loader removed and retried
    await expect(cache.get('k2', vi.fn().mockRejectedValue(new Error('fail')))).rejects.toThrow(
      'fail',
    );
    const retry = await cache.get('k2', vi.fn().mockResolvedValue('recovered'));
    expect(retry.value).toBe('recovered');
  });

  it.each([
    ['UPSTREAM_TIMEOUT', 504, 30_000, true],
    ['UPSTREAM_UNAVAILABLE', 502, 30_000, true],
    ['RATE_LIMITED', 429, 30_000, true],
    ['UPSTREAM_INVALID_RESPONSE', 502, 30_000, true],
    ['UPSTREAM_UNAVAILABLE', 502, 90_001, false], // beyond grace
    ['UNAUTHENTICATED', 401, 30_000, false], // unapproved predicate
  ] as const)(
    'handles stale fallback %s (advance %i, servesStale %s)',
    async (code, status, adv, serves) => {
      let now = 1000;
      const cache = makeCache({}, () => now);
      await cache.get('k1', vi.fn().mockResolvedValue('good'));
      now += adv;

      const loader = vi.fn().mockRejectedValue(new AppError(code, status, 'err'));
      if (serves) {
        expect(await cache.get('k1', loader)).toEqual<CacheResult<string>>({
          value: 'good',
          isFromCache: true,
          isStale: true,
        });
      } else {
        await expect(cache.get('k1', loader)).rejects.toMatchObject({ code });
      }
    },
  );

  it('respects custom canServeStale predicate', async () => {
    let now = 1000;
    const pred = vi.fn().mockReturnValue(true);
    const cache = makeCache({ canServeStale: pred }, () => now);
    await cache.get('k1', vi.fn().mockResolvedValue('good'));
    now += 30_000;

    const res = await cache.get('k1', vi.fn().mockRejectedValue(new Error('custom')));
    expect(res).toEqual<CacheResult<string>>({ value: 'good', isFromCache: true, isStale: true });
    expect(pred).toHaveBeenCalled();
  });

  it('bounds completed entries to maxEntries with LRU eviction and touches on access', async () => {
    const cache = makeCache({ maxEntries: 2 });
    await cache.get('k1', vi.fn().mockResolvedValue('v1'));
    await cache.get('k2', vi.fn().mockResolvedValue('v2'));
    await cache.get('k1', vi.fn()); // touch k1 (becomes MRU)
    await cache.get('k3', vi.fn().mockResolvedValue('v3')); // evicts k2

    expect((await cache.get('k1', vi.fn())).value).toBe('v1');
    const k2Loader = vi.fn().mockResolvedValue('v2-reloaded');
    expect((await cache.get('k2', k2Loader)).value).toBe('v2-reloaded');
    expect(k2Loader).toHaveBeenCalledTimes(1);
  });

  it('bounds in-flight distinct keys with UPSTREAM_UNAVAILABLE', async () => {
    const cache = makeCache({ maxEntries: 2 });
    const [d1, d2] = [defer<string>(), defer<string>()];
    const p1 = cache.get('k1', () => d1.promise);
    const p2 = cache.get('k2', () => d2.promise);
    const p1Coalesce = cache.get('k1', () => Promise.resolve('ignored'));

    await expect(cache.get('k3', () => Promise.resolve('v3'))).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      statusCode: 502,
    });

    d1.resolve('v1');
    d2.resolve('v2');
    await Promise.all([p1, p2, p1Coalesce]);
    expect((await cache.get('k3', () => Promise.resolve('v3'))).value).toBe('v3');
  });

  it('clears completed and in-flight state deterministically', async () => {
    const cache = makeCache();
    await cache.get('k1', vi.fn().mockResolvedValue('v1'));
    cache.clear();

    const reloadLoader = vi.fn().mockResolvedValue('v1-new');
    expect(await cache.get('k1', reloadLoader)).toEqual<CacheResult<string>>({
      value: 'v1-new',
      isFromCache: false,
      isStale: false,
    });
    expect(reloadLoader).toHaveBeenCalledTimes(1);
  });

  it('handles in-flight clear without coalescing and prevents stale repopulation', async () => {
    const cache = makeCache();
    const [dA, dB] = [defer<string>(), defer<string>()];
    const loaderA = vi.fn(() => dA.promise);
    const loaderB = vi.fn(() => dB.promise);

    const pA = cache.get('k1', loaderA);
    cache.clear();

    const pB = cache.get('k1', loaderB);
    expect(loaderB).toHaveBeenCalledTimes(1);

    dA.resolve('val-A');
    dB.resolve('val-B');
    const [resA, resB] = await Promise.all([pA, pB]);

    expect(resA.value).toBe('val-A');
    expect(resB.value).toBe('val-B');

    const hit = await cache.get('k1', vi.fn());
    expect(hit).toEqual<CacheResult<string>>({
      value: 'val-B',
      isFromCache: true,
      isStale: false,
    });
  });
});
