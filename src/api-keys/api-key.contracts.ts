import { z } from 'zod';

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

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 400, 'Request is invalid');
  return parsed.data;
}

export const parseCreateApiKey = (value: unknown): CreateApiKeyInput =>
  parse(createApiKeySchema, value);
export const parseApiKeyId = (value: unknown): string => parse(z.uuid(), value);
