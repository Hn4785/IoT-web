import { Injectable } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

export const sessionWithUserSelect = {
  id: true,
  userId: true,
  tokenHash: true,
  familyId: true,
  expiresAt: true,
  revokedAt: true,
  replacedBySessionId: true,
  revokeReason: true,
  user: { select: { status: true } },
} satisfies Prisma.SessionSelect;

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTokenHash(tokenHash: string) {
    return this.prisma.session.findUnique({
      where: { tokenHash },
      select: sessionWithUserSelect,
    });
  }

  transaction<T>(work: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
