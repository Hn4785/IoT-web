import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';

const resourceChoiceSchema = z.union([
  z.strictObject({ id: z.uuid() }),
  z.strictObject({ name: z.string().trim().min(1).max(160) }),
]);
export type ResourceChoice = z.output<typeof resourceChoiceSchema>;

const createDataSourceSchema = z.strictObject({
  name: z.string().trim().min(1).max(160).optional(),
  baseUrl: z.url().max(2048),
  xApiKey: z.string().trim().min(1).max(4096),
  farm: resourceChoiceSchema,
  plot: resourceChoiceSchema,
});

const listDataSourcesSchema = z.strictObject({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const revealDataSourceSchema = z.strictObject({
  currentPassword: z.string().min(12).max(128),
});

const setDataSourceGrantSchema = z.strictObject({
  stationIds: z
    .array(z.uuid())
    .min(1)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Station identifiers must be unique',
    }),
});

export type CreateDataSourceInput = z.output<typeof createDataSourceSchema>;
export type ListDataSourcesQuery = z.output<typeof listDataSourcesSchema>;
export type RevealDataSourceInput = z.output<typeof revealDataSourceSchema>;
export type SetDataSourceGrantInput = z.output<typeof setDataSourceGrantSchema>;

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

export type DataSourceGrantDto = Readonly<{
  user: Readonly<{
    id: string;
    displayName: string;
    email: string;
    role: 'FARMER' | 'CLIENT_DEVELOPER';
  }>;
  stationIds: readonly string[];
  createdAt: string;
}>;

export type DataSourceGrantCandidateDto = Readonly<{
  id: string;
  displayName: string;
  email: string;
  role: 'FARMER' | 'CLIENT_DEVELOPER';
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
export const parseGrantUserId = (value: unknown): string =>
  parse(z.uuid(), value, 'User identifier is invalid');
export const parseRevealDataSource = (value: unknown): RevealDataSourceInput =>
  parse(revealDataSourceSchema, value, 'Request body is invalid');
export const parseSetDataSourceGrant = (value: unknown): SetDataSourceGrantInput =>
  parse(setDataSourceGrantSchema, value, 'Request body is invalid');

export const setDataSourceGrantOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['stationIds'],
  properties: {
    stationIds: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      uniqueItems: true,
      items: { type: 'string', format: 'uuid' },
    },
  },
};

export const createDataSourceOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['baseUrl', 'xApiKey', 'farm', 'plot'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 160 },
    baseUrl: { type: 'string', format: 'uri', maxLength: 2048 },
    xApiKey: { type: 'string', minLength: 1, maxLength: 4096, writeOnly: true },
    farm: {
      oneOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: { name: { type: 'string', minLength: 1, maxLength: 160 } },
        },
      ],
    },
    plot: {
      oneOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: { name: { type: 'string', minLength: 1, maxLength: 160 } },
        },
      ],
    },
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

export const revealDataSourceOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['currentPassword'],
  properties: {
    currentPassword: { type: 'string', minLength: 12, maxLength: 128, writeOnly: true },
  },
};
