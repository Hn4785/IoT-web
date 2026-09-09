import { AppError } from '../common/errors/app-error.js';

export type CacheResult<T> = Readonly<{
  value: T;
  isFromCache: boolean;
  isStale: boolean;
}>;

export interface BoundedAsyncCacheOptions {
  ttlMs: number;
  staleIfErrorMs: number;
  maxEntries: number;
  now?: () => number;
  canServeStale?: (error: unknown) => boolean;
}

export interface StationDataClock {
  now(): Date;
}

export const STATION_DATA_CLOCK = Symbol('STATION_DATA_CLOCK');
export const LATEST_SOIL_CACHE = Symbol('LATEST_SOIL_CACHE');
export const HISTORY_SOIL_CACHE = Symbol('HISTORY_SOIL_CACHE');

interface Entry<T> {
  value: T;
  freshUntil: number;
  staleUntil: number;
}

const isEligibleStale = (err: unknown): boolean =>
  err instanceof AppError &&
  [
    'UPSTREAM_TIMEOUT',
    'UPSTREAM_UNAVAILABLE',
    'RATE_LIMITED',
    'UPSTREAM_INVALID_RESPONSE',
  ].includes(err.code);

export class BoundedAsyncCache<T> {
  private readonly ttlMs: number;
  private readonly staleIfErrorMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly canServeStale: (error: unknown) => boolean;
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inFlight = new Map<string, Promise<CacheResult<T>>>();
  private gen = 0;

  constructor(opts: BoundedAsyncCacheOptions) {
    this.ttlMs = opts.ttlMs;
    this.staleIfErrorMs = opts.staleIfErrorMs;
    this.maxEntries = opts.maxEntries;
    this.now = opts.now ?? Date.now;
    this.canServeStale = opts.canServeStale ?? isEligibleStale;
  }

  private touch(key: string, entry: Entry<T>): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private trim(now: number, neededKey?: string): void {
    for (const [k, e] of this.entries) if (now > e.staleUntil) this.entries.delete(k);
    if (neededKey && this.entries.has(neededKey)) return;
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  async get(key: string, loader: () => Promise<T>): Promise<CacheResult<T>> {
    const existing = this.entries.get(key);
    const now = this.now();
    if (existing && now < existing.freshUntil) {
      this.touch(key, existing);
      return { value: existing.value, isFromCache: true, isStale: false };
    }
    const inflight = this.inFlight.get(key);
    if (inflight) return inflight;
    if (this.inFlight.size >= this.maxEntries) {
      throw new AppError('UPSTREAM_UNAVAILABLE', 502, 'Weather service is unavailable');
    }
    this.trim(now, key);
    const g = this.gen;
    const promise = (async (): Promise<CacheResult<T>> => {
      try {
        const value = await loader();
        if (this.gen !== g) return { value, isFromCache: false, isStale: false };
        const fin = this.now();
        this.trim(fin, key);
        this.touch(key, {
          value,
          freshUntil: fin + this.ttlMs,
          staleUntil: fin + this.ttlMs + this.staleIfErrorMs,
        });
        return { value, isFromCache: false, isStale: false };
      } catch (err) {
        if (this.gen === g) {
          const errTime = this.now();
          const fallback = this.entries.get(key) ?? existing;
          if (fallback && errTime <= fallback.staleUntil && this.canServeStale(err)) {
            this.touch(key, fallback);
            return { value: fallback.value, isFromCache: true, isStale: true };
          }
        }
        throw err;
      } finally {
        if (this.gen === g) this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.gen++;
    this.entries.clear();
    this.inFlight.clear();
  }
}
