import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';

const loginSchema = z.strictObject({
  email: z
    .preprocess((value) => (typeof value === 'string' ? value.trim() : value), z.email().max(254))
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});

const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(12).max(128),
  newPassword: z.string().min(12).max(128),
});

export type LoginInput = z.output<typeof loginSchema>;
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', 400, 'Request body is invalid');
  }
  return result.data;
}

export const parseLogin = (value: unknown): LoginInput => parse(loginSchema, value);
export const parseChangePassword = (value: unknown): ChangePasswordInput =>
  parse(changePasswordSchema, value);
