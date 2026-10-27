import { CanActivate, ExecutionContext, Inject, Injectable, Optional } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import type { ApiKeyPrincipal } from '../api-keys/api-key.service.js';
import { AppError } from '../common/errors/app-error.js';
import { STATION_DATA_CLOCK, type StationDataClock } from './bounded-cache.js';

export type RateLimitDecision = Readonly<{
  limit: number;
  remaining: number;
  resetEpochSeconds: number;
}>;

export class RateLimitError extends AppError {
  constructor(
    readonly limit: number,
    readonly resetEpochSeconds: number,
  ) {
    super('RATE_LIMITED', 429, 'Too many requests');
  }
}

type WindowEntry = { resetEpochSeconds: number; count: number };

@Injectable()
export class ClientRateLimitStore {
  private readonly entries = new Map<string, WindowEntry>();
  private readonly clock: StationDataClock;

  constructor(
    @Optional() @Inject(STATION_DATA_CLOCK) clock?: StationDataClock,
    @Optional() private readonly maxEntries = 10_000,
  ) {
    this.clock = clock ?? { now: () => new Date() };
  }

  consume(principal: ApiKeyPrincipal): RateLimitDecision {
    const nowSec = Math.floor(this.clock.now().getTime() / 1000);
    const resetEpochSeconds = (Math.floor(nowSec / 60) + 1) * 60;
    const limit = principal.requestsPerMinute;
    const existing = this.entries.get(principal.apiKeyId);

    if (existing && existing.resetEpochSeconds > nowSec) {
      this.entries.delete(principal.apiKeyId);
      this.entries.set(principal.apiKeyId, existing);
      if (existing.count >= limit) throw new RateLimitError(limit, existing.resetEpochSeconds);
      existing.count += 1;
      return {
        limit,
        remaining: limit - existing.count,
        resetEpochSeconds: existing.resetEpochSeconds,
      };
    }

    if (existing) this.entries.delete(principal.apiKeyId);
    this.makeCapacity(nowSec);
    if (limit < 1) throw new RateLimitError(limit, resetEpochSeconds);
    this.entries.set(principal.apiKeyId, { resetEpochSeconds, count: 1 });
    return { limit, remaining: limit - 1, resetEpochSeconds };
  }

  private makeCapacity(nowSec: number): void {
    if (this.entries.size < this.maxEntries) return;
    for (const [key, entry] of this.entries) {
      if (entry.resetEpochSeconds <= nowSec) this.entries.delete(key);
    }
    if (this.entries.size < this.maxEntries) return;
    const oldestKey = this.entries.keys().next().value;
    if (oldestKey) this.entries.delete(oldestKey);
  }
}

@Injectable()
export class ClientRateLimitGuard implements CanActivate {
  constructor(private readonly store: ClientRateLimitStore) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<{ apiKeyPrincipal?: ApiKeyPrincipal }>();
    const reply = http.getResponse<FastifyReply>();
    const principal = request.apiKeyPrincipal;
    if (!principal) return true;

    try {
      this.setHeaders(reply, this.store.consume(principal));
      return true;
    } catch (error) {
      if (error instanceof RateLimitError) {
        this.setHeaders(reply, {
          limit: error.limit,
          remaining: 0,
          resetEpochSeconds: error.resetEpochSeconds,
        });
      }
      throw error;
    }
  }

  private setHeaders(reply: FastifyReply, decision: RateLimitDecision): void {
    void reply.header('X-RateLimit-Limit', String(decision.limit));
    void reply.header('X-RateLimit-Remaining', String(decision.remaining));
    void reply.header('X-RateLimit-Reset', String(decision.resetEpochSeconds));
  }
}
