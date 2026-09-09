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

function invalidRequest(message: string): AppError {
  return new AppError('VALIDATION_ERROR', 400, message);
}

export function parseHierarchyQuery(value: unknown): HierarchyQuery {
  const parsed = hierarchyQuerySchema.safeParse(value);
  if (!parsed.success) throw invalidRequest('Query is invalid');
  return parsed.data;
}

export function parseUuid(value: unknown): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw invalidRequest('Identifier is invalid');
  return parsed.data;
}
