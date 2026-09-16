import { describe, expect, it } from 'vitest';

import {
  alertConditionSchema,
  alertRuleDtoSchema,
  parseAlertRuleDto,
  parseAlertRuleId,
  parseCreateAlertRule,
  parseListAlertRulesQuery,
  parsePatchAlertRule,
  SOIL_ALERT_FIELDS,
  soilAlertFieldSchema,
  toAlertRuleDto,
} from './alert-rule.contracts.js';

describe('alert-rule.contracts', () => {
  const ruleId = '11111111-1111-4111-8111-111111111111';
  const stationId = '22222222-2222-4222-8222-222222222222';
  const timestamp = '2026-09-16T09:42:41.000Z';

  const validCreate = {
    field: 'temperature' as const,
    unit: 'celsius',
    expectedMetadataRevision: 'rev-1',
    condition: { operator: 'ABOVE' as const, threshold: 35 },
    severity: 'CRITICAL' as const,
  };

  const validDto = {
    id: ruleId,
    stationId,
    field: 'moisture' as const,
    unit: '%',
    metadataRevision: 'rev-1',
    condition: { operator: 'BELOW' as const, threshold: 20 },
    severity: 'WARNING' as const,
    requiredBreachSamples: 2 as const,
    requiredRecoverySamples: 2 as const,
    isEnabled: true,
    evaluationStatus: 'READY' as const,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  it('accepts valid cases across all schemas', () => {
    expect(SOIL_ALERT_FIELDS).toHaveLength(8);
    expect(soilAlertFieldSchema.parse('temperature')).toBe('temperature');
    expect(
      alertConditionSchema.parse({
        operator: 'OUTSIDE_RANGE',
        lowerThreshold: 10,
        upperThreshold: 20,
      }),
    ).toEqual({
      operator: 'OUTSIDE_RANGE',
      lowerThreshold: 10,
      upperThreshold: 20,
    });
    expect(parseCreateAlertRule(validCreate)).toEqual({
      ...validCreate,
      isEnabled: true,
    });
    expect(parseCreateAlertRule({ ...validCreate, isEnabled: false }).isEnabled).toBe(false);
    expect(
      parsePatchAlertRule({
        expectedRevision: 1,
        condition: { operator: 'BELOW', threshold: 10 },
      }),
    ).toEqual({
      expectedRevision: 1,
      condition: { operator: 'BELOW', threshold: 10 },
    });
    expect(parsePatchAlertRule({ expectedRevision: 2, isEnabled: false })).toEqual({
      expectedRevision: 2,
      isEnabled: false,
    });
    expect(parseListAlertRulesQuery({})).toEqual({ limit: 50 });
    expect(parseListAlertRulesQuery(undefined)).toEqual({ limit: 50 });
    expect(parseListAlertRulesQuery({ limit: '25', cursor: 'c' })).toEqual({
      limit: 25,
      cursor: 'c',
    });
    expect(parseAlertRuleDto(validDto)).toEqual(validDto);
    expect(parseAlertRuleId(ruleId)).toBe(ruleId);
  });

  it.each([
    { operator: 'ABOVE', threshold: Number.NaN },
    { operator: 'BELOW', threshold: Number.POSITIVE_INFINITY },
    { operator: 'OUTSIDE_RANGE', lowerThreshold: 10, upperThreshold: 10 },
    { operator: 'OUTSIDE_RANGE', lowerThreshold: 20, upperThreshold: 10 },
    { operator: 'ABOVE', threshold: 10, extra: true },
  ])('rejects invalid condition %j', (cond) => {
    expect(() => alertConditionSchema.parse(cond)).toThrow();
  });

  it.each([
    { ...validCreate, stationId },
    { ...validCreate, id: ruleId },
    { ...validCreate, metadataRevision: 'rev-1' },
    { ...validCreate, requiredBreachSamples: 2 },
    { ...validCreate, evaluationStatus: 'READY' },
    { ...validCreate, revision: 1 },
    { ...validCreate, extra: 'bad' },
    { ...validCreate, unit: '   ' },
    { ...validCreate, expectedMetadataRevision: '' },
  ])('rejects invalid create input %j', (input) => {
    expect(() => parseCreateAlertRule(input)).toThrow();
  });

  it.each([
    { isEnabled: false },
    { expectedRevision: 0, isEnabled: false },
    { expectedRevision: -1, isEnabled: false },
    { expectedRevision: 1.5, isEnabled: false },
    { expectedRevision: 1 },
    { expectedRevision: 1, isEnabled: false, stationId },
    { expectedRevision: 1, isEnabled: false, field: 'ph' },
    { expectedRevision: 1, isEnabled: false, unexpected: 1 },
  ])('rejects invalid patch input %j', (input) => {
    expect(() => parsePatchAlertRule(input)).toThrow();
  });

  it.each([
    { limit: 0 },
    { limit: 101 },
    { limit: 10.5 },
    { cursor: '' },
    { cursor: 'a'.repeat(2049) },
    { limit: 50, extra: 1 },
  ])('rejects invalid query %j', (query) => {
    expect(() => parseListAlertRulesQuery(query)).toThrow();
  });

  it.each([
    { ...validDto, requiredBreachSamples: 3 },
    { ...validDto, requiredRecoverySamples: 1 },
    { ...validDto, id: 'bad' },
    { ...validDto, stationId: 'bad' },
    { ...validDto, createdAt: '2026-02-31T00:00:00.000Z' },
    { ...validDto, updatedAt: 'not-date' },
    { ...validDto, revision: 0 },
    { ...validDto, evaluationStatus: 'BAD' },
    { ...validDto, activeKey: 'k' },
  ])('rejects invalid dto %j', (dto) => {
    expect(() => alertRuleDtoSchema.parse(dto)).toThrow();
  });

  it('maps database-like record to public DTO without leaking internal properties', () => {
    const dbRecord = {
      ...validDto,
      field: 'MOISTURE',
      requiredBreachSamples: 4,
      requiredRecoverySamples: 5,
      activeKey: 'station#moisture',
      extraInternalColumn: 'sensitive',
      createdAt: new Date(timestamp),
      updatedAt: new Date(timestamp),
    };
    const mapped = toAlertRuleDto(dbRecord);
    expect(mapped).toEqual(validDto);
    expect((mapped as Record<string, unknown>).activeKey).toBeUndefined();
    expect((mapped as Record<string, unknown>).extraInternalColumn).toBeUndefined();
    expect(() => parseAlertRuleId('bad-uuid')).toThrow();
  });
});
