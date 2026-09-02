import type { Prisma } from '../generated/prisma/client.js';
import type { UserDto } from './identity.contracts.js';
import { safeUserSelect } from './identity.repository.js';

export type SafeUserRecord = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;

export function toUserDto(user: SafeUserRecord): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    isSuperAdmin: user.heldAuthority?.authority === 'SUPER_ADMIN',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
