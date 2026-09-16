import { randomUUID } from 'node:crypto';
import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { StationDataService } from '../station-data/station-data.service.js';
import { evaluateAlertSample, type EvaluationSample } from './alert-evaluator.js';
import { alertConditionSchema } from './alert-rule.contracts.js';

@Injectable()
export class AlertEvaluationService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly holderId = randomUUID();
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stationData: StationDataService,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.VITEST) return;
    this.timer = setInterval(() => void this.runOnce(), this.config.alertEvaluationIntervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(now = new Date()): Promise<{ acquired: boolean; evaluated: number }> {
    const acquired = await this.acquireLease(now);
    if (!acquired) return { acquired: false, evaluated: 0 };

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
    for (const rule of rules) {
      try {
        const latest = await this.stationData.getLatest(
          {
            id: rule.station.id,
            farmId: rule.station.plot.farmId,
            plotId: rule.station.plotId,
            name: rule.station.name,
            code: rule.station.upstreamCode,
            upstreamCode: rule.station.upstreamCode,
          },
          { fields: [rule.field.toLowerCase() as Lowercase<typeof rule.field>] },
        );
        const field = latest.fields[0];
        if (field) {
          await this.evaluateRule(
            rule.id,
            {
              observedAt: new Date(field.observedAt),
              value: field.value,
              usable: !latest.isStale && field.quality === 'good',
            },
            `evaluator:${this.holderId}:${field.observedAt}`,
          );
          evaluated += 1;
        }
      } catch {
        // A single upstream/station failure must not stop the bounded batch.
      }
    }

    await this.prisma.evaluatorLease.updateMany({
      where: { name: 'alert-evaluator', holderId: this.holderId },
      data: { continuationId: rules.at(-1)?.id ?? null },
    });
    return { acquired: true, evaluated };
  }

  async evaluateRule(ruleId: string, sample: EvaluationSample, requestId: string): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const rule = await tx.alertRule.findUniqueOrThrow({
          where: { id: ruleId },
          include: { evaluationState: true },
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
            lastEvaluatedAt: new Date(),
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
          await tx.alertLifecycleEvent.create({
            data: { alertId: alert.id, type: 'OPENED', revision: 1, requestId },
          });
        } else if (decision.action === 'RESOLVE' && unresolved) {
          const revision = unresolved.revision + 1;
          await tx.alert.update({
            where: { id: unresolved.id },
            data: {
              status: 'RESOLVED',
              unresolvedRuleId: null,
              latestValue: sample.value,
              latestObservedAt: sample.observedAt,
              resolvedAt: new Date(),
              resolutionReason: 'RECOVERED',
              revision,
            },
          });
          await tx.alertLifecycleEvent.create({
            data: { alertId: unresolved.id, type: 'RESOLVED', revision, requestId },
          });
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
         OR "EvaluatorLease"."holderId" = ${this.holderId}
    `;
    return changed === 1;
  }
}
