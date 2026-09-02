import { Injectable } from '@nestjs/common';

import { PasswordService } from '../auth/password.service.js';
import { SessionService } from '../auth/session.service.js';
import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { SecurityAuditService } from '../security-audit/security-audit.service.js';
import type { TransferSuperAdminInput } from './authority.contracts.js';

@Injectable()
export class AuthorityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audits: SecurityAuditService,
  ) {}

  async transfer(
    actor: CurrentPrincipalValue,
    input: TransferSuperAdminInput,
    requestId: string,
  ): Promise<{ holderUserId: string }> {
    const authority = await this.prisma.systemAuthority.findUnique({
      where: { authority: 'SUPER_ADMIN' },
      select: { holderUserId: true, holder: { select: { passwordHash: true } } },
    });
    if (!authority || authority.holderUserId !== actor.userId) {
      throw new AppError('FORBIDDEN', 403, 'Only the current Super Admin can transfer authority');
    }
    if (!(await this.passwords.verify(authority.holder.passwordHash, input.currentPassword))) {
      throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid credentials');
    }
    if (input.successorUserId === actor.userId) {
      throw new AppError('CONFLICT', 409, 'The successor must be a different Admin');
    }

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const [current, successor] = await Promise.all([
            transaction.systemAuthority.findUnique({
              where: { authority: 'SUPER_ADMIN' },
              select: { holderUserId: true },
            }),
            transaction.user.findUnique({
              where: { id: input.successorUserId },
              select: { id: true, role: true, status: true },
            }),
          ]);
          if (current?.holderUserId !== actor.userId) {
            throw new AppError('CONFLICT', 409, 'Super Admin authority has already changed');
          }
          if (!successor || successor.role !== 'ADMIN' || successor.status !== 'ACTIVE') {
            throw new AppError('CONFLICT', 409, 'Successor must be an active Admin');
          }
          await transaction.systemAuthority.update({
            where: { authority: 'SUPER_ADMIN' },
            data: { holderUserId: successor.id },
          });
          await Promise.all([
            this.sessions.revokeAll(transaction, actor.userId, 'SUPER_ADMIN_TRANSFERRED'),
            this.sessions.revokeAll(transaction, successor.id, 'SUPER_ADMIN_TRANSFERRED'),
          ]);
          await this.audits.record(transaction, {
            actorUserId: actor.userId,
            action: 'SUPER_ADMIN_TRANSFERRED',
            targetType: 'User',
            targetId: successor.id,
            requestId,
            metadata: { previousHolderUserId: actor.userId },
          });
          return { holderUserId: successor.id };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new AppError('CONFLICT', 409, 'Super Admin authority has already changed');
      }
      throw error;
    }
  }
}
