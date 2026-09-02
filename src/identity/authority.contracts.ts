import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';

const transferSuperAdminSchema = z.strictObject({
  successorUserId: z.uuid(),
  currentPassword: z.string().min(12).max(128),
});

export type TransferSuperAdminInput = z.output<typeof transferSuperAdminSchema>;

export function parseTransferSuperAdmin(value: unknown): TransferSuperAdminInput {
  const parsed = transferSuperAdminSchema.safeParse(value);
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 400, 'Request body is invalid');
  return parsed.data;
}
