import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { ListUsersQuery } from './identity.contracts.js';

export const safeUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  heldAuthority: { select: { authority: true } },
} as const;

const safeUserDetailSelect = {
  ...safeUserSelect,
  farmMemberships: { select: { farmId: true }, orderBy: { farmId: 'asc' as const } },
  clientStationGrants: { select: { stationId: true }, orderBy: { stationId: 'asc' as const } },
} as const;

@Injectable()
export class IdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  listUsers(query: ListUsersQuery) {
    return this.prisma.user.findMany({
      select: safeUserSelect,
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  findUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: safeUserDetailSelect });
  }

  transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async retryingIdempotentTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    maxAttempts = 5,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.transaction(operation);
      } catch (error) {
        const canRetry =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.code === 'P2034');
        if (!canRetry || attempt === maxAttempts) throw error;
      }
    }
    throw new Error('Idempotent transaction retry loop exhausted');
  }
}
