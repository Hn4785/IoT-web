import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';

import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import { PrismaService } from '../database/prisma.service.js';
import type { UserDto } from '../identity/identity.contracts.js';
import { safeUserSelect } from '../identity/identity.repository.js';
import { toUserDto } from '../identity/user-dto.js';
import { SecurityAuditService } from '../security-audit/security-audit.service.js';
import type { ChangePasswordInput, LoginInput } from './auth.contracts.js';
import { JwtService } from './jwt.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { TOKEN_HASH_SERVICE, TokenHashService } from './token-hash.service.js';

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 900;
const REFRESH_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const DUMMY_PASSWORD = 'not-a-real-password-value';

export type LoginResult = Readonly<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserDto;
}>;

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyPasswordHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly audits: SecurityAuditService,
    private readonly sessions: SessionService,
    @Inject(TOKEN_HASH_SERVICE) private readonly tokenHashes: TokenHashService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await this.passwords.hash(DUMMY_PASSWORD);
  }

  async login(input: LoginInput, requestId: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: {
        ...safeUserSelect,
        passwordHash: true,
        failedLoginCount: true,
        lockedUntil: true,
      },
    });
    const isLocked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
    const canAttempt = Boolean(user && user.status !== 'DISABLED' && !isLocked);
    const passwordMatches = await this.passwords.verify(
      canAttempt && user ? user.passwordHash : this.dummyPasswordHash,
      input.password,
    );

    if (!user || !canAttempt || !passwordMatches) {
      await this.recordFailedLogin(user, requestId, canAttempt && !passwordMatches);
      throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
    }

    const refreshToken = randomBytes(32).toString('base64url');
    const familyId = randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS);
    const session = await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
      const created = await transaction.session.create({
        data: {
          userId: user.id,
          tokenHash: this.tokenHashes.hash(refreshToken),
          familyId,
          expiresAt,
        },
      });
      await this.audits.record(transaction, {
        actorUserId: user.id,
        action: 'LOGIN_SUCCEEDED',
        targetType: 'Session',
        targetId: created.id,
        requestId,
      });
      return created;
    });
    const accessToken = await this.jwt.sign({ userId: user.id, sessionId: session.id });
    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
      user: toUserDto(user),
    };
  }

  async me(principal: CurrentPrincipalValue): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: principal.userId },
      select: safeUserSelect,
    });
    if (!user) throw new AppError('SESSION_EXPIRED', 401, 'Session is invalid or expired');
    return toUserDto(user);
  }

  async changePassword(
    principal: CurrentPrincipalValue,
    input: ChangePasswordInput,
    requestId: string,
  ): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: principal.userId } });
    if (!user || !(await this.passwords.verify(user.passwordHash, input.currentPassword))) {
      throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
    }
    if (await this.passwords.verify(user.passwordHash, input.newPassword)) {
      throw new AppError('VALIDATION_ERROR', 400, 'New password must be different');
    }
    const passwordHash = await this.passwords.hash(input.newPassword);
    const updated = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          status: 'ACTIVE',
          failedLoginCount: 0,
          lockedUntil: null,
        },
        select: safeUserSelect,
      });
      await this.sessions.revokeAll(transaction, user.id, 'PASSWORD_CHANGED', principal.sessionId);
      await this.audits.record(transaction, {
        actorUserId: user.id,
        action: 'PASSWORD_CHANGED',
        targetType: 'User',
        targetId: user.id,
        requestId,
      });
      return changed;
    });
    return toUserDto(updated);
  }

  private async recordFailedLogin(
    user: { id: string; failedLoginCount: number } | null,
    requestId: string,
    incrementFailure: boolean,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      if (user && incrementFailure) {
        const updated = await transaction.user.update({
          where: { id: user.id },
          data: { failedLoginCount: { increment: 1 } },
          select: { failedLoginCount: true },
        });
        if (updated.failedLoginCount >= MAX_FAILED_LOGINS) {
          await transaction.user.update({
            where: { id: user.id },
            data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
          });
        }
      }
      await transaction.securityAuditEvent.create({
        data: {
          action: 'LOGIN_FAILED',
          targetType: 'Authentication',
          result: 'DENIED',
          requestId,
          metadata: {},
          ...(user ? { actorUserId: user.id, targetId: user.id } : {}),
        },
      });
    });
  }
}
