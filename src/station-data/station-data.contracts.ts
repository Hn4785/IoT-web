import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';

export const SOIL_FIELDS = [
  'temperature',
  'moisture',
  'ec',
  'ph',
  'nitrogen',
  'phosphorus',
  'potassium',
  'light',
] as const;

export type SoilField = (typeof SOIL_FIELDS)[number];

const latestSoilQuerySchema = z.strictObject({
  fields: z
    .string()
    .transform((val) => val.split(','))
    .pipe(
      z
        .array(z.enum(SOIL_FIELDS))
        .min(1)
        .nonempty()
        .refine((items) => new Set(items).size === items.length, {
          message: 'Duplicate fields are not allowed',
        }),
    )
    .default(() => [...SOIL_FIELDS]),
});

export type LatestSoilQuery = z.output<typeof latestSoilQuerySchema>;

export function parseLatestSoilQuery(value: unknown): LatestSoilQuery {
  const result = latestSoilQuerySchema.safeParse(value);
  if (!result.success) throw new AppError('VALIDATION_ERROR', 400, 'Invalid query');
  return result.data;
}

export type SoilQuality = 'good' | 'stale' | 'unknown';
export type SoilFieldDto = Readonly<{
  field: SoilField;
  value: number;
  unit: string | null;
  observedAt: string;
  quality: SoilQuality;
  sensorId: string | null;
  depthCm: number | null;
}>;
export type LatestSoilDataDto = Readonly<{
  station: Pick<StationDto, 'id' | 'name' | 'code'>;
  measurement: 'soil';
  fields: readonly SoilFieldDto[];
  fetchedAt: string;
  isFromCache: boolean;
  isStale: boolean;
}>;
export type NormalizedLatestSoil = Readonly<{
  station: Pick<StationDto, 'id' | 'name' | 'code'>;
  fields: readonly Readonly<{ field: SoilField; value: number; observedAt: string }>[];
  fetchedAt: string;
}>;
export type SoilHistoryInterval = 'raw' | '5m' | '30m' | '1h' | '1d';
export type SoilHistoryAggregate = 'mean' | 'min' | 'max' | 'first' | 'last';
export type SoilHistoryQuery = Readonly<{
  fields: readonly SoilField[];
  begin: string;
  end: string;
  interval: SoilHistoryInterval;
  aggregate?: SoilHistoryAggregate | undefined;
  order: 'asc' | 'desc';
  limit: number;
  cursor?: string | undefined;
}>;
export type SoilHistoryPointDto = Readonly<{
  observedAt: string;
  value: number;
  quality: SoilQuality;
}>;
export type SoilHistorySeriesDto = Readonly<{
  field: SoilField;
  unit: string | null;
  sensorId: string | null;
  depthCm: number | null;
  points: readonly SoilHistoryPointDto[];
}>;
export type NormalizedHistoryPage = Readonly<{
  stationId: string;
  series: readonly SoilHistorySeriesDto[];
  fetchedAt: string;
  nextCursor: string | null;
}>;
export type SoilHistoryDto = Readonly<{
  stationId: string;
  measurement: 'soil';
  series: readonly SoilHistorySeriesDto[];
  page: Readonly<{ nextCursor: string | null }>;
  fetchedAt: string;
  isFromCache: boolean;
  isStale: boolean;
}>;
export type CursorPage<T> = Readonly<{ items: readonly T[]; nextCursor: string | null }>;
export type FarmDto = Readonly<{ id: string; name: string }>;
export type PlotDto = Readonly<{ id: string; farmId: string; name: string }>;
export type StationDto = Readonly<{
  id: string;
  farmId: string;
  plotId: string;
  name: string;
  code: string;
}>;

const hierarchyQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(2048).optional(),
});

const utcTimestamp = z
  .string()
  .refine((value) => value.endsWith('Z') && !Number.isNaN(Date.parse(value)), 'UTC required');

const historyFields = z
  .string()
  .transform((value) => value.split(','))
  .pipe(
    z
      .array(z.enum(SOIL_FIELDS))
      .min(1)
      .refine((items) => new Set(items).size === items.length, 'duplicates are not allowed'),
  )
  .default(() => [...SOIL_FIELDS]);

const soilHistoryQuerySchema = z
  .strictObject({
    fields: historyFields,
    begin: utcTimestamp,
    end: utcTimestamp,
    interval: z.enum(['raw', '5m', '30m', '1h', '1d']).default('raw'),
    aggregate: z.enum(['mean', 'min', 'max', 'first', 'last']).optional(),
    order: z.enum(['asc', 'desc']).default('asc'),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    cursor: z.string().min(1).max(2048).optional(),
  })
  .superRefine((value, context) => {
    const range = Date.parse(value.end) - Date.parse(value.begin);
    const maxRange = (value.interval === 'raw' ? 7 : 90) * 24 * 60 * 60 * 1000;
    if (range < 0 || range > maxRange) {
      context.addIssue({ code: 'custom', path: ['begin'], message: 'History range is invalid' });
    }
    if (value.interval === 'raw' && value.aggregate !== undefined) {
      context.addIssue({ code: 'custom', path: ['aggregate'], message: 'raw rejects aggregate' });
    }
    if (value.interval !== 'raw' && value.aggregate === undefined) {
      context.addIssue({ code: 'custom', path: ['aggregate'], message: 'aggregate is required' });
    }
  });

export type HierarchyQuery = z.output<typeof hierarchyQuerySchema>;

export const hierarchyLimitOpenApiSchema: SchemaObject = {
  type: 'integer',
  minimum: 1,
  maximum: 100,
  default: 50,
};

export const hierarchyCursorOpenApiSchema: SchemaObject = {
  type: 'string',
  minLength: 1,
  maxLength: 2048,
};

export const farmOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', minLength: 1, maxLength: 160 },
  },
};

export const plotOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'farmId', 'name'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    farmId: { type: 'string', format: 'uuid' },
    name: { type: 'string', minLength: 1, maxLength: 160 },
  },
};

export const stationOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'farmId', 'plotId', 'name', 'code'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    farmId: { type: 'string', format: 'uuid' },
    plotId: { type: 'string', format: 'uuid' },
    name: { type: 'string', minLength: 1, maxLength: 160 },
    code: { type: 'string', minLength: 1, maxLength: 80 },
  },
};

export const cursorPageOpenApiSchema = (item: SchemaObject): SchemaObject => ({
  type: 'object',
  additionalProperties: false,
  required: ['items', 'nextCursor'],
  properties: {
    items: { type: 'array', items: item },
    nextCursor: { type: 'string', nullable: true, maxLength: 2048 },
  },
});

function invalidRequest(message: string): AppError {
  return new AppError('VALIDATION_ERROR', 400, message);
}

export function parseHierarchyQuery(value: unknown): HierarchyQuery {
  const parsed = hierarchyQuerySchema.safeParse(value);
  if (!parsed.success) throw invalidRequest('Query is invalid');
  return parsed.data;
}

export function parseSoilHistoryQuery(value: unknown): SoilHistoryQuery {
  const parsed = soilHistoryQuerySchema.safeParse(value);
  if (!parsed.success) throw invalidRequest('History query is invalid');
  return parsed.data;
}

export function parseUuid(value: unknown): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw invalidRequest('Identifier is invalid');
  return parsed.data;
}

export const STATION_CODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const stationCodeSchema = z.string().regex(STATION_CODE_PATTERN);

export function parseStationCode(value: unknown): string {
  const parsed = stationCodeSchema.safeParse(value);
  if (!parsed.success) throw invalidRequest('Station code is invalid');
  return parsed.data;
}
