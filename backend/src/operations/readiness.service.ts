import { Inject, Injectable, Optional } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { OperationsMetrics } from './operations-signals.js';

export type DependencyState = Readonly<{
  status: 'ready' | 'unavailable';
  checkedAt: string;
}>;

const READINESS_TIMEOUT_MS = 1_000;
export const READINESS_TIMEOUT = Symbol('READINESS_TIMEOUT');

@Injectable()
export class ReadinessService {
  private databaseProbe: Promise<unknown> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: OperationsMetrics,
    @Optional() @Inject(READINESS_TIMEOUT) timeoutMs?: number,
  ) {
    this.timeoutMs = timeoutMs ?? READINESS_TIMEOUT_MS;
  }

  private readonly timeoutMs: number;

  async probe(): Promise<DependencyState> {
    const checkedAt = new Date().toISOString();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.currentDatabaseProbe(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error('READINESS_TIMEOUT'));
          }, this.timeoutMs);
          timer.unref();
        }),
      ]);
      return { status: 'ready', checkedAt };
    } catch {
      this.metrics.recordDependencyFailure('database');
      return { status: 'unavailable', checkedAt };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private currentDatabaseProbe(): Promise<unknown> {
    if (this.databaseProbe) return this.databaseProbe;

    const tracked = Promise.resolve(this.prisma.$queryRaw`SELECT 1`).finally(() => {
      if (this.databaseProbe === tracked) this.databaseProbe = undefined;
    });
    this.databaseProbe = tracked;
    return tracked;
  }
}
