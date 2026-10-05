import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppError } from '../common/errors/app-error.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { PrismaService } from '../database/prisma.service.js';
import { SoilReadingRepository } from './soil-reading.repository.js';
import { StationSourceClientResolver } from './station-source-client.resolver.js';
import type { AuthorizedStation } from './station.repository.js';
import { SOIL_FIELDS } from './station-data.contracts.js';
import { mapLatestSoil } from './soil.mapper.js';
import { traverseRawHistory } from './raw-history-traversal.js';
import { CollectionLeaseLostError, type CollectionWriteOptions } from './collection-write.js';
import { OperationsMetrics } from '../operations/operations-signals.js';

type DueStation = AuthorizedStation & { historyThrough: Date | null; failureCount: number };
type RunFence = { holderId: string; valid: boolean };
const DAY_MS = 86_400_000;

@Injectable()
export class SoilCollectionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SoilCollectionService.name);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<{ acquired: boolean; processed: number }> | undefined;
  private stopping = false;
  private fence: RunFence | undefined;
  constructor(
    private readonly prisma: PrismaService,
    private readonly readings: SoilReadingRepository,
    private readonly sources: StationSourceClientResolver,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Optional() private readonly metrics?: OperationsMetrics,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.soilCollectionEnabled) this.schedule(0);
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => {
      void this.runOnce()
        .catch(() => {
          this.signal('database_error');
        })
        .finally(() => {
          if (!this.stopping) this.schedule(this.config.soilCollectionIntervalMs);
        });
    }, delay);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.fence) this.fence.valid = false;
    clearTimeout(this.timer);
    let drainTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.inFlight?.catch(() => {
          this.signal('database_error');
        }),
        new Promise<void>((resolve) => {
          drainTimer = setTimeout(resolve, this.config.weatherApiTimeoutMs + 5000);
        }),
      ]);
    } finally {
      clearTimeout(drainTimer);
    }
  }

  async runOnce(now = new Date()): Promise<{ acquired: boolean; processed: number }> {
    if (this.stopping || this.inFlight) return { acquired: false, processed: 0 };
    this.inFlight = this.collect(now);
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = undefined;
    }
  }

  private async collect(now: Date): Promise<{ acquired: boolean; processed: number }> {
    const fence: RunFence = { holderId: randomUUID(), valid: true };
    const acquired = await this.prisma.$executeRaw`
      INSERT INTO "EvaluatorLease" (name, "holderId", "expiresAt", "updatedAt") VALUES ('soil-collector', ${fence.holderId}, clock_timestamp() + ${this.config.soilCollectionLeaseMs} * interval '1 millisecond', clock_timestamp())
      ON CONFLICT (name) DO UPDATE SET "holderId" = EXCLUDED."holderId", "expiresAt" = EXCLUDED."expiresAt", "updatedAt" = EXCLUDED."updatedAt"
      WHERE "EvaluatorLease"."expiresAt" <= clock_timestamp()`;
    if (!acquired) {
      this.signal('skipped');
      return { acquired: false, processed: 0 };
    }
    this.fence = fence;
    let renewing = false;
    const heartbeat = setInterval(
      () => {
        if (!fence.valid || renewing) return;
        renewing = true;
        void this.prisma.$executeRaw`
        UPDATE "EvaluatorLease" SET "expiresAt" = clock_timestamp() + ${this.config.soilCollectionLeaseMs} * interval '1 millisecond', "updatedAt" = clock_timestamp()
        WHERE name = 'soil-collector' AND "holderId" = ${fence.holderId} AND "expiresAt" > clock_timestamp()`
          .then((count) => {
            if (!count) fence.valid = false;
          })
          .catch(() => {
            fence.valid = false;
            this.signal('database_error');
          })
          .finally(() => {
            renewing = false;
          });
      },
      Math.max(250, Math.floor(this.config.soilCollectionLeaseMs / 3)),
    );
    heartbeat.unref();
    let processed = 0;
    try {
      await this.readings.prune(now);
      const stations = await this.prisma.$queryRaw<DueStation[]>`
        SELECT s.id, s."dataSourceId", s."plotId", s.name, s."upstreamCode", s."upstreamCode" AS code, p."farmId",
          c."historyThrough" AT TIME ZONE 'UTC' AS "historyThrough", COALESCE(c."failureCount", 0) AS "failureCount"
        FROM "Station" s JOIN "DataSource" d ON d.id = s."dataSourceId" AND d."removedAt" IS NULL
          JOIN "Plot" p ON p.id = s."plotId" LEFT JOIN "SoilCollectionCheckpoint" c ON c."stationId" = s.id
        WHERE s."upstreamCode" <> 'CENTER' AND (c."nextAttemptAt" IS NULL OR c."nextAttemptAt" <= ${now.toISOString()}::timestamptz)
        ORDER BY c."nextAttemptAt" ASC NULLS FIRST, s.id LIMIT ${this.config.soilCollectionBatchSize}`;
      let index = 0;
      const work = async () => {
        while (fence.valid && !this.stopping) {
          const station = stations[index++];
          if (!station) return;
          await this.collectStation(station, now, fence);
          processed++;
        }
      };
      await Promise.all(
        Array.from({ length: this.config.soilCollectionConcurrency }, () => work()),
      );
      return { acquired: true, processed };
    } finally {
      fence.valid = false;
      clearInterval(heartbeat);
      await this.prisma
        .$executeRaw`DELETE FROM "EvaluatorLease" WHERE name = 'soil-collector' AND "holderId" = ${fence.holderId}`.catch(
        () => undefined,
      );
      if (this.fence === fence) this.fence = undefined;
    }
  }

  private async collectStation(station: DueStation, now: Date, fence: RunFence): Promise<void> {
    const canCommit = () => fence.valid && !this.stopping;
    const nextAttemptAt = new Date(now.getTime() + this.config.soilCollectionIntervalMs);
    const options: CollectionWriteOptions = { holderId: fence.holderId, canCommit };
    let resolving = true;
    try {
      const weather = await this.sources.resolve(station.dataSourceId);
      resolving = false;
      if (!canCommit()) throw new CollectionLeaseLostError();
      const latestGeneration = new Date();
      const upstream = await weather.getLatest({
        station: [station.upstreamCode],
        type: ['soil'],
        fields: [...SOIL_FIELDS],
      });
      const latest = mapLatestSoil({
        station,
        fields: SOIL_FIELDS,
        fetchedAt: latestGeneration,
        upstream,
      });
      const snapshot = await this.readings.ingestLatest(station, latest, options);
      if (snapshot.storageLimited) {
        await this.readings.updateCollectionCheckpoint(station, {
          ...options,
          checkpoint: {
            nextAttemptAt,
            outcome: 'storage_limit',
            successfulFetchAt: new Date(latest.fetchedAt),
          },
        });
        this.signal('storage_limit');
        return;
      }
      if (!canCommit()) throw new CollectionLeaseLostError();
      const begin = new Date(
        Math.max(now.getTime() - 90 * DAY_MS, station.historyThrough?.getTime() ?? 0),
      );
      const end = new Date(Math.min(now.getTime(), begin.getTime() + DAY_MS));
      const state = { limited: false };
      let pageGeneration = latestGeneration;
      const result = await traverseRawHistory({
        stationCode: station.upstreamCode,
        fields: SOIL_FIELDS,
        begin,
        end,
        maxPages: this.config.soilCollectionPageLimit,
        pageSize: 5000,
        canContinue: () => canCommit() && !state.limited,
        fetch: (query) => {
          pageGeneration = new Date();
          return weather.getHistory({
            station: [query.stationCode],
            type: ['soil'],
            fields: [...query.fields],
            begin: query.begin,
            end: query.end,
            limit: query.limit,
            order: query.order,
            interval: query.interval,
          });
        },
        commit: async (batch, coverage, resumeAt) => {
          const fetchedAt = pageGeneration;
          const saved = await this.readings.ingestHistory(station, batch, fetchedAt, coverage, {
            ...options,
            checkpoint: {
              resumeAt,
              nextAttemptAt,
              outcome: 'success',
              successfulFetchAt: fetchedAt,
            },
          });
          state.limited = saved.storageLimited;
        },
      });
      if (state.limited) {
        this.signal('storage_limit');
        return;
      }
      if (result.outcome === 'stopped') throw new CollectionLeaseLostError();
      const outcome = result.outcome === 'complete' ? 'success' : result.outcome;
      await this.readings.updateCollectionCheckpoint(station, {
        ...options,
        checkpoint: { nextAttemptAt, outcome },
      });
      if (!canCommit()) throw new CollectionLeaseLostError();
      await this.sources.markConnected(station.dataSourceId, new Date(latest.fetchedAt));
      this.signal(outcome);
    } catch (error) {
      if (error instanceof CollectionLeaseLostError || !canCommit()) {
        fence.valid = false;
        this.signal('lease_lost');
        return;
      }
      const outcome =
        error instanceof AppError && error.code === 'UPSTREAM_INVALID_RESPONSE'
          ? 'invalid'
          : error instanceof AppError &&
              ['UPSTREAM_TIMEOUT', 'UPSTREAM_UNAVAILABLE', 'RATE_LIMITED'].includes(error.code)
            ? 'upstream_error'
            : resolving
              ? 'source_error'
              : 'database_error';
      const delay = Math.min(
        900_000,
        this.config.soilCollectionIntervalMs * 2 ** Math.min(station.failureCount, 10),
      );
      await this.readings
        .updateCollectionCheckpoint(station, {
          ...options,
          checkpoint: { nextAttemptAt: new Date(now.getTime() + delay), outcome, failed: true },
        })
        .catch((checkpointError: unknown) => {
          fence.valid = false;
          if (checkpointError instanceof CollectionLeaseLostError) this.signal('lease_lost');
          else if (outcome !== 'database_error') this.signal('database_error');
        });
      this.signal(outcome);
    }
  }

  private signal(outcome: Parameters<OperationsMetrics['recordSoilCollection']>[0]): void {
    this.metrics?.recordSoilCollection(outcome);
    if (outcome !== 'success' && outcome !== 'skipped')
      this.logger.warn({ event: 'soil_collection_result', outcome });
  }
}
