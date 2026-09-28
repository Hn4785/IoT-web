import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';

const createDataSourceSchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  baseUrl: z.url().max(2048),
  xApiKey: z.string().trim().min(1).max(4096),
  plotId: z.uuid(),
});

const listDataSourcesSchema = z.strictObject({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateDataSourceInput = z.output<typeof createDataSourceSchema>;
export type ListDataSourcesQuery = z.output<typeof listDataSourcesSchema>;

export type DataSourceDto = Readonly<{
  id: string;
  name: string;
  owner: Readonly<{ id: string; displayName: string; role: 'ADMIN' | 'FARMER' }>;
  baseUrl: string;
  keyPreview: string | null;
  stationCount: number;
  visibleAccountCount: number;
  connectionStatus: 'CONNECTED' | 'FAILED';
  lastCheckedAt: string;
  canManageAccess: boolean;
  canRevealKey: boolean;
  createdAt: string;
  updatedAt: string;
}>;

function parse<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('VALIDATION_ERROR', 400, message);
  return result.data;
}

export const parseCreateDataSource = (value: unknown): CreateDataSourceInput =>
  parse(createDataSourceSchema, value, 'Request body is invalid');
export const parseListDataSources = (value: unknown): ListDataSourcesQuery =>
  parse(listDataSourcesSchema, value, 'Query is invalid');
export const parseDataSourceId = (value: unknown): string =>
  parse(z.uuid(), value, 'Data source identifier is invalid');

export const createDataSourceOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'baseUrl', 'xApiKey', 'plotId'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 160 },
    baseUrl: { type: 'string', format: 'uri', maxLength: 2048 },
    xApiKey: { type: 'string', minLength: 1, maxLength: 4096, writeOnly: true },
    plotId: { type: 'string', format: 'uuid' },
  },
};

export const dataSourceOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'name',
    'owner',
    'baseUrl',
    'keyPreview',
    'stationCount',
    'visibleAccountCount',
    'connectionStatus',
    'lastCheckedAt',
    'canManageAccess',
    'canRevealKey',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    owner: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'displayName', 'role'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        displayName: { type: 'string' },
        role: { type: 'string', enum: ['ADMIN', 'FARMER'] },
      },
    },
    baseUrl: { type: 'string', format: 'uri' },
    keyPreview: { type: 'string', nullable: true, maxLength: 4 },
    stationCount: { type: 'integer', minimum: 0 },
    visibleAccountCount: { type: 'integer', minimum: 1 },
    connectionStatus: { type: 'string', enum: ['CONNECTED', 'FAILED'] },
    lastCheckedAt: { type: 'string', format: 'date-time' },
    canManageAccess: { type: 'boolean' },
    canRevealKey: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};
