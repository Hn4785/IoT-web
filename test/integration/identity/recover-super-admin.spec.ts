import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PasswordService } from '../../../src/auth/password.service.js';
import { bootstrapSuperAdmin } from '../../../src/identity/bootstrap-super-admin.js';
import { recoverSuperAdmin } from '../../../src/identity/recover-super-admin.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

const prisma = createTestPrismaClient();
const passwords = new PasswordService();

describe('Super Admin emergency recovery', () => {
  beforeAll(prepareTestDatabase);
  afterAll(() => prisma.$disconnect());

  it('changes only the authority holder password, unlocks it, revokes sessions, and audits', async () => {
    const id = await bootstrapSuperAdmin(
      prisma,
      passwords,
      { email: 'root@example.test', displayName: 'Root' },
      'Original-pass-2026',
    );
    await prisma.user.update({
      where: { id },
      data: { failedLoginCount: 5, lockedUntil: new Date(Date.now() + 60_000) },
    });
    const other = await prisma.user.create({
      data: {
        email: 'unaffected@example.test',
        displayName: 'Unaffected',
        role: 'FARMER',
        passwordHash: await passwords.hash('Unaffected-pass-2026'),
      },
    });
    const previousRevocation = new Date('2026-01-01T00:00:00Z');
    const sessions = await Promise.all(
      [id, id, other.id].map((userId, index) =>
        prisma.session.create({
          data: {
            userId,
            tokenHash: String(index + 1).repeat(64),
            familyId: randomUUID(),
            expiresAt: new Date(Date.now() + 60_000),
            ...(index === 1 ? { revokedAt: previousRevocation, revokeReason: 'LOGOUT' } : {}),
          },
        }),
      ),
    );

    await recoverSuperAdmin(prisma, passwords, 'ROOT@example.test', 'Recovered-pass-2026');

    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(await passwords.verify(user.passwordHash, 'Recovered-pass-2026')).toBe(true);
    expect(await passwords.verify(user.passwordHash, 'Original-pass-2026')).toBe(false);
    expect(user).toMatchObject({ role: 'ADMIN', status: 'ACTIVE', failedLoginCount: 0 });
    expect(user.lockedUntil).toBeNull();
    const recoveredSessions = await Promise.all(
      sessions.map((session) => prisma.session.findUniqueOrThrow({ where: { id: session.id } })),
    );
    expect(recoveredSessions[0]).toMatchObject({
      revokeReason: 'SUPER_ADMIN_EMERGENCY_RECOVERY',
      revokedAt: expect.any(Date) as Date,
    });
    expect(recoveredSessions[1]).toMatchObject({
      revokedAt: previousRevocation,
      revokeReason: 'LOGOUT',
    });
    expect(recoveredSessions[2]).toMatchObject({ revokedAt: null, revokeReason: null });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).toEqual(other);
    await expect(
      prisma.securityAuditEvent.count({ where: { action: 'SUPER_ADMIN_EMERGENCY_RECOVERY' } }),
    ).resolves.toBe(1);
    const audit = await prisma.securityAuditEvent.findFirstOrThrow({
      where: { action: 'SUPER_ADMIN_EMERGENCY_RECOVERY' },
    });
    expect(audit).toMatchObject({ actorUserId: id, targetId: id, result: 'SUCCESS' });
    for (const secret of ['Recovered-pass-2026', 'Original-pass-2026', user.passwordHash]) {
      expect(JSON.stringify(audit)).not.toContain(secret);
    }
  });

  it('rejects an email that does not hold the authority', async () => {
    await expect(
      recoverSuperAdmin(prisma, passwords, 'other@example.test', 'Recovered-pass-2026'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
