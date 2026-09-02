import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

const prisma = createTestPrismaClient();

describe('identity database schema', () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('enforces normalized email and the singleton Super Admin authority', async () => {
    const first = await prisma.user.create({
      data: {
        email: 'root@example.test',
        displayName: 'Root Admin',
        passwordHash: 'argon2id-test-marker',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    await prisma.systemAuthority.create({
      data: { authority: 'SUPER_ADMIN', holderUserId: first.id },
    });

    await expect(
      prisma.user.create({
        data: {
          email: 'ROOT@example.test',
          displayName: 'Duplicate Root',
          passwordHash: 'argon2id-test-marker',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.systemAuthority.create({
        data: { authority: 'SUPER_ADMIN', holderUserId: first.id },
      }),
    ).rejects.toThrow();
    await expect(prisma.systemAuthority.count()).resolves.toBe(1);
  });
});
