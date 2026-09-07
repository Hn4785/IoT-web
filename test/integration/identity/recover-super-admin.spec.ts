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

    await recoverSuperAdmin(prisma, passwords, 'ROOT@example.test', 'Recovered-pass-2026');

    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(await passwords.verify(user.passwordHash, 'Recovered-pass-2026')).toBe(true);
    expect(user).toMatchObject({ role: 'ADMIN', status: 'ACTIVE', failedLoginCount: 0 });
    expect(user.lockedUntil).toBeNull();
    await expect(
      prisma.securityAuditEvent.count({ where: { action: 'SUPER_ADMIN_EMERGENCY_RECOVERY' } }),
    ).resolves.toBe(1);
  });

  it('rejects an email that does not hold the authority', async () => {
    await expect(
      recoverSuperAdmin(prisma, passwords, 'other@example.test', 'Recovered-pass-2026'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
