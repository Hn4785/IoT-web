import { z } from 'zod';
import type { SchemaObject } from '@nestjs/swagger';

import { AppError } from '../common/errors/app-error.js';

const createApiKeySchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  stationIds: z.array(z.uuid()).max(100).default([]),
});

export type CreateApiKeyInput = z.output<typeof createApiKeySchema>;

export type ApiKeyDto = Readonly<{
  id: string;
  name: string;
  prefix: string;
  expiresAt: string;
  requestsPerMinute: number;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  stationIds: readonly string[];
}>;

export const createApiKeyOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    stationIds: {
      type: 'array',
      maxItems: 100,
      uniqueItems: true,
      items: { type: 'string', format: 'uuid' },
      default: [],
    },
  },
};

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 400, 'Request is invalid');
  return parsed.data;
}

export const parseCreateApiKey = (value: unknown): CreateApiKeyInput =>
  parse(createApiKeySchema, value);
export const parseApiKeyId = (value: unknown): string => parse(z.uuid(), value);
