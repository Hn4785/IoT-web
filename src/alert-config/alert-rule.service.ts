import { createHash } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';

import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma, type SoilAlertField } from '../generated/prisma/client.js';
import { deliverLifecycleNotifications } from '../notifications/notification-delivery.js';
import { OperationsMetrics } from '../operations/operations-signals.js';
import {
  SOIL_METADATA_PROVIDER,
  type SoilMetadataProvider,
} from '../station-data/soil-metadata.provider.js';
import { AlertConfigError } from './alert-config.errors.js';
import {
  type AlertRuleDto,
  type CreateAlertRuleInput,
  decodeAlertRuleCursor,
  encodeAlertRuleCursor,
  type ListAlertRulesQuery,
  type PatchAlertRuleInput,
  toAlertRuleDto,
} from './alert-rule.contracts.js';

@Injectable()
export class AlertRuleService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SOIL_METADATA_PROVIDER)
    private readonly metadataProvider: SoilMetadataProvider,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Optional() private readonly metrics?: OperationsMetrics,
  ) {}

  async listRules(
    principal: CurrentPrincipalValue,
    stationId: string,
    query: ListAlertRulesQuery,
  ): Promise<{ items: AlertRuleDto[]; nextCursor: string | null }> {
    this.assertAuthorizedRole(principal);
    await this.requireStationAccess(principal, stationId);

    const cursor = query.cursor
      ? decodeAlertRuleCursor(query.cursor, stationId, 'createdAt_asc')
      : undefined;

    const rows = await this.prisma.alertRule.findMany({
      where: {
        stationId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { gt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
    });

    const items = rows.slice(0, query.limit).map((r) => toAlertRuleDto(r));
    const lastRow = rows[Math.min(query.limit, rows.length) - 1];
    const nextCursor =
      rows.length > query.limit && lastRow
        ? encodeAlertRuleCursor({
            v: 1,
            kind: 'alert-rule',
            stationId,
            sort: 'createdAt_asc',
            createdAt: lastRow.createdAt.toISOString(),
            id: lastRow.id,
          })
        : null;

    return { items, nextCursor };
  }

  async getRule(principal: CurrentPrincipalValue, ruleId: string): Promise<AlertRuleDto> {
    this.assertAuthorizedRole(principal);
    const rule = await this.findAuthorizedRule(principal, ruleId);
    return toAlertRuleDto(rule);
  }

  async createRule(
    principal: CurrentPrincipalValue,
    stationId: string,
    idempotencyKey: string,
    input: CreateAlertRuleInput,
  ): Promise<AlertRuleDto> {
    this.assertAuthorizedRole(principal);
    const station = await this.requireStationAccess(principal, stationId);

    const trimmedKey = idempotencyKey.trim();
    if (!trimmedKey || trimmedKey.length > 160) {
      throw new AppError('VALIDATION_ERROR', 400, 'Idempotency-Key header is required');
    }

    const normalizedBody = {
      condition: input.condition,
      expectedMetadataRevision: input.expectedMetadataRevision,
      field: input.field,
      isEnabled: input.isEnabled,
      severity: input.severity,
      unit: input.unit,
    };
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ userId: principal.userId, stationId, body: normalizedBody }))
      .digest('hex');

    const completedClaim = await this.prisma.idempotencyClaim.findUnique({
      where: { operation_key: { operation: 'RULE_CREATE', key: trimmedKey } },
    });
    if (completedClaim) {
      if (completedClaim.requestFingerprint !== fingerprint) {
        throw new AlertConfigError(
          'IDEMPOTENCY_KEY_REUSED',
          409,
          'Idempotency key was previously used with different payload',
        );
      }
      if (!completedClaim.response) {
        throw new AlertConfigError(
          'REQUEST_IN_PROGRESS',
          409,
          'Request with this idempotency key is already in progress',
        );
      }
      return completedClaim.response as unknown as AlertRuleDto;
    }

    await this.assertValidMetadata(
      station.upstreamCode,
      station.id,
      input.field,
      input.unit,
      input.expectedMetadataRevision,
    );

    const fieldEnum = input.field.toUpperCase() as SoilAlertField;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.idempotencyClaim.create({
          data: {
            operation: 'RULE_CREATE',
            key: trimmedKey,
            requestFingerprint: fingerprint,
            status: 'IN_PROGRESS',
            expiresAt: new Date(
              Date.now() + this.config.alertIdempotencyRetentionHours * 60 * 60 * 1000,
            ),
          },
        });
        const created = await tx.alertRule.create({
          data: {
            stationId,
            field: fieldEnum,
            unit: input.unit,
            metadataRevision: input.expectedMetadataRevision,
            condition: input.condition,
            severity: input.severity,
            requiredBreachSamples: 2,
            requiredRecoverySamples: 2,
            isEnabled: input.isEnabled,
            evaluationStatus: input.isEnabled ? 'READY' : 'DISABLED',
            revision: 1,
            activeKey: input.isEnabled ? `${stationId}:${input.field.toLowerCase()}` : null,
            evaluationState: { create: {} },
          },
        });
        const dto = toAlertRuleDto(created);
        await tx.idempotencyClaim.update({
          where: { operation_key: { operation: 'RULE_CREATE', key: trimmedKey } },
          data: { status: 'COMPLETED', response: dto },
        });
        return dto;
      });
    } catch (err) {
      if (!this.isUniqueConstraintViolation(err)) throw err;
      const existing = await this.prisma.idempotencyClaim.findUnique({
        where: { operation_key: { operation: 'RULE_CREATE', key: trimmedKey } },
      });
      if (!existing) {
        throw new AlertConfigError(
          'ACTIVE_RULE_EXISTS',
          409,
          'An active rule already exists for this station and field',
        );
      }
      if (existing.requestFingerprint !== fingerprint) {
        throw new AlertConfigError(
          'IDEMPOTENCY_KEY_REUSED',
          409,
          'Idempotency key was previously used with different payload',
        );
      }
      if (!existing.response) {
        throw new AlertConfigError(
          'REQUEST_IN_PROGRESS',
          409,
          'Request with this idempotency key is already in progress',
        );
      }
      return existing.response as unknown as AlertRuleDto;
    }
  }

  async patchRule(
    principal: CurrentPrincipalValue,
    ruleId: string,
    input: PatchAlertRuleInput,
    requestId: string,
  ): Promise<AlertRuleDto> {
    this.assertAuthorizedRole(principal);
    const rule = await this.findAuthorizedRule(principal, ruleId);

    if (rule.revision !== input.expectedRevision) {
      throw new AlertConfigError('VERSION_CONFLICT', 409, 'Rule revision conflict');
    }

    const isMutatingCore =
      input.condition !== undefined ||
      input.severity !== undefined ||
      input.unit !== undefined ||
      input.expectedMetadataRevision !== undefined;

    const nextIsEnabled = input.isEnabled !== undefined ? input.isEnabled : rule.isEnabled;
    const nextUnit = input.unit ?? rule.unit;
    const nextRevision = input.expectedMetadataRevision ?? rule.metadataRevision;
    const fieldLower = rule.field.toLowerCase() as CreateAlertRuleInput['field'];

    if (
      (nextIsEnabled && !rule.isEnabled) ||
      input.unit !== undefined ||
      input.expectedMetadataRevision !== undefined ||
      (rule.isEnabled && isMutatingCore)
    ) {
      await this.assertValidMetadata(
        rule.station.upstreamCode,
        rule.station.id,
        fieldLower,
        nextUnit,
        nextRevision,
      );
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "AlertRule" WHERE "id" = ${rule.id}::uuid FOR UPDATE`;
        const current = await tx.alertRule.findFirst({
          where: {
            id: rule.id,
            ...(principal.role === 'FARMER'
              ? {
                  station: {
                    plot: { farm: { memberships: { some: { userId: principal.userId } } } },
                  },
                }
              : {}),
          },
          include: { station: { select: { plot: { select: { farmId: true } } } } },
        });
        if (!current) throw new AppError('NOT_FOUND', 404, 'Alert rule not found');
        if (current.revision !== input.expectedRevision) {
          throw new AlertConfigError('VERSION_CONFLICT', 409, 'Rule revision conflict');
        }

        const unresolvedAlert = await tx.alert.findUnique({
          where: { unresolvedRuleId: current.id },
        });
        if (isMutatingCore && unresolvedAlert) {
          throw new AlertConfigError(
            'ACTIVE_ALERT_EXISTS',
            409,
            'Cannot modify condition, severity or metadata while an unresolved alert exists',
          );
        }

        if (!nextIsEnabled && current.isEnabled && unresolvedAlert) {
          await tx.alert.update({
            where: { id: unresolvedAlert.id },
            data: {
              status: 'RESOLVED',
              unresolvedRuleId: null,
              resolvedAt: new Date(),
              resolvedBy: principal.userId,
              resolutionReason: 'RULE_DISABLED',
              revision: { increment: 1 },
            },
          });
          const event = await tx.alertLifecycleEvent.create({
            data: {
              alertId: unresolvedAlert.id,
              type: 'RESOLVED',
              revision: unresolvedAlert.revision + 1,
              actorId: principal.userId,
              requestId,
            },
          });
          await deliverLifecycleNotifications(
            tx,
            event.id,
            current.station.plot.farmId,
            this.metrics,
          );
        }
        const result = await tx.alertRule.updateMany({
          where: { id: current.id, revision: input.expectedRevision },
          data: {
            ...(input.condition ? { condition: input.condition } : {}),
            ...(input.severity ? { severity: input.severity } : {}),
            ...(input.unit ? { unit: input.unit } : {}),
            ...(input.expectedMetadataRevision
              ? { metadataRevision: input.expectedMetadataRevision }
              : {}),
            isEnabled: nextIsEnabled,
            evaluationStatus: nextIsEnabled ? 'READY' : 'DISABLED',
            activeKey: nextIsEnabled ? `${rule.stationId}:${rule.field.toLowerCase()}` : null,
            revision: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new AlertConfigError('VERSION_CONFLICT', 409, 'Rule revision conflict');
        }
        return tx.alertRule.findUniqueOrThrow({ where: { id: current.id } });
      });
      return toAlertRuleDto(updated);
    } catch (err) {
      if (this.isUniqueConstraintViolation(err)) {
        throw new AlertConfigError(
          'ACTIVE_RULE_EXISTS',
          409,
          'An active rule already exists for this station and field',
        );
      }
      throw err;
    }
  }

  private assertAuthorizedRole(principal: CurrentPrincipalValue): void {
    if (principal.status !== 'ACTIVE' || !['ADMIN', 'FARMER'].includes(principal.role)) {
      throw new AppError('FORBIDDEN', 403, 'Access is forbidden');
    }
  }

  private async requireStationAccess(
    principal: CurrentPrincipalValue,
    stationId: string,
  ): Promise<{ id: string; upstreamCode: string }> {
    const station = await this.prisma.station.findFirst({
      where: {
        id: stationId,
        ...(principal.role === 'FARMER'
          ? { plot: { farm: { memberships: { some: { userId: principal.userId } } } } }
          : {}),
      },
      select: { id: true, upstreamCode: true },
    });
    if (!station) {
      throw new AppError('NOT_FOUND', 404, 'Station not found');
    }
    return station;
  }

  private async findAuthorizedRule(principal: CurrentPrincipalValue, ruleId: string) {
    const rule = await this.prisma.alertRule.findFirst({
      where: {
        id: ruleId,
        ...(principal.role === 'FARMER'
          ? { station: { plot: { farm: { memberships: { some: { userId: principal.userId } } } } } }
          : {}),
      },
      include: {
        station: { select: { id: true, upstreamCode: true } },
      },
    });
    if (!rule) {
      throw new AppError('NOT_FOUND', 404, 'Alert rule not found');
    }
    return rule;
  }

  private async assertValidMetadata(
    stationUpstreamCode: string,
    stationId: string,
    field: CreateAlertRuleInput['field'],
    expectedUnit: string,
    expectedRevision: string,
  ): Promise<void> {
    let metadata = await this.metadataProvider.getFieldMetadata(stationUpstreamCode, field);
    if (!metadata.isConfirmed) {
      metadata = await this.metadataProvider.getFieldMetadata(stationId, field);
    }
    if (!metadata.isConfirmed) {
      throw new AlertConfigError(
        'FIELD_METADATA_UNCONFIRMED',
        409,
        'Field metadata is unconfirmed for this station',
      );
    }
    if (metadata.unit !== expectedUnit || metadata.revision !== expectedRevision) {
      throw new AlertConfigError('FIELD_METADATA_CHANGED', 409, 'Field metadata has changed');
    }
  }

  private isUniqueConstraintViolation(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }
}
