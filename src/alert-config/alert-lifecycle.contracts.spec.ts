import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { parseListAlerts, toAlertDto } from './alert-lifecycle.contracts.js';

describe('alert-lifecycle contracts', () => {
  it('accepts severity and cursor list filters', () => {
    expect(
      parseListAlerts({
        stationId: randomUUID(),
        status: 'OPEN',
        severity: 'CRITICAL',
        limit: '25',
        cursor: 'opaque-cursor',
      }),
    ).toEqual(
      expect.objectContaining({ severity: 'CRITICAL', limit: 25, cursor: 'opaque-cursor' }),
    );
  });

  it('maps the complete approved alert DTO', () => {
    const id = randomUUID();
    const ruleId = randomUUID();
    const stationId = randomUUID();
    const actorId = randomUUID();
    const timestamp = new Date('2026-09-17T00:00:00.000Z');

    expect(
      toAlertDto({
        id,
        ruleId,
        status: 'ACKNOWLEDGED',
        openedValue: { toNumber: () => 12 },
        openedObservedAt: timestamp,
        latestValue: { toNumber: () => 13 },
        latestObservedAt: timestamp,
        openedAt: timestamp,
        acknowledgedAt: timestamp,
        acknowledgedBy: actorId,
        resolvedAt: null,
        resolvedBy: null,
        resolutionReason: null,
        revision: 2,
        rule: {
          field: 'MOISTURE',
          unit: '%',
          metadataRevision: 'demo:v1:moisture',
          condition: { operator: 'BELOW', threshold: 20 },
          severity: 'WARNING',
          station: { id: stationId, code: 'NODE01', name: 'North field' },
        },
      }),
    ).toEqual({
      id,
      ruleId,
      station: { id: stationId, code: 'NODE01', name: 'North field' },
      field: 'moisture',
      unit: '%',
      metadataRevision: 'demo:v1:moisture',
      condition: { operator: 'BELOW', threshold: 20 },
      severity: 'WARNING',
      status: 'ACKNOWLEDGED',
      openedValue: 12,
      openedObservedAt: timestamp.toISOString(),
      latestValue: 13,
      latestObservedAt: timestamp.toISOString(),
      openedAt: timestamp.toISOString(),
      acknowledgedAt: timestamp.toISOString(),
      acknowledgedBy: actorId,
      resolvedAt: null,
      resolvedBy: null,
      resolutionReason: null,
      revision: 2,
    });
  });
});
