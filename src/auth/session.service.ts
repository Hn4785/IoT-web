import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';

import { AppError } from '../common/errors/app-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import { SecurityAuditService } from '../security-audit/security-audit.service.js';
import { JwtService } from './jwt.service.js';
import { SessionRepository } from './session.repository.js';
import { TOKEN_HASH_SERVICE, TokenHashService } from './token-hash.service.js';

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 900;
const REFRESH_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type RefreshResult = Readonly<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}>;

@Injectable()
export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly jwt: JwtService,
    private readonly audits: SecurityAuditService,
    @Inject(TOKEN_HASH_SERVICE) private readonly tokenHashes: TokenHashService,
  ) {}

  async rotate(refreshToken: string, requestId: string): Promise<RefreshResult> {
    if (!REFRESH_TOKEN_PATTERN.test(refreshToken)) this.invalidSession();
    const tokenHash = this.tokenHashes.hash(refreshToken);
    const current = await this.sessions.findByTokenHash(tokenHash);
    if (!current) this.invalidSession();
    if (current.replacedBySessionId || current.revokeReason === 'ROTATED') {
      await this.revokeReusedFamily(current.familyId, current.userId, current.id, requestId);
      throw new AppError('SESSION_REUSED', 401, 'Refresh session reuse was detected');
    }
    if (current.revokedAt || current.expiresAt <= new Date()) this.invalidSession();
    if (current.user.status === 'DISABLED') {
      throw new AppError('ACCOUNT_DISABLED', 403, 'Account is disabled');
    }

    const replacementToken = randomBytes(32).toString('base64url');
    const replacementId = randomUUID();
    const now = new Date();
    const outcome = await this.sessions.transaction(async (transaction) => {
      const claimed = await transaction.session.updateMany({
        where: {
          id: current.id,
          revokedAt: null,
          replacedBySessionId: null,
          expiresAt: { gt: now },
        },
        data: {
          revokedAt: now,
          lastUsedAt: now,
          replacedBySessionId: replacementId,
          revokeReason: 'ROTATED',
        },
      });
      if (claimed.count !== 1) return false;
      await transaction.session.create({
        data: {
          id: replacementId,
          userId: current.userId,
          tokenHash: this.tokenHashes.hash(replacementToken),
          familyId: current.familyId,
          expiresAt: new Date(now.getTime() + REFRESH_TOKEN_LIFETIME_MS),
        },
      });
      return true;
    });

    if (!outcome) {
      const latest = await this.sessions.findByTokenHash(tokenHash);
      if (latest?.replacedBySessionId || latest?.revokeReason === 'ROTATED') {
        await this.revokeReusedFamily(current.familyId, current.userId, current.id, requestId);
        throw new AppError('SESSION_REUSED', 401, 'Refresh session reuse was detected');
      }
      this.invalidSession();
    }
    return {
      accessToken: await this.jwt.sign({ userId: current.userId, sessionId: replacementId }),
      refreshToken: replacementToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    };
  }

  async logout(refreshToken: string | undefined, requestId: string): Promise<void> {
    if (!refreshToken || !REFRESH_TOKEN_PATTERN.test(refreshToken)) return;
    const current = await this.sessions.findByTokenHash(this.tokenHashes.hash(refreshToken));
    if (!current || current.revokedAt) return;
    const now = new Date();
    await this.sessions.transaction(async (transaction) => {
      const revoked = await transaction.session.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: now, lastUsedAt: now, revokeReason: 'LOGOUT' },
      });
      if (revoked.count === 1) {
        await this.audits.record(transaction, {
          actorUserId: current.userId,
          action: 'LOGOUT',
          targetType: 'Session',
          targetId: current.id,
          requestId,
        });
      }
    });
  }

  async logoutAll(userId: string, reason: string): Promise<number> {
    const result = await this.sessions.transaction((transaction) =>
      this.revokeAll(transaction, userId, reason),
    );
    return result.count;
  }

  revokeAll(
    transaction: Prisma.TransactionClient,
    userId: string,
    reason: string,
    exceptSessionId?: string,
  ) {
    return transaction.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokeReason: reason.slice(0, 80) },
    });
  }

  private async revokeReusedFamily(
    familyId: string,
    userId: string,
    sessionId: string,
    requestId: string,
  ): Promise<void> {
    await this.sessions.transaction(async (transaction) => {
      await transaction.session.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'REUSE_DETECTED' },
      });
      await this.audits.record(transaction, {
        actorUserId: userId,
        action: 'SESSION_REUSE_DETECTED',
        targetType: 'Session',
        targetId: sessionId,
        requestId,
        metadata: { familyId },
      });
    });
  }

  private invalidSession(): never {
    throw new AppError('SESSION_EXPIRED', 401, 'Session is invalid or expired');
  }
}
