import { z } from 'zod';
import type { SchemaObject } from '@nestjs/swagger';

import { AppError } from '../common/errors/app-error.js';
import {
  alertConditionSchema,
  soilAlertFieldSchema,
  type AlertCondition,
} from './alert-rule.contracts.js';
import { decodeAlertCursor, encodeAlertCursor } from './cursor.js';

const actionSchema = z.strictObject({ note: z.string().trim().min(1).max(500).optional() });
const listSchema = z.strictObject({
  stationId: z.uuid().optional(),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
  severity: z.enum(['WARNING', 'CRITICAL']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).max(2048).optional(),
});

function parse<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('VALIDATION_ERROR', 400, message);
  return result.data;
}

export type AlertActionInput = z.infer<typeof actionSchema>;
export type ListAlertsQuery = z.infer<typeof listSchema>;
export const parseAlertAction = (value: unknown) =>
  parse(actionSchema, value, 'Alert action is invalid');
export const parseListAlerts = (value: unknown) =>
  parse(listSchema, value ?? {}, 'Alert query is invalid');
export const parseAlertId = (value: unknown) => parse(z.uuid(), value, 'Alert ID is invalid');
export { decodeAlertCursor, encodeAlertCursor };

export type AlertDto = Readonly<{
  id: string;
  ruleId: string;
  station: Readonly<{ id: string; code: string; name: string }>;
  field: z.infer<typeof soilAlertFieldSchema>;
  unit: string;
  metadataRevision: string;
  condition: AlertCondition;
  severity: 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  openedValue: number;
  openedObservedAt: string;
  latestValue: number;
  latestObservedAt: string;
  openedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionReason: 'RECOVERED' | 'MANUAL' | 'RULE_DISABLED' | 'METADATA_CHANGED' | null;
  revision: number;
}>;

const nullableUuid = { type: 'string', format: 'uuid', nullable: true } as const;
const nullableTimestamp = { type: 'string', format: 'date-time', nullable: true } as const;
export const alertActionOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: { note: { type: 'string', minLength: 1, maxLength: 500 } },
};
export const alertOpenApiSchema: SchemaObject = {
  type: 'object',
  required: [
    'id',
    'ruleId',
    'station',
    'field',
    'unit',
    'metadataRevision',
    'condition',
    'severity',
    'status',
    'openedValue',
    'openedObservedAt',
    'latestValue',
    'latestObservedAt',
    'openedAt',
    'acknowledgedAt',
    'acknowledgedBy',
    'resolvedAt',
    'resolvedBy',
    'resolutionReason',
    'revision',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    ruleId: { type: 'string', format: 'uuid' },
    station: {
      type: 'object',
      required: ['id', 'code', 'name'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        code: { type: 'string' },
        name: { type: 'string' },
      },
    },
    field: { type: 'string', enum: [...soilAlertFieldSchema.options] },
    unit: { type: 'string' },
    metadataRevision: { type: 'string' },
    condition: { type: 'object' },
    severity: { type: 'string', enum: ['WARNING', 'CRITICAL'] },
    status: { type: 'string', enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] },
    openedValue: { type: 'number' },
    openedObservedAt: { type: 'string', format: 'date-time' },
    latestValue: { type: 'number' },
    latestObservedAt: { type: 'string', format: 'date-time' },
    openedAt: { type: 'string', format: 'date-time' },
    acknowledgedAt: nullableTimestamp,
    acknowledgedBy: nullableUuid,
    resolvedAt: nullableTimestamp,
    resolvedBy: nullableUuid,
    resolutionReason: {
      type: 'string',
      enum: ['RECOVERED', 'MANUAL', 'RULE_DISABLED', 'METADATA_CHANGED'],
      nullable: true,
    },
    revision: { type: 'integer', minimum: 1 },
  },
};
export const alertEnvelopeOpenApiSchema: SchemaObject = {
  type: 'object',
  required: ['success', 'data'],
  properties: { success: { type: 'boolean', enum: [true] }, data: alertOpenApiSchema },
};
export const alertPageEnvelopeOpenApiSchema: SchemaObject = {
  type: 'object',
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      required: ['items', 'nextCursor'],
      properties: {
        items: { type: 'array', items: alertOpenApiSchema },
        nextCursor: { type: 'string', nullable: true },
      },
    },
  },
};

export function toAlertDto(record: {
  id: string;
  ruleId: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  openedValue: { toNumber(): number };
  openedObservedAt: Date;
  latestValue: { toNumber(): number };
  latestObservedAt: Date;
  openedAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionReason: 'RECOVERED' | 'MANUAL' | 'RULE_DISABLED' | 'METADATA_CHANGED' | null;
  revision: number;
  rule: {
    field: string;
    unit: string;
    metadataRevision: string;
    condition: unknown;
    severity: 'WARNING' | 'CRITICAL';
    station: { id: string; name: string; upstreamCode?: string; code?: string };
  };
}): AlertDto {
  const field = soilAlertFieldSchema.parse(record.rule.field.toLowerCase());
  const condition = alertConditionSchema.parse(record.rule.condition);
  return {
    id: record.id,
    ruleId: record.ruleId,
    station: {
      id: record.rule.station.id,
      code: record.rule.station.code ?? record.rule.station.upstreamCode ?? '',
      name: record.rule.station.name,
    },
    field,
    unit: record.rule.unit,
    metadataRevision: record.rule.metadataRevision,
    condition,
    status: record.status,
    severity: record.rule.severity,
    openedValue: record.openedValue.toNumber(),
    openedObservedAt: record.openedObservedAt.toISOString(),
    latestValue: record.latestValue.toNumber(),
    latestObservedAt: record.latestObservedAt.toISOString(),
    openedAt: record.openedAt.toISOString(),
    acknowledgedAt: record.acknowledgedAt?.toISOString() ?? null,
    acknowledgedBy: record.acknowledgedBy,
    resolvedAt: record.resolvedAt?.toISOString() ?? null,
    resolvedBy: record.resolvedBy,
    resolutionReason: record.resolutionReason,
    revision: record.revision,
  };
}
