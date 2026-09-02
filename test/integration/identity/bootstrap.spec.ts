import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PasswordService } from '../../../src/auth/password.service.js';
import { bootstrapSuperAdmin } from '../../../src/identity/bootstrap-super-admin.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

const prisma = createTestPrismaClient();

describe('initial Super Admin bootstrap', () => {
  beforeAll(prepareTestDatabase);
  afterAll(() => prisma.$disconnect());

  it('atomically creates exactly one active authority holder', async () => {
    const plaintext = 'Bootstrap-pass-2026';
    const userId = await bootstrapSuperAdmin(
      prisma,
      new PasswordService(),
      { email: 'ROOT@Example.test', displayName: 'Root Admin' },
      plaintext,
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const authority = await prisma.systemAuthority.findUniqueOrThrow({
      where: { authority: 'SUPER_ADMIN' },
    });
    const audit = await prisma.securityAuditEvent.findFirstOrThrow({
      where: { action: 'SUPER_ADMIN_BOOTSTRAPPED' },
    });

    expect(user).toMatchObject({ email: 'root@example.test', role: 'ADMIN', status: 'ACTIVE' });
    expect(user.passwordHash).not.toContain(plaintext);
    expect(authority.holderUserId).toBe(user.id);
    expect(audit).toMatchObject({ result: 'SUCCESS', targetId: user.id });

    await expect(
      bootstrapSuperAdmin(
        prisma,
        new PasswordService(),
        { email: 'second@example.test', displayName: 'Second Root' },
        'Second-pass-2026',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(prisma.user.count()).resolves.toBe(1);
  });
});
