import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';

import { PasswordService } from '../auth/password.service.js';
import { SessionService } from '../auth/session.service.js';
import { AuthorizationPolicy } from '../authorization/authorization.policy.js';
import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { SecurityAuditService } from '../security-audit/security-audit.service.js';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
  UserDetailDto,
  UserDto,
} from './identity.contracts.js';
import { IdentityRepository, safeUserSelect } from './identity.repository.js';
import { toUserDto } from './user-dto.js';

const TEMPORARY_PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
const PASSWORD_RESET_COOLDOWN_MS = 30_000;

function temporaryPassword(): string {
  return Array.from({ length: 20 }, () =>
    TEMPORARY_PASSWORD_ALPHABET.charAt(randomInt(TEMPORARY_PASSWORD_ALPHABET.length)),
  ).join('');
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly repository: IdentityRepository,
    private readonly passwords: PasswordService,
    private readonly audits: SecurityAuditService,
    private readonly sessions: SessionService,
    private readonly policy: AuthorizationPolicy,
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

  async getUser(userId: string): Promise<UserDetailDto> {
    const user = await this.repository.findUser(userId);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    return {
      ...toUserDto(user),
      assignments: {
        farmIds: user.farmMemberships.map(({ farmId }) => farmId),
        stationIds: user.clientStationGrants.map(({ stationId }) => stationId),
      },
    };
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
      const credentialsChanged =
        (input.role !== undefined && input.role !== target.role) ||
        (input.status !== undefined && input.status !== target.status);
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
          this.sessions.revokeAll(transaction, userId, 'ACCOUNT_CHANGED'),
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
    const user = await (async () => {
      try {
        return await this.repository.transaction(async (transaction) => {
          const [lock] = await transaction.$queryRaw<Array<{ acquired: boolean }>>`
            SELECT pg_try_advisory_xact_lock(hashtextextended(${userId}, 0)) AS acquired
          `;
          if (!lock?.acquired) {
            throw new AppError('CONFLICT', 409, 'Password reset is already in progress');
          }

          const [target, authority] = await Promise.all([
            transaction.user.findUnique({
              where: { id: userId },
              select: safeUserSelect,
            }),
            transaction.systemAuthority.findUnique({
              where: { authority: 'SUPER_ADMIN' },
              select: { holderUserId: true },
            }),
          ]);
          if (!target) throw new AppError('NOT_FOUND', 404, 'User not found');
          const actorIsSuperAdmin = authority?.holderUserId === actor.userId;
          if (actorIsSuperAdmin && target.id === actor.userId) {
            throw new AppError(
              'CONFLICT',
              409,
              'Use the emergency recovery command to reset the Super Admin password',
            );
          }
          if (!actorIsSuperAdmin && (target.id === actor.userId || target.role === 'ADMIN')) {
            throw new AppError('FORBIDDEN', 403, 'This password cannot be reset by an Admin');
          }
          if (
            target.status === 'PENDING_PASSWORD_CHANGE' &&
            Date.now() - target.updatedAt.getTime() < PASSWORD_RESET_COOLDOWN_MS
          ) {
            throw new AppError('CONFLICT', 409, 'Password reset was issued recently');
          }

          const passwordHash = await this.passwords.hash(plaintext);
          await this.sessions.revokeAll(transaction, userId, 'PASSWORD_RESET');
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
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
          throw new AppError('CONFLICT', 409, 'Password reset is already pending');
        }
        throw error;
      }
    })();
    return { user: toUserDto(user), temporaryPassword: plaintext };
  }

  async setFarmMembership(
    actor: CurrentPrincipalValue,
    userId: string,
    farmId: string,
    assigned: boolean,
    requestId: string,
  ): Promise<{ assigned: boolean }> {
    return this.repository.retryingIdempotentTransaction(async (transaction) => {
      const [target, farm] = await Promise.all([
        transaction.user.findUnique({ where: { id: userId }, select: { role: true } }),
        transaction.farm.findUnique({ where: { id: farmId }, select: { id: true } }),
      ]);
      if (!target || !farm) throw new AppError('NOT_FOUND', 404, 'Resource not found');
      if (!this.policy.canReceiveFarmMembership(target.role)) {
        throw new AppError('CONFLICT', 409, 'Only Farmer accounts can receive farm memberships');
      }
      if (assigned) {
        await transaction.farmMembership.upsert({
          where: { userId_farmId: { userId, farmId } },
          create: { userId, farmId },
          update: {},
        });
      } else {
        await transaction.farmMembership.deleteMany({ where: { userId, farmId } });
      }
      await this.audits.record(transaction, {
        actorUserId: actor.userId,
        action: assigned ? 'FARM_MEMBERSHIP_ASSIGNED' : 'FARM_MEMBERSHIP_REMOVED',
        targetType: 'FarmMembership',
        targetId: `${userId}:${farmId}`,
        requestId,
      });
      return { assigned };
    });
  }

  async setStationGrant(
    actor: CurrentPrincipalValue,
    userId: string,
    stationId: string,
    assigned: boolean,
    requestId: string,
  ): Promise<{ assigned: boolean }> {
    return this.repository.retryingIdempotentTransaction(async (transaction) => {
      const [target, station] = await Promise.all([
        transaction.user.findUnique({ where: { id: userId }, select: { role: true } }),
        transaction.station.findUnique({ where: { id: stationId }, select: { id: true } }),
      ]);
      if (!target || !station) throw new AppError('NOT_FOUND', 404, 'Resource not found');
      if (!this.policy.canReceiveStationGrant(target.role)) {
        throw new AppError(
          'CONFLICT',
          409,
          'Only Client Developer accounts can receive station grants',
        );
      }
      if (assigned) {
        await transaction.clientStationGrant.upsert({
          where: { userId_stationId: { userId, stationId } },
          create: { userId, stationId },
          update: {},
        });
      } else {
        await transaction.apiKeyStationScope.deleteMany({
          where: { stationId, apiKey: { ownerUserId: userId } },
        });
        await transaction.clientStationGrant.deleteMany({ where: { userId, stationId } });
      }
      await this.audits.record(transaction, {
        actorUserId: actor.userId,
        action: assigned ? 'STATION_GRANT_ASSIGNED' : 'STATION_GRANT_REMOVED',
        targetType: 'ClientStationGrant',
        targetId: `${userId}:${stationId}`,
        requestId,
      });
      return { assigned };
    });
  }
}
