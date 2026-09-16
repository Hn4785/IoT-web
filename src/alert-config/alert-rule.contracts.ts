import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';
import { utcTimestampSchema } from '../common/validation/utc-timestamp.js';

export {
  ALERT_RULE_SORT_CONTRACTS,
  type AlertRuleCursorPayload,
  type AlertRuleSortContract,
  decodeAlertRuleCursor,
  encodeAlertRuleCursor,
} from './cursor.js';

export const SOIL_ALERT_FIELDS = [
  'temperature',
  'moisture',
  'ec',
  'ph',
  'nitrogen',
  'phosphorus',
  'potassium',
  'light',
] as const;
export const soilAlertFieldSchema = z.enum(SOIL_ALERT_FIELDS);
export type SoilAlertField = z.infer<typeof soilAlertFieldSchema>;

export const ALERT_RULE_SEVERITIES = ['WARNING', 'CRITICAL'] as const;
export const alertRuleSeveritySchema = z.enum(ALERT_RULE_SEVERITIES);
export type AlertRuleSeverity = z.infer<typeof alertRuleSeveritySchema>;

export const ALERT_EVALUATION_STATUSES = ['READY', 'DISABLED', 'BLOCKED_METADATA'] as const;
export const alertEvaluationStatusSchema = z.enum(ALERT_EVALUATION_STATUSES);
export type AlertEvaluationStatus = z.infer<typeof alertEvaluationStatusSchema>;

export const alertConditionAboveSchema = z.strictObject({
  operator: z.literal('ABOVE'),
  threshold: z.number().finite(),
});

export const alertConditionBelowSchema = z.strictObject({
  operator: z.literal('BELOW'),
  threshold: z.number().finite(),
});

export const alertConditionOutsideRangeSchema = z
  .strictObject({
    operator: z.literal('OUTSIDE_RANGE'),
    lowerThreshold: z.number().finite(),
    upperThreshold: z.number().finite(),
  })
  .refine((val) => val.lowerThreshold < val.upperThreshold, {
    message: 'lowerThreshold must be strictly less than upperThreshold',
    path: ['lowerThreshold'],
  });

export const alertConditionSchema = z.discriminatedUnion('operator', [
  alertConditionAboveSchema,
  alertConditionBelowSchema,
  alertConditionOutsideRangeSchema,
]);
export type AlertCondition = z.infer<typeof alertConditionSchema>;

export const createAlertRuleSchema = z.strictObject({
  field: soilAlertFieldSchema,
  unit: z.string().trim().min(1).max(32),
  expectedMetadataRevision: z.string().trim().min(1).max(160),
  condition: alertConditionSchema,
  severity: alertRuleSeveritySchema,
  isEnabled: z.boolean().default(true),
});
export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;

export const patchAlertRuleSchema = z
  .strictObject({
    condition: alertConditionSchema.optional(),
    severity: alertRuleSeveritySchema.optional(),
    unit: z.string().trim().min(1).max(32).optional(),
    expectedMetadataRevision: z.string().trim().min(1).max(160).optional(),
    isEnabled: z.boolean().optional(),
    expectedRevision: z.number().int().positive(),
  })
  .refine(
    (data) =>
      data.condition !== undefined ||
      data.severity !== undefined ||
      data.unit !== undefined ||
      data.expectedMetadataRevision !== undefined ||
      data.isEnabled !== undefined,
    {
      message: 'At least one mutable field must be provided in addition to expectedRevision',
    },
  );
export type PatchAlertRuleInput = z.infer<typeof patchAlertRuleSchema>;

export const listAlertRulesQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).max(2048).optional(),
});
export type ListAlertRulesQuery = z.infer<typeof listAlertRulesQuerySchema>;

export const alertRuleDtoSchema = z.strictObject({
  id: z.uuid(),
  stationId: z.uuid(),
  field: soilAlertFieldSchema,
  unit: z.string().trim().min(1).max(32),
  metadataRevision: z.string().trim().min(1).max(160),
  condition: alertConditionSchema,
  severity: alertRuleSeveritySchema,
  requiredBreachSamples: z.literal(2),
  requiredRecoverySamples: z.literal(2),
  isEnabled: z.boolean(),
  evaluationStatus: alertEvaluationStatusSchema,
  revision: z.number().int().positive(),
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
});
export type AlertRuleDto = z.infer<typeof alertRuleDtoSchema>;

function parse<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', 400, message);
  }
  return result.data;
}

export function parseCreateAlertRule(value: unknown): CreateAlertRuleInput {
  return parse(createAlertRuleSchema, value, 'Create alert rule input is invalid');
}

export function parsePatchAlertRule(value: unknown): PatchAlertRuleInput {
  return parse(patchAlertRuleSchema, value, 'Patch alert rule input is invalid');
}

export function parseListAlertRulesQuery(value: unknown): ListAlertRulesQuery {
  return parse(listAlertRulesQuerySchema, value ?? {}, 'List alert rules query is invalid');
}

export function parseAlertRuleDto(value: unknown): AlertRuleDto {
  return parse(alertRuleDtoSchema, value, 'Alert rule DTO is invalid');
}

export function parseAlertRuleId(value: unknown): string {
  return parse(z.uuid(), value, 'Alert rule ID is invalid');
}

export type AlertRuleRecordLike = {
  id: string;
  stationId: string;
  field: string;
  unit: string;
  metadataRevision: string;
  condition: unknown;
  severity: string;
  requiredBreachSamples?: number;
  requiredRecoverySamples?: number;
  isEnabled: boolean;
  evaluationStatus: string;
  revision: number;
  activeKey?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: unknown;
};

export function toAlertRuleDto(record: AlertRuleRecordLike): AlertRuleDto {
  const rawField = typeof record.field === 'string' ? record.field : '';
  const normalizedField = rawField.toUpperCase() === rawField ? rawField.toLowerCase() : rawField;

  const candidate = {
    id: record.id,
    stationId: record.stationId,
    field: normalizedField,
    unit: record.unit,
    metadataRevision: record.metadataRevision,
    condition: record.condition,
    severity: record.severity,
    requiredBreachSamples: 2,
    requiredRecoverySamples: 2,
    isEnabled: record.isEnabled,
    evaluationStatus: record.evaluationStatus,
    revision: record.revision,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt,
  };

  return parse(alertRuleDtoSchema, candidate, 'Mapped alert rule DTO is invalid');
}
