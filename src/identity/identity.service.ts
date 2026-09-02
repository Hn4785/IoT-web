import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';

import type { CurrentPrincipalValue } from '../auth/current-principal.js';
import { PasswordService } from '../auth/password.service.js';
import { AppError } from '../common/errors/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { SecurityAuditService } from '../security-audit/security-audit.service.js';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
  UserDto,
} from './identity.contracts.js';
import { IdentityRepository, safeUserSelect } from './identity.repository.js';

const TEMPORARY_PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

type SafeUserRecord = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;

function temporaryPassword(): string {
  return Array.from({ length: 20 }, () =>
    TEMPORARY_PASSWORD_ALPHABET.charAt(randomInt(TEMPORARY_PASSWORD_ALPHABET.length)),
  ).join('');
}

function toUserDto(user: SafeUserRecord): UserDto {
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

@Injectable()
export class IdentityService {
  constructor(
    private readonly repository: IdentityRepository,
    private readonly passwords: PasswordService,
    private readonly audits: SecurityAuditService,
  ) {}

  async listUsers(
    query: ListUsersQuery,
  ): Promise<{ items: readonly UserDto[]; nextCursor: string | null }> {
    const records = await this.repository.listUsers(query);
    const hasNextPage = records.length > query.limit;
    const page = hasNextPage ? records.slice(0, query.limit) : records;
    return {
      items: page.map(toUserDto),
      nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async getUser(userId: string): Promise<UserDto> {
    const user = await this.repository.findUser(userId);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    return toUserDto(user);
  }

  async createUser(
    actor: CurrentPrincipalValue,
    input: CreateUserInput,
    requestId: string,
  ): Promise<{ user: UserDto; temporaryPassword: string }> {
    if (input.role === 'ADMIN' && !actor.isSuperAdmin) {
      throw new AppError('FORBIDDEN', 403, 'Only the Super Admin can create an Admin');
    }
    const plaintext = temporaryPassword();
    const passwordHash = await this.passwords.hash(plaintext);
    try {
      const user = await this.repository.transaction(async (transaction) => {
        if (input.role === 'ADMIN') {
          const authority = await transaction.systemAuthority.findUnique({
            where: { authority: 'SUPER_ADMIN' },
            select: { holderUserId: true },
          });
          if (authority?.holderUserId !== actor.userId) {
            throw new AppError('FORBIDDEN', 403, 'Only the Super Admin can create an Admin');
          }
        }
        const created = await transaction.user.create({
          data: {
            email: input.email,
            displayName: input.displayName,
            role: input.role,
            status: 'PENDING_PASSWORD_CHANGE',
            passwordHash,
          },
          select: safeUserSelect,
        });
        await this.audits.record(transaction, {
          actorUserId: actor.userId,
          action: 'USER_PROVISIONED',
          targetType: 'User',
          targetId: created.id,
          requestId,
          metadata: { role: input.role },
        });
        return created;
      });
      return { user: toUserDto(user), temporaryPassword: plaintext };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('CONFLICT', 409, 'Email is already in use');
      }
      throw error;
    }
  }

  async updateUser(
    actor: CurrentPrincipalValue,
    userId: string,
    input: UpdateUserInput,
    requestId: string,
  ): Promise<UserDto> {
    const credentialsChanged = input.role !== undefined || input.status !== undefined;
    const updateData: Prisma.UserUpdateInput = {};
    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.role !== undefined) updateData.role = input.role;
    if (input.status !== undefined) updateData.status = input.status;
    const updated = await this.repository.transaction(async (transaction) => {
      const [target, authority] = await Promise.all([
        transaction.user.findUnique({ where: { id: userId }, select: safeUserSelect }),
        transaction.systemAuthority.findUnique({
          where: { authority: 'SUPER_ADMIN' },
          select: { holderUserId: true },
        }),
      ]);
      if (!target) throw new AppError('NOT_FOUND', 404, 'User not found');
      const actorIsSuperAdmin = authority?.holderUserId === actor.userId;
      if (!actorIsSuperAdmin) {
        if (target.id === actor.userId || target.role === 'ADMIN') {
          throw new AppError('FORBIDDEN', 403, 'This account cannot be changed by an Admin');
        }
        if (input.role && input.role !== target.role) {
          throw new AppError('FORBIDDEN', 403, 'Only the Super Admin can change roles');
        }
      }
      if (
        target.heldAuthority &&
        ((input.role && input.role !== 'ADMIN') || input.status === 'DISABLED')
      ) {
        throw new AppError('CONFLICT', 409, 'Transfer Super Admin authority before this change');
      }
      const now = new Date();
      if (credentialsChanged) {
        await Promise.all([
          transaction.session.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: now, revokeReason: 'ACCOUNT_CHANGED' },
          }),
          transaction.apiKey.updateMany({
            where: { ownerUserId: userId, revokedAt: null },
            data: { revokedAt: now },
          }),
        ]);
      }
      if (input.role && input.role !== target.role) {
        if (input.role !== 'FARMER') {
          await transaction.farmMembership.deleteMany({ where: { userId } });
        }
        if (input.role !== 'CLIENT_DEVELOPER') {
          await transaction.clientStationGrant.deleteMany({ where: { userId } });
        }
      }
      const changed = await transaction.user.update({
        where: { id: userId },
        data: updateData,
        select: safeUserSelect,
      });
      await this.audits.record(transaction, {
        actorUserId: actor.userId,
        action: 'USER_UPDATED',
        targetType: 'User',
        targetId: userId,
        requestId,
        metadata: {
          previousRole: target.role,
          newRole: changed.role,
          previousStatus: target.status,
          newStatus: changed.status,
        },
      });
      return changed;
    });
    return toUserDto(updated);
  }

  async resetPassword(
    actor: CurrentPrincipalValue,
    userId: string,
    requestId: string,
  ): Promise<{ user: UserDto; temporaryPassword: string }> {
    const plaintext = temporaryPassword();
    const passwordHash = await this.passwords.hash(plaintext);
    const user = await this.repository.transaction(async (transaction) => {
      const [target, authority] = await Promise.all([
        transaction.user.findUnique({ where: { id: userId }, select: safeUserSelect }),
        transaction.systemAuthority.findUnique({
          where: { authority: 'SUPER_ADMIN' },
          select: { holderUserId: true },
        }),
      ]);
      if (!target) throw new AppError('NOT_FOUND', 404, 'User not found');
      const actorIsSuperAdmin = authority?.holderUserId === actor.userId;
      if (!actorIsSuperAdmin && (target.id === actor.userId || target.role === 'ADMIN')) {
        throw new AppError('FORBIDDEN', 403, 'This password cannot be reset by an Admin');
      }
      const now = new Date();
      await transaction.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'PASSWORD_RESET' },
      });
      const changed = await transaction.user.update({
        where: { id: userId },
        data: { passwordHash, status: 'PENDING_PASSWORD_CHANGE', passwordChangedAt: null },
        select: safeUserSelect,
      });
      await this.audits.record(transaction, {
        actorUserId: actor.userId,
        action: 'PASSWORD_RESET',
        targetType: 'User',
        targetId: userId,
        requestId,
      });
      return changed;
    });
    return { user: toUserDto(user), temporaryPassword: plaintext };
  }
}
