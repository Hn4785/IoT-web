import { describe, expect, it, vi } from 'vitest';

import type { JwtService } from './jwt.service.js';
import type { SessionRepository } from './session.repository.js';
import { SessionService } from './session.service.js';
import type { TokenHashService } from './token-hash.service.js';

describe('SessionService rotation races', () => {
  it('does not report replay when account revocation wins the refresh race', async () => {
    const activeSession = {
      id: 'session-id',
      userId: 'user-id',
      tokenHash: 'token-hash',
      familyId: 'family-id',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedBySessionId: null,
      revokeReason: null,
      user: { status: 'ACTIVE' as const },
    };
    const accountRevokedSession = {
      ...activeSession,
      revokedAt: new Date(),
      revokeReason: 'ACCOUNT_CHANGED',
    };
    const findByTokenHash = vi
      .fn()
      .mockResolvedValueOnce(activeSession)
      .mockResolvedValueOnce(accountRevokedSession);
    const transaction = vi.fn(async (work: (transaction: unknown) => Promise<unknown>) =>
      work({ session: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } }),
    );
    const record = vi.fn();
    const service = new SessionService(
      { findByTokenHash, transaction } as unknown as SessionRepository,
      { sign: vi.fn() } as unknown as JwtService,
      { record },
      { hash: vi.fn().mockReturnValue('token-hash') } as unknown as TokenHashService,
    );

    await expect(service.rotate('a'.repeat(43), 'request-id')).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
    expect(findByTokenHash).toHaveBeenCalledTimes(2);
    expect(record).not.toHaveBeenCalled();
  });
});
