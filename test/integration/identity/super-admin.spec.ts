import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SignJWT } from 'jose';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { PasswordService } from '../../../src/auth/password.service.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const config = makeTestRuntimeConfig();
const prisma = createTestPrismaClient();
const passwords = new PasswordService();
const currentPassword = 'Root-password-2026';

type Fixture = Awaited<ReturnType<typeof seedFixture>>;
type ErrorResponse = { error: { code: string } };
type TransferResponse = { data: { holderUserId: string } };

async function accessToken(userId: string): Promise<string> {
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: randomBytes(32).toString('hex'),
      familyId: randomUUID(),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  });
  return new SignJWT({ sessionId: session.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('iot-api')
    .setAudience('iot-web')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(config.jwtSecret));
}

async function seedFixture() {
  const passwordHash = await passwords.hash(currentPassword);
  const [root, firstAdmin, secondAdmin, farmer] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'root@example.test',
        displayName: 'Root',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        email: 'first-admin@example.test',
        displayName: 'First Admin',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        email: 'second-admin@example.test',
        displayName: 'Second Admin',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        email: 'farmer@example.test',
        displayName: 'Farmer',
        passwordHash,
        role: 'FARMER',
        status: 'ACTIVE',
      },
    }),
  ]);
  await prisma.systemAuthority.create({
    data: { authority: 'SUPER_ADMIN', holderUserId: root.id },
  });
  return {
    root,
    firstAdmin,
    secondAdmin,
    farmer,
    rootToken: await accessToken(root.id),
    normalAdminToken: await accessToken(firstAdmin.id),
  };
}

describe('Super Admin transfer', () => {
  let app: NestFastifyApplication;
  let fixture: Fixture;

  beforeAll(async () => {
    await prepareTestDatabase();
    app = await createApp(config);
  });

  beforeEach(async () => {
    await prepareTestDatabase();
    fixture = await seedFixture();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('transfers authority to an active Admin and revokes both users sessions', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/super-admin/transfer',
      headers: { authorization: `Bearer ${fixture.rootToken}` },
      payload: { successorUserId: fixture.firstAdmin.id, currentPassword },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<TransferResponse>().data).toEqual({ holderUserId: fixture.firstAdmin.id });
    expect(
      await prisma.session.count({
        where: { userId: { in: [fixture.root.id, fixture.firstAdmin.id] }, revokedAt: null },
      }),
    ).toBe(0);
    expect(
      await prisma.securityAuditEvent.count({ where: { action: 'SUPER_ADMIN_TRANSFERRED' } }),
    ).toBe(1);
  });

  it('requires the current holder, current password and an active Admin successor', async () => {
    const normalAdmin = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/super-admin/transfer',
      headers: { authorization: `Bearer ${fixture.normalAdminToken}` },
      payload: { successorUserId: fixture.secondAdmin.id, currentPassword },
    });
    expect(normalAdmin.statusCode).toBe(403);

    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/super-admin/transfer',
      headers: { authorization: `Bearer ${fixture.rootToken}` },
      payload: { successorUserId: fixture.firstAdmin.id, currentPassword: 'Wrong-password-2026' },
    });
    expect(wrongPassword.statusCode).toBe(401);
    expect(wrongPassword.json<ErrorResponse>().error.code).toBe('INVALID_CREDENTIALS');

    const farmer = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/super-admin/transfer',
      headers: { authorization: `Bearer ${fixture.rootToken}` },
      payload: { successorUserId: fixture.farmer.id, currentPassword },
    });
    expect(farmer.statusCode).toBe(409);
  });

  it('keeps exactly one holder under concurrent transfer attempts', async () => {
    const [first, second] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/super-admin/transfer',
        headers: { authorization: `Bearer ${fixture.rootToken}` },
        payload: { successorUserId: fixture.firstAdmin.id, currentPassword },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/super-admin/transfer',
        headers: { authorization: `Bearer ${fixture.rootToken}` },
        payload: { successorUserId: fixture.secondAdmin.id, currentPassword },
      }),
    ]);

    expect([first.statusCode, second.statusCode].filter((status) => status === 200)).toHaveLength(
      1,
    );
    expect(await prisma.systemAuthority.count()).toBe(1);
    const holder = await prisma.systemAuthority.findUniqueOrThrow({
      where: { authority: 'SUPER_ADMIN' },
    });
    expect([fixture.firstAdmin.id, fixture.secondAdmin.id]).toContain(holder.holderUserId);
  });
});
