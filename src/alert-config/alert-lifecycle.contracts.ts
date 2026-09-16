import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';

const actionSchema = z.strictObject({ note: z.string().trim().min(1).max(500).optional() });
const listSchema = z.strictObject({
  stationId: z.uuid().optional(),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
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

export type AlertDto = Readonly<{
  id: string;
  ruleId: string;
  stationId: string;
  field: string;
  status: string;
  severity: string;
  openedValue: number;
  openedObservedAt: string;
  latestValue: number;
  latestObservedAt: string;
  openedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
  revision: number;
}>;

export function toAlertDto(record: {
  id: string;
  ruleId: string;
  status: string;
  openedValue: { toNumber(): number };
  openedObservedAt: Date;
  latestValue: { toNumber(): number };
  latestObservedAt: Date;
  openedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  resolutionReason: string | null;
  revision: number;
  rule: { stationId: string; field: string; severity: string };
}): AlertDto {
  return {
    id: record.id,
    ruleId: record.ruleId,
    stationId: record.rule.stationId,
    field: record.rule.field.toLowerCase(),
    status: record.status,
    severity: record.rule.severity,
    openedValue: record.openedValue.toNumber(),
    openedObservedAt: record.openedObservedAt.toISOString(),
    latestValue: record.latestValue.toNumber(),
    latestObservedAt: record.latestObservedAt.toISOString(),
    openedAt: record.openedAt.toISOString(),
    acknowledgedAt: record.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: record.resolvedAt?.toISOString() ?? null,
    resolutionReason: record.resolutionReason,
    revision: record.revision,
  };
}
