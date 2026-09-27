import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { queueLifecycleNotifications } from '../notifications/notification-delivery.js';
import { OperationsMetrics } from '../operations/operations-signals.js';
import {
  SOIL_METADATA_PROVIDER,
  type SoilMetadataProvider,
} from '../station-data/soil-metadata.provider.js';
import { StationDataService } from '../station-data/station-data.service.js';
import { evaluateAlertSample, type EvaluationSample } from './alert-evaluator.js';
import { alertConditionSchema } from './alert-rule.contracts.js';

interface EvaluatorLeaseFence {
  holderId: string;
  asOf: Date | undefined;
}

@Injectable()
export class AlertEvaluationService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AlertEvaluationService.name);
  private readonly holderId = randomUUID();
  private isRunning = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stationData: StationDataService,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Inject(SOIL_METADATA_PROVIDER) private readonly metadataProvider: SoilMetadataProvider,
    @Optional() private readonly metrics?: OperationsMetrics,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.VITEST) return;
    this.timer = setInterval(() => {
      this.runScheduled();
    }, this.config.alertEvaluationIntervalMs);
    this.timer.unref();
  }

  private runScheduled(): void {
    void this.runOnce().catch((error: unknown) => {
      this.logger.warn({
        event: 'alert_evaluation_run_failed',
        errorCode: error instanceof Error ? error.name : 'UNKNOWN',
      });
    });
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(now?: Date): Promise<{ acquired: boolean; evaluated: number }> {
    if (this.isRunning) {
      this.metrics?.recordEvaluatorRun('skipped');
      return { acquired: false, evaluated: 0 };
    }
    this.isRunning = true;
    try {
      const result = await this.runAcquiredBatch(now);
      this.metrics?.recordEvaluatorRun(result.acquired ? 'acquired' : 'skipped');
      return result;
    } catch (error) {
      this.metrics?.recordEvaluatorRun('failed');
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  private async runAcquiredBatch(now?: Date): Promise<{ acquired: boolean; evaluated: number }> {
    const startedAt = now ?? new Date();
    const acquired = await this.acquireLease(startedAt);
    if (!acquired) return { acquired: false, evaluated: 0 };
    const heartbeat = now ? undefined : this.startLeaseHeartbeat();
    const leaseFence: EvaluatorLeaseFence = { holderId: this.holderId, asOf: now };

    try {
      const lease = await this.prisma.evaluatorLease.findUnique({
        where: { name: 'alert-evaluator' },
      });
      const rules = await this.prisma.alertRule.findMany({
        where: { isEnabled: true, evaluationStatus: 'READY' },
        orderBy: { id: 'asc' },
        take: this.config.alertEvaluationBatchSize,
        ...(lease?.continuationId ? { cursor: { id: lease.continuationId }, skip: 1 } : {}),
        include: { station: { include: { plot: { select: { farmId: true } } } } },
      });

      let evaluated = 0;
      const stationGroups = new Map<
        string,
        {
          station: (typeof rules)[number]['station'];
          rules: Array<(typeof rules)[number]>;
          fields: Set<Lowercase<(typeof rules)[number]['field']>>;
        }
      >();
      for (const rule of rules) {
        if (heartbeat && !heartbeat.hasLease()) break;
        try {
          const fieldName = rule.field.toLowerCase() as Lowercase<typeof rule.field>;
          let metadata = await this.metadataProvider.getFieldMetadata(
            rule.station.upstreamCode,
            fieldName,
          );
          if (!metadata.isConfirmed) {
            metadata = await this.metadataProvider.getFieldMetadata(rule.station.id, fieldName);
          }
          if (heartbeat && !heartbeat.hasLease()) break;
          if (
            !metadata.isConfirmed ||
            metadata.unit !== rule.unit ||
            metadata.revision !== rule.metadataRevision
          ) {
            await this.blockForMetadata(
              {
                id: rule.id,
                revision: rule.revision,
                unit: rule.unit,
                metadataRevision: rule.metadataRevision,
              },
              `evaluator:${this.holderId}:metadata`,
              now ?? new Date(),
              leaseFence,
            );
            evaluated += 1;
            continue;
          }
          const group = stationGroups.get(rule.station.id) ?? {
            station: rule.station,
            rules: [],
            fields: new Set<Lowercase<typeof rule.field>>(),
          };
          group.rules.push(rule);
          group.fields.add(fieldName);
          stationGroups.set(rule.station.id, group);
        } catch (error) {
          this.logEvaluationFailure(rule.id, error);
        }
      }

      for (const group of stationGroups.values()) {
        if (heartbeat && !heartbeat.hasLease()) break;
        try {
          const latest = await this.stationData.getLatest(
            {
              id: group.station.id,
              farmId: group.station.plot.farmId,
              plotId: group.station.plotId,
              name: group.station.name,
              code: group.station.upstreamCode,
              upstreamCode: group.station.upstreamCode,
            },
            { fields: [...group.fields].sort() },
          );
          if (heartbeat && !heartbeat.hasLease()) break;
          for (const rule of group.rules) {
            if (heartbeat && !heartbeat.hasLease()) break;
            const fieldName = rule.field.toLowerCase() as Lowercase<typeof rule.field>;
            const field = latest.fields.find((candidate) => candidate.field === fieldName);
            if (!field) {
              await this.recordSafeResult(rule.id, 'MISSING', now ?? new Date(), leaseFence);
            } else if (latest.isStale) {
              await this.recordSafeResult(rule.id, 'STALE', now ?? new Date(), leaseFence);
            } else if (field.quality !== 'good' || !Number.isFinite(field.value)) {
              await this.recordSafeResult(rule.id, 'INVALID', now ?? new Date(), leaseFence);
            } else {
              await this.evaluateRule(
                rule.id,
                {
                  observedAt: new Date(field.observedAt),
                  value: field.value,
                  usable: true,
                },
                `evaluator:${this.holderId}:${field.observedAt}`,
                now ?? new Date(),
                leaseFence,
              );
            }
            evaluated += 1;
          }
        } catch (error) {
          for (const rule of group.rules) {
            await this.recordSafeResult(rule.id, 'UPSTREAM_ERROR', now ?? new Date(), leaseFence);
            this.logEvaluationFailure(rule.id, error);
          }
        }
      }

      await this.prisma.$transaction(async (tx) => {
        if (!(await this.holdsLeaseForWrite(tx, leaseFence))) return;
        await tx.evaluatorLease.update({
          where: { name: 'alert-evaluator' },
          data: { continuationId: rules.at(-1)?.id ?? null },
        });
      });
      return { acquired: true, evaluated };
    } finally {
      await heartbeat?.stop();
    }
  }

  async evaluateRule(
    ruleId: string,
    sample: EvaluationSample,
    requestId: string,
    evaluatedAt = new Date(),
    leaseFence?: EvaluatorLeaseFence,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        if (leaseFence && !(await this.holdsLeaseForWrite(tx, leaseFence))) return;
        await tx.$queryRaw`SELECT "id" FROM "AlertRule" WHERE "id" = ${ruleId}::uuid FOR UPDATE`;
        const rule = await tx.alertRule.findUniqueOrThrow({
          where: { id: ruleId },
          include: {
            evaluationState: true,
            station: { select: { plot: { select: { farmId: true } } } },
          },
        });
        if (!rule.isEnabled || !rule.evaluationState) return;
        const unresolved = await tx.alert.findUnique({ where: { unresolvedRuleId: rule.id } });
        const decision = evaluateAlertSample(
          alertConditionSchema.parse(rule.condition),
          rule.evaluationState,
          sample,
          unresolved !== null,
        );
        if (!decision.accepted || decision.result === 'IGNORED') return;

        await tx.alertEvaluationState.update({
          where: { ruleId: rule.id },
          data: {
            lastObservedAt: sample.observedAt,
            lastValue: sample.value,
            lastEvaluatedAt: evaluatedAt,
            lastResult: decision.result,
            consecutiveBreachCount: decision.breachCount,
            consecutiveRecoveryCount: decision.recoveryCount,
          },
        });

        if (decision.action === 'OPEN') {
          const alert = await tx.alert.create({
            data: {
              ruleId: rule.id,
              unresolvedRuleId: rule.id,
              status: 'OPEN',
              openedValue: sample.value,
              openedObservedAt: sample.observedAt,
              latestValue: sample.value,
              latestObservedAt: sample.observedAt,
            },
          });
          const event = await tx.alertLifecycleEvent.create({
            data: { alertId: alert.id, type: 'OPENED', revision: 1, requestId },
          });
          await queueLifecycleNotifications(tx, event.id, rule.station.plot.farmId);
        } else if (decision.action === 'RESOLVE' && unresolved) {
          const revision = unresolved.revision + 1;
          await tx.alert.update({
            where: { id: unresolved.id },
            data: {
              status: 'RESOLVED',
              unresolvedRuleId: null,
              latestValue: sample.value,
              latestObservedAt: sample.observedAt,
              resolvedAt: evaluatedAt,
              resolutionReason: 'RECOVERED',
              revision,
            },
          });
          const event = await tx.alertLifecycleEvent.create({
            data: { alertId: unresolved.id, type: 'RESOLVED', revision, requestId },
          });
          await queueLifecycleNotifications(tx, event.id, rule.station.plot.farmId);
        } else if (unresolved) {
          await tx.alert.update({
            where: { id: unresolved.id },
            data: { latestValue: sample.value, latestObservedAt: sample.observedAt },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async blockForMetadata(
    expected: { id: string; revision: number; unit: string; metadataRevision: string },
    requestId: string,
    now: Date,
    leaseFence?: EvaluatorLeaseFence,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        if (leaseFence && !(await this.holdsLeaseForWrite(tx, leaseFence))) return;
        await tx.$queryRaw`SELECT "id" FROM "AlertRule" WHERE "id" = ${expected.id}::uuid FOR UPDATE`;
        const rule = await tx.alertRule.findUnique({
          where: { id: expected.id },
          include: {
            evaluationState: true,
            station: { select: { plot: { select: { farmId: true } } } },
          },
        });
        if (
          !rule?.isEnabled ||
          rule.evaluationStatus === 'BLOCKED_METADATA' ||
          rule.revision !== expected.revision ||
          rule.unit !== expected.unit ||
          rule.metadataRevision !== expected.metadataRevision
        ) {
          return;
        }

        await tx.alertRule.update({
          where: { id: rule.id },
          data: { evaluationStatus: 'BLOCKED_METADATA', revision: { increment: 1 } },
        });
        if (rule.evaluationState) {
          await tx.alertEvaluationState.update({
            where: { ruleId: rule.id },
            data: { lastEvaluatedAt: now, lastResult: 'METADATA_BLOCKED' },
          });
        }

        const unresolved = await tx.alert.findUnique({ where: { unresolvedRuleId: rule.id } });
        if (!unresolved) return;
        const revision = unresolved.revision + 1;
        await tx.alert.update({
          where: { id: unresolved.id },
          data: {
            status: 'RESOLVED',
            unresolvedRuleId: null,
            resolvedAt: now,
            resolutionReason: 'METADATA_CHANGED',
            revision,
          },
        });
        const event = await tx.alertLifecycleEvent.create({
          data: { alertId: unresolved.id, type: 'RESOLVED', revision, requestId },
        });
        await queueLifecycleNotifications(tx, event.id, rule.station.plot.farmId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async recordSafeResult(
    ruleId: string,
    result: 'MISSING' | 'STALE' | 'INVALID' | 'UPSTREAM_ERROR',
    now: Date,
    leaseFence?: EvaluatorLeaseFence,
  ): Promise<void> {
    if (!leaseFence) {
      await this.prisma.alertEvaluationState.updateMany({
        where: { ruleId, rule: { isEnabled: true } },
        data: { lastEvaluatedAt: now, lastResult: result },
      });
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      if (!(await this.holdsLeaseForWrite(tx, leaseFence))) return;
      await tx.alertEvaluationState.updateMany({
        where: { ruleId, rule: { isEnabled: true } },
        data: { lastEvaluatedAt: now, lastResult: result },
      });
    });
  }

  private async holdsLeaseForWrite(
    tx: Prisma.TransactionClient,
    leaseFence: EvaluatorLeaseFence,
  ): Promise<boolean> {
    const rows = leaseFence.asOf
      ? await tx.$queryRaw<Array<{ name: string }>>`
          SELECT "name"
          FROM "EvaluatorLease"
          WHERE "name" = 'alert-evaluator'
            AND "holderId" = ${leaseFence.holderId}
            AND "expiresAt" > ${leaseFence.asOf}
          FOR UPDATE
        `
      : await tx.$queryRaw<Array<{ name: string }>>`
          SELECT "name"
          FROM "EvaluatorLease"
          WHERE "name" = 'alert-evaluator'
            AND "holderId" = ${leaseFence.holderId}
            AND "expiresAt" > CURRENT_TIMESTAMP
          FOR UPDATE
        `;
    return rows.length === 1;
  }

  private logEvaluationFailure(ruleId: string, error: unknown): void {
    this.logger.warn({
      event: 'alert_evaluation_failed',
      ruleId,
      errorCode: error instanceof Error ? error.name : 'UNKNOWN',
    });
  }

  private async acquireLease(now: Date): Promise<boolean> {
    const expiresAt = new Date(now.getTime() + this.config.alertEvaluatorLeaseMs);
    const changed = await this.prisma.$executeRaw`
      INSERT INTO "EvaluatorLease" ("name", "holderId", "expiresAt", "updatedAt")
      VALUES ('alert-evaluator', ${this.holderId}, ${expiresAt}, ${now})
      ON CONFLICT ("name") DO UPDATE SET
        "holderId" = EXCLUDED."holderId",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = EXCLUDED."updatedAt"
      WHERE "EvaluatorLease"."expiresAt" <= ${now}
    `;
    return changed === 1;
  }

  private startLeaseHeartbeat(): {
    hasLease: () => boolean;
    stop: () => Promise<void>;
  } {
    let active = true;
    let leaseHeld = true;
    let pending = Promise.resolve();
    const intervalMs = Math.max(25, Math.floor(this.config.alertEvaluatorLeaseMs / 3));
    const renew = async (): Promise<void> => {
      if (!active || !leaseHeld) return;
      const renewedAt = new Date();
      const result = await this.prisma.evaluatorLease.updateMany({
        where: {
          name: 'alert-evaluator',
          holderId: this.holderId,
          expiresAt: { gt: renewedAt },
        },
        data: {
          expiresAt: new Date(renewedAt.getTime() + this.config.alertEvaluatorLeaseMs),
          updatedAt: renewedAt,
        },
      });
      leaseHeld = result.count === 1;
    };
    const timer = setInterval(() => {
      pending = pending.then(renew).catch((error: unknown) => {
        leaseHeld = false;
        this.logger.warn({
          event: 'alert_evaluator_lease_renewal_failed',
          errorCode: error instanceof Error ? error.name : 'UNKNOWN',
        });
      });
    }, intervalMs);
    timer.unref();

    return {
      hasLease: () => leaseHeld,
      stop: async () => {
        active = false;
        clearInterval(timer);
        await pending;
      },
    };
  }
}
