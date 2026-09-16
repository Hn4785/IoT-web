import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { AlertConfigError } from './alert-config.errors.js';
import {
  type AlertActionInput,
  type AlertDto,
  type ListAlertsQuery,
  toAlertDto,
} from './alert-lifecycle.contracts.js';

const alertInclude = {
  rule: { select: { stationId: true, field: true, severity: true } },
} as const;

@Injectable()
export class AlertLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  async list(
    principal: CurrentPrincipalValue,
    query: ListAlertsQuery,
  ): Promise<{ items: AlertDto[] }> {
    this.assertRole(principal);
    const rows = await this.prisma.alert.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        rule: {
          ...(query.stationId ? { stationId: query.stationId } : {}),
          ...(principal.role === 'FARMER'
            ? {
                station: {
                  plot: { farm: { memberships: { some: { userId: principal.userId } } } },
                },
              }
            : {}),
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      include: alertInclude,
    });
    return { items: rows.map(toAlertDto) };
  }

  async get(principal: CurrentPrincipalValue, alertId: string): Promise<AlertDto> {
    return toAlertDto(await this.findAuthorized(principal, alertId));
  }

  acknowledge(
    principal: CurrentPrincipalValue,
    alertId: string,
    key: string,
    input: AlertActionInput,
    requestId: string,
  ): Promise<AlertDto> {
    return this.transition(principal, alertId, 'ALERT_ACKNOWLEDGE', key, input, requestId);
  }

  resolve(
    principal: CurrentPrincipalValue,
    alertId: string,
    key: string,
    input: AlertActionInput,
    requestId: string,
  ): Promise<AlertDto> {
    return this.transition(principal, alertId, 'ALERT_RESOLVE', key, input, requestId);
  }

  private async transition(
    principal: CurrentPrincipalValue,
    alertId: string,
    operation: 'ALERT_ACKNOWLEDGE' | 'ALERT_RESOLVE',
    rawKey: string,
    input: AlertActionInput,
    requestId: string,
  ): Promise<AlertDto> {
    const alert = await this.findAuthorized(principal, alertId);
    const key = rawKey.trim();
    if (!key || key.length > 160) {
      throw new AppError('VALIDATION_ERROR', 400, 'Idempotency-Key header is required');
    }
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ operation, alertId, actor: principal.userId, input }))
      .digest('hex');

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.idempotencyClaim.create({
          data: {
            operation,
            key,
            requestFingerprint: fingerprint,
            status: 'IN_PROGRESS',
            expiresAt: new Date(
              Date.now() + this.config.alertIdempotencyRetentionHours * 60 * 60 * 1000,
            ),
          },
        });
        const current = await tx.alert.findUniqueOrThrow({
          where: { id: alert.id },
          include: { ...alertInclude, rule: { include: { evaluationState: true } } },
        });
        let result = current;
        if (operation === 'ALERT_ACKNOWLEDGE' && current.status === 'OPEN') {
          const revision = current.revision + 1;
          result = await tx.alert.update({
            where: { id: current.id },
            data: {
              status: 'ACKNOWLEDGED',
              acknowledgedAt: new Date(),
              acknowledgedBy: principal.userId,
              revision,
            },
            include: { ...alertInclude, rule: { include: { evaluationState: true } } },
          });
          await tx.alertLifecycleEvent.create({
            data: {
              alertId,
              type: 'ACKNOWLEDGED',
              revision,
              actorId: principal.userId,
              note: input.note ?? null,
              requestId,
            },
          });
        } else if (operation === 'ALERT_RESOLVE' && current.status !== 'RESOLVED') {
          if (current.rule.evaluationState?.lastResult !== 'NORMAL') {
            throw new AlertConfigError('ALERT_STILL_ACTIVE', 409, 'Alert is still active');
          }
          const revision = current.revision + 1;
          result = await tx.alert.update({
            where: { id: current.id },
            data: {
              status: 'RESOLVED',
              unresolvedRuleId: null,
              resolvedAt: new Date(),
              resolvedBy: principal.userId,
              resolutionReason: 'MANUAL',
              revision,
            },
            include: { ...alertInclude, rule: { include: { evaluationState: true } } },
          });
          await tx.alertLifecycleEvent.create({
            data: {
              alertId,
              type: 'RESOLVED',
              revision,
              actorId: principal.userId,
              note: input.note ?? null,
              requestId,
            },
          });
        }
        const dto = toAlertDto(result);
        await tx.idempotencyClaim.update({
          where: { operation_key: { operation, key } },
          data: { status: 'COMPLETED', response: dto },
        });
        return dto;
      });
    } catch (error) {
      if (!this.isUnique(error)) throw error;
      const claim = await this.prisma.idempotencyClaim.findUnique({
        where: { operation_key: { operation, key } },
      });
      if (!claim) throw error;
      if (claim.requestFingerprint !== fingerprint) {
        throw new AlertConfigError(
          'IDEMPOTENCY_KEY_REUSED',
          409,
          'Idempotency key payload differs',
        );
      }
      if (!claim.response) {
        throw new AlertConfigError('REQUEST_IN_PROGRESS', 409, 'Request is in progress');
      }
      return claim.response as unknown as AlertDto;
    }
  }

  private async findAuthorized(principal: CurrentPrincipalValue, alertId: string) {
    this.assertRole(principal);
    const row = await this.prisma.alert.findFirst({
      where: {
        id: alertId,
        ...(principal.role === 'FARMER'
          ? {
              rule: {
                station: {
                  plot: { farm: { memberships: { some: { userId: principal.userId } } } },
                },
              },
            }
          : {}),
      },
      include: alertInclude,
    });
    if (!row) throw new AppError('NOT_FOUND', 404, 'Alert not found');
    return row;
  }

  private assertRole(principal: CurrentPrincipalValue): void {
    if (principal.status !== 'ACTIVE' || !['ADMIN', 'FARMER'].includes(principal.role)) {
      throw new AppError('FORBIDDEN', 403, 'Access is forbidden');
    }
  }

  private isUnique(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
