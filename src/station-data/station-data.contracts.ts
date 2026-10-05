import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';
import { utcTimestampSchema } from '../common/validation/utc-timestamp.js';

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
  dataOrigin?: 'upstream' | 'stored';
  station: Pick<StationDto, 'id' | 'name' | 'code'>;
  measurement: 'soil';
  fields: readonly SoilFieldDto[];
  fetchedAt: string;
  isFromCache: boolean;
  isStale: boolean;
}>;
export type NormalizedLatestSoil = Readonly<{
  dataOrigin?: 'upstream' | 'stored';
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
  dataOrigin?: 'upstream' | 'stored';
  coverage?: SoilHistoryCoverageDto;
  stationId: string;
  measurement: 'soil';
  series: readonly SoilHistorySeriesDto[];
  page: Readonly<{ nextCursor: string | null }>;
  fetchedAt: string;
  isFromCache: boolean;
  isStale: boolean;
}>;
export type SoilHistoryCoverageDto = Readonly<{
  status: 'complete' | 'partial' | 'unknown';
  fields: readonly Readonly<{
    field: SoilField;
    ranges: readonly Readonly<{ begin: string; end: string }>[];
  }>[];
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

const utcTimestamp = utcTimestampSchema;

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

export const latestSoilResponseOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      additionalProperties: false,
      required: [
        'station',
        'measurement',
        'dataOrigin',
        'fields',
        'fetchedAt',
        'isFromCache',
        'isStale',
      ],
      properties: {
        station: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'name', 'code'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            code: { type: 'string' },
          },
        },
        measurement: { type: 'string', enum: ['soil'] },
        dataOrigin: { type: 'string', enum: ['upstream', 'stored'] },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['field', 'value', 'unit', 'observedAt', 'quality', 'sensorId', 'depthCm'],
            properties: {
              field: { type: 'string', enum: [...SOIL_FIELDS] },
              value: { type: 'number' },
              unit: { type: 'string', nullable: true },
              observedAt: { type: 'string', format: 'date-time' },
              quality: { type: 'string', enum: ['good', 'stale', 'unknown'] },
              sensorId: { type: 'string', nullable: true },
              depthCm: { type: 'number', nullable: true },
            },
          },
        },
        fetchedAt: { type: 'string', format: 'date-time' },
        isFromCache: { type: 'boolean' },
        isStale: { type: 'boolean' },
      },
    },
  },
};

export const soilHistoryResponseOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      additionalProperties: false,
      required: [
        'stationId',
        'measurement',
        'dataOrigin',
        'series',
        'page',
        'fetchedAt',
        'isFromCache',
        'isStale',
      ],
      properties: {
        stationId: { type: 'string', format: 'uuid' },
        measurement: { type: 'string', enum: ['soil'] },
        dataOrigin: { type: 'string', enum: ['upstream', 'stored'] },
        coverage: {
          type: 'object',
          additionalProperties: false,
          required: ['status', 'fields'],
          properties: {
            status: { type: 'string', enum: ['complete', 'partial', 'unknown'] },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['field', 'ranges'],
                properties: {
                  field: { type: 'string', enum: [...SOIL_FIELDS] },
                  ranges: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['begin', 'end'],
                      properties: {
                        begin: { type: 'string', format: 'date-time' },
                        end: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        series: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['field', 'unit', 'sensorId', 'depthCm', 'points'],
            properties: {
              field: { type: 'string', enum: [...SOIL_FIELDS] },
              unit: { type: 'string', nullable: true },
              sensorId: { type: 'string', nullable: true },
              depthCm: { type: 'number', nullable: true },
              points: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['observedAt', 'value', 'quality'],
                  properties: {
                    observedAt: { type: 'string', format: 'date-time' },
                    value: { type: 'number' },
                    quality: { type: 'string', enum: ['good', 'stale', 'unknown'] },
                  },
                },
              },
            },
          },
        },
        page: {
          type: 'object',
          additionalProperties: false,
          required: ['nextCursor'],
          properties: {
            nextCursor: { type: 'string', nullable: true, maxLength: 2048 },
          },
        },
        fetchedAt: { type: 'string', format: 'date-time' },
        isFromCache: { type: 'boolean' },
        isStale: { type: 'boolean' },
      },
    },
  },
};

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
