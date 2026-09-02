import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
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
    return this.prisma.user.findUnique({ where: { id: userId }, select: safeUserSelect });
  }

  transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(operation, {
      isolationLevel: 'Serializable',
    });
  }
}
