import { z } from 'zod';
import type { SchemaObject } from '@nestjs/swagger';

import { AppError } from '../common/errors/app-error.js';

export const userRoles = ['ADMIN', 'FARMER', 'CLIENT_DEVELOPER'] as const;
export const userStatuses = ['ACTIVE', 'DISABLED', 'PENDING_PASSWORD_CHANGE'] as const;

const normalizedEmail = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());

const createUserSchema = z.strictObject({
  email: normalizedEmail,
  displayName: z.string().trim().min(1).max(120),
  role: z.enum(userRoles),
});

const updateUserSchema = z
  .strictObject({
    displayName: z.string().trim().min(1).max(120).optional(),
    role: z.enum(userRoles).optional(),
    status: z.enum(userStatuses).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field is required',
  });

const listUsersQuerySchema = z.strictObject({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateUserInput = z.output<typeof createUserSchema>;
export type UpdateUserInput = z.output<typeof updateUserSchema>;
export type ListUsersQuery = z.output<typeof listUsersQuerySchema>;

export type UserDto = Readonly<{
  id: string;
  email: string;
  displayName: string;
  role: (typeof userRoles)[number];
  status: (typeof userStatuses)[number];
  isSuperAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type UserDetailDto = UserDto &
  Readonly<{
    assignments: Readonly<{ farmIds: readonly string[]; stationIds: readonly string[] }>;
  }>;

export const createUserOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'displayName', 'role'],
  properties: {
    email: { type: 'string', format: 'email', maxLength: 254 },
    displayName: { type: 'string', minLength: 1, maxLength: 120 },
    role: { type: 'string', enum: [...userRoles] },
  },
};

export const updateUserOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    displayName: { type: 'string', minLength: 1, maxLength: 120 },
    role: { type: 'string', enum: [...userRoles] },
    status: { type: 'string', enum: [...userStatuses] },
  },
};

export const userOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'email',
    'displayName',
    'role',
    'status',
    'isSuperAdmin',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    displayName: { type: 'string' },
    role: { type: 'string', enum: [...userRoles] },
    status: { type: 'string', enum: [...userStatuses] },
    isSuperAdmin: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

export const userDetailOpenApiSchema: SchemaObject = {
  ...userOpenApiSchema,
  required: [...(userOpenApiSchema.required ?? []), 'assignments'],
  properties: {
    ...userOpenApiSchema.properties,
    assignments: {
      type: 'object',
      additionalProperties: false,
      required: ['farmIds', 'stationIds'],
      properties: {
        farmIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        stationIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      },
    },
  },
};

export const provisionUserOpenApiSchema: SchemaObject = {
  type: 'object',
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      required: ['user', 'temporaryPassword'],
      properties: {
        user: userOpenApiSchema,
        temporaryPassword: { type: 'string', minLength: 20, maxLength: 20, readOnly: true },
      },
    },
  },
};

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', 400, 'Request body is invalid');
  }
  return result.data;
}

export const parseCreateUser = (value: unknown): CreateUserInput => parse(createUserSchema, value);
export const parseUpdateUser = (value: unknown): UpdateUserInput => parse(updateUserSchema, value);
export const parseUserId = (value: unknown): string => parse(z.uuid(), value);
export const parseListUsersQuery = (value: unknown): ListUsersQuery =>
  parse(listUsersQuerySchema, value);
