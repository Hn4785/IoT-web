import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { SecurityAuditService } from '../security-audit/security-audit.service.js';
import type { SoilMetadataProvider } from '../station-data/soil-metadata.provider.js';
import type { StationRepository } from '../station-data/station.repository.js';
import { AlertRuleController } from './alert-rule.controller.js';
import { AlertRuleService } from './alert-rule.service.js';
import type { AlertRuleRecordLike, CreateAlertRuleInput } from './alert-rule.contracts.js';

type StoredRule = AlertRuleRecordLike & { createdAt: Date; updatedAt: Date };
type StoredClaim = Prisma.IdempotencyClaimCreateInput;
type StoredAudit = Prisma.SecurityAuditEventCreateInput;

describe('AlertRule security audit', () => {
  const actorUserId = randomUUID();
  const stationId = randomUUID();
  const ruleId = randomUUID();

  const principal: CurrentPrincipalValue = {
    userId: actorUserId,
    sessionId: 'session-1',
    role: 'ADMIN',
    status: 'ACTIVE',
    isSuperAdmin: false,
  };

  const createPayload: CreateAlertRuleInput = {
    field: 'moisture',
    unit: '%',
    expectedMetadataRevision: 'rev-1',
    condition: { operator: 'BELOW', threshold: 25 },
    severity: 'WARNING',
    isEnabled: true,
  };

  function createFixture(options: { failAudit?: boolean } = {}) {
    let committedRule: StoredRule | null = null;
    let committedClaim: StoredClaim | null = null;
    const committedAudits: StoredAudit[] = [];

    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      alert: { findUnique: vi.fn().mockResolvedValue(null) },
      alertRule: {
        create: vi.fn(({ data }: { data: Prisma.AlertRuleCreateInput }) => {
          committedRule = {
            id: ruleId,
            stationId,
            field: data.field,
            unit: data.unit,
            metadataRevision: data.metadataRevision,
            condition: data.condition,
            severity: data.severity,
            requiredBreachSamples: 2,
            requiredRecoverySamples: 2,
            isEnabled: Boolean(data.isEnabled),
            evaluationStatus: String(data.evaluationStatus),
            revision: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return Promise.resolve(committedRule);
        }),
        findFirst: vi.fn(() =>
          Promise.resolve(
            committedRule
              ? {
                  ...committedRule,
                  station: { id: stationId, upstreamCode: 'NODE01', plot: { farmId: 'farm-1' } },
                }
              : null,
          ),
        ),
        updateMany: vi.fn(({ data }: { data: Prisma.AlertRuleUpdateManyMutationInput }) => {
          if (!committedRule) return Promise.resolve({ count: 0 });
          const increment = (data.revision as { increment?: number } | undefined)?.increment;
          const revision =
            typeof increment === 'number'
              ? committedRule.revision + increment
              : committedRule.revision + 1;
          committedRule = {
            ...committedRule,
            ...(data.condition !== undefined ? { condition: data.condition } : {}),
            ...(typeof data.severity === 'string' ? { severity: data.severity } : {}),
            ...(typeof data.unit === 'string' ? { unit: data.unit } : {}),
            ...(data.isEnabled !== undefined ? { isEnabled: Boolean(data.isEnabled) } : {}),
            revision,
            updatedAt: new Date(),
          };
          return Promise.resolve({ count: 1 });
        }),
        findUniqueOrThrow: vi.fn(() => {
          if (!committedRule) return Promise.reject(new Error('Not found'));
          return Promise.resolve(committedRule);
        }),
      },
      idempotencyClaim: {
        create: vi.fn(({ data }: { data: StoredClaim }) => {
          committedClaim = { ...data };
          return Promise.resolve(committedClaim);
        }),
        update: vi.fn(({ data }: { data: Partial<StoredClaim> }) => {
          if (committedClaim) Object.assign(committedClaim, data);
          return Promise.resolve(committedClaim);
        }),
      },
      securityAuditEvent: {
        create: vi.fn(({ data }: { data: StoredAudit }) => {
          if (options.failAudit) {
            return Promise.reject(new Error('DB audit failure'));
          }
          committedAudits.push(data);
          return Promise.resolve({ id: 'audit-1', ...data, createdAt: new Date() });
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      station: {
        findFirst: vi.fn().mockResolvedValue({ id: stationId, upstreamCode: 'NODE01' }),
      },
      idempotencyClaim: {
        findUnique: vi.fn(() => Promise.resolve(committedClaim)),
      },
      alertRule: {
        findUnique: vi.fn(() =>
          Promise.resolve(
            committedRule
              ? { ...committedRule, station: { id: stationId, upstreamCode: 'NODE01' } }
              : null,
          ),
        ),
      },
      $transaction: vi.fn(
        async <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
          const snapshot = {
            rule: committedRule ? { ...committedRule } : null,
            claim: committedClaim ? { ...committedClaim } : null,
            audits: [...committedAudits],
          };
          try {
            return await callback(mockTx);
          } catch (err) {
            committedRule = snapshot.rule;
            committedClaim = snapshot.claim;
            committedAudits.length = 0;
            committedAudits.push(...snapshot.audits);
            throw err;
          }
        },
      ),
    } as unknown as PrismaService;

    const metadataMock = vi.fn().mockResolvedValue({
      field: 'moisture',
      unit: '%',
      revision: 'rev-1',
      isConfirmed: true,
    });
    const metadataProvider = {
      getFieldMetadata: metadataMock,
    } as unknown as SoilMetadataProvider;

    const stations = {
      getAuthorizedStation: vi.fn().mockResolvedValue({ id: stationId, upstreamCode: 'NODE01' }),
    } as unknown as StationRepository;

    const config = { alertIdempotencyRetentionHours: 24 } as unknown as RuntimeConfig;
    const audits = new SecurityAuditService();

    const service = new AlertRuleService(prisma, metadataProvider, config, stations, audits);

    return {
      service,
      metadataMock,
      getCommittedRule: () => committedRule,
      getCommittedAudits: () => committedAudits,
      seedRule: (overrides: Partial<StoredRule> = {}) => {
        committedRule = {
          id: ruleId,
          stationId,
          field: 'MOISTURE',
          unit: '%',
          metadataRevision: 'rev-1',
          condition: { operator: 'BELOW', threshold: 25 },
          severity: 'WARNING',
          requiredBreachSamples: 2,
          requiredRecoverySamples: 2,
          isEnabled: true,
          evaluationStatus: 'READY',
          revision: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...overrides,
        };
      },
    };
  }

  it('records ALERT_RULE_CREATED on create and links actor, target, requestId', async () => {
    const fixture = createFixture();
    const result = await fixture.service.createRule(
      principal,
      stationId,
      'key-1',
      createPayload,
      'req-123',
    );

    expect(result.id).toBe(ruleId);
    expect(fixture.getCommittedAudits()).toEqual([
      expect.objectContaining({
        actorUserId,
        action: 'ALERT_RULE_CREATED',
        targetType: 'AlertRule',
        targetId: ruleId,
        requestId: 'req-123',
        result: 'SUCCESS',
      }),
    ]);
  });

  it('rolls back create mutation if audit recording fails', async () => {
    const fixture = createFixture({ failAudit: true });
    await expect(
      fixture.service.createRule(principal, stationId, 'key-rb', createPayload, 'req-rb'),
    ).rejects.toThrow('DB audit failure');

    expect(fixture.getCommittedRule()).toBeNull();
    expect(fixture.getCommittedAudits()).toHaveLength(0);
  });

  it('emits no second audit event on idempotent create replay', async () => {
    const fixture = createFixture();
    await fixture.service.createRule(principal, stationId, 'key-replay', createPayload, 'req-1');
    expect(fixture.getCommittedAudits()).toHaveLength(1);

    const replayed = await fixture.service.createRule(
      principal,
      stationId,
      'key-replay',
      createPayload,
      'req-2',
    );
    expect(replayed.id).toBe(ruleId);
    expect(fixture.getCommittedAudits()).toHaveLength(1);
  });

  it('records ALERT_RULE_UPDATED on patch and links actor, target, requestId', async () => {
    const fixture = createFixture();
    fixture.seedRule();

    const result = await fixture.service.patchRule(
      principal,
      ruleId,
      { severity: 'CRITICAL', expectedRevision: 1 },
      'req-patch-1',
    );

    expect(result.id).toBe(ruleId);
    expect(fixture.getCommittedAudits()).toEqual([
      expect.objectContaining({
        actorUserId,
        action: 'ALERT_RULE_UPDATED',
        targetType: 'AlertRule',
        targetId: ruleId,
        requestId: 'req-patch-1',
        result: 'SUCCESS',
      }),
    ]);
  });

  it('rolls back patch mutation if audit recording fails', async () => {
    const fixture = createFixture({ failAudit: true });
    fixture.seedRule({ revision: 1 });

    await expect(
      fixture.service.patchRule(
        principal,
        ruleId,
        { severity: 'CRITICAL', expectedRevision: 1 },
        'req-fail',
      ),
    ).rejects.toThrow('DB audit failure');

    expect(fixture.getCommittedRule()?.revision).toBe(1);
    expect(fixture.getCommittedAudits()).toHaveLength(0);
  });

  it('emits no audit on stale revision patch', async () => {
    const fixture = createFixture();
    fixture.seedRule({ revision: 2 });

    await expect(
      fixture.service.patchRule(
        principal,
        ruleId,
        { severity: 'CRITICAL', expectedRevision: 1 },
        'req-stale',
      ),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });

    expect(fixture.getCommittedAudits()).toHaveLength(0);
  });

  it('emits no audit on unconfirmed metadata create', async () => {
    const fixture = createFixture();
    fixture.metadataMock.mockResolvedValue({
      field: 'moisture',
      isConfirmed: false,
    });

    await expect(
      fixture.service.createRule(principal, stationId, 'key-uc', createPayload, 'req-uc'),
    ).rejects.toMatchObject({ code: 'FIELD_METADATA_UNCONFIRMED' });

    expect(fixture.getCommittedAudits()).toHaveLength(0);
  });

  it('controller passes request.id through create to service', async () => {
    const createRuleMock = vi.fn().mockResolvedValue({ id: ruleId });
    const mockService = {
      createRule: createRuleMock,
    } as unknown as AlertRuleService;
    const controller = new AlertRuleController(mockService);

    const res = await controller.create(principal, stationId, 'key-ctrl', createPayload, {
      id: 'req-ctrl',
    } as unknown as FastifyRequest);

    expect(res.success).toBe(true);
    expect(createRuleMock).toHaveBeenCalledWith(
      principal,
      stationId,
      'key-ctrl',
      expect.any(Object),
      'req-ctrl',
    );
  });
});
