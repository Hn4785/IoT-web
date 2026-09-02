import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { PasswordService } from '../../../src/auth/password.service.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const config = makeTestRuntimeConfig();
const prisma = createTestPrismaClient();
const passwords = new PasswordService();
const validPassword = 'Valid-password-2026';
const invalidPassword = 'Invalid-password-2026';

type LoginResponse = {
  data: {
    accessToken: string;
    expiresIn: number;
    user: { id: string; role: string; status: string; isSuperAdmin: boolean };
  };
};

type ErrorResponse = { error: { code: string; message: string } };
type MeResponse = { data: { id: string; role: string; status: string } };

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

async function createUser(input: {
  email: string;
  role?: 'ADMIN' | 'FARMER' | 'CLIENT_DEVELOPER';
  status?: 'ACTIVE' | 'DISABLED' | 'PENDING_PASSWORD_CHANGE';
  password?: string;
}) {
  return prisma.user.create({
    data: {
      email: input.email,
      displayName: input.email.split('@')[0] ?? 'Test User',
      passwordHash: await passwords.hash(input.password ?? validPassword),
      role: input.role ?? 'FARMER',
      status: input.status ?? 'ACTIVE',
    },
  });
}

describe('database-backed authentication', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await prepareTestDatabase();
    await Promise.all([
      createUser({ email: 'farmer@example.test' }),
      createUser({ email: 'disabled@example.test', status: 'DISABLED' }),
      createUser({ email: 'lock@example.test' }),
      createUser({ email: 'mutable@example.test' }),
      createUser({
        email: 'pending-admin@example.test',
        role: 'ADMIN',
        status: 'PENDING_PASSWORD_CHANGE',
        password: 'Temporary-pass-2026',
      }),
    ]);
    app = await createApp(config);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('logs in without exposing the refresh token to JavaScript', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'FARMER@Example.test', password: validPassword },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie']).toContain('refreshToken=');
    expect(response.headers['set-cookie']).toContain('HttpOnly');
    expect(response.headers['set-cookie']).toContain('SameSite=Strict');
    const body = response.json<LoginResponse>();
    expect(body.data.expiresIn).toBe(900);
    expect(body.data.accessToken).toEqual(expect.any(String));
    expect(body.data.user).toMatchObject({ role: 'FARMER', status: 'ACTIVE' });
    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain('refreshToken');

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: bearer(body.data.accessToken),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json<MeResponse>().data.role).toBe('FARMER');
  });

  it('uses one public error for wrong, unknown and disabled accounts', async () => {
    for (const email of [
      'farmer@example.test',
      'missing@example.test',
      'disabled@example.test',
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password: invalidPassword },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json<ErrorResponse>().error).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      expect(response.body).not.toContain(email);
    }
  });

  it('locks an account for fifteen minutes after five consecutive failures', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'lock@example.test', password: invalidPassword },
      });
      expect(response.statusCode).toBe(401);
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'lock@example.test' } });
    expect(user.failedLoginCount).toBe(5);
    expect(user.lockedUntil?.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);

    const denied = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'lock@example.test', password: validPassword },
    });
    expect(denied.statusCode).toBe(401);
    expect(denied.json<ErrorResponse>().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('reloads role and session state instead of trusting an unexpired JWT', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'mutable@example.test', password: validPassword },
    });
    const accessToken = login.json<LoginResponse>().data.accessToken;
    const mutable = await prisma.user.findUniqueOrThrow({
      where: { email: 'mutable@example.test' },
    });

    await prisma.user.update({
      where: { id: mutable.id },
      data: { role: 'CLIENT_DEVELOPER' },
    });
    const changed = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: bearer(accessToken),
    });
    expect(changed.json<MeResponse>().data.role).toBe('CLIENT_DEVELOPER');

    await prisma.session.updateMany({
      where: { userId: mutable.id },
      data: { revokedAt: new Date(), revokeReason: 'TEST' },
    });
    const revoked = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: bearer(accessToken),
    });
    expect(revoked.statusCode).toBe(401);
    expect(revoked.json<ErrorResponse>().error.code).toBe('SESSION_EXPIRED');
  });

  it('forces a pending account to change its password before administrator access', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'pending-admin@example.test', password: 'Temporary-pass-2026' },
    });
    const token = login.json<LoginResponse>().data.accessToken;
    const pending = await prisma.user.findUniqueOrThrow({
      where: { email: 'pending-admin@example.test' },
    });
    await prisma.session.create({
      data: {
        userId: pending.id,
        tokenHash: 'f'.repeat(64),
        familyId: '22222222-2222-4222-8222-222222222222',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: bearer(token),
    });
    expect(me.statusCode).toBe(200);

    const blocked = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      headers: bearer(token),
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json<ErrorResponse>().error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const changed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: bearer(token),
      payload: {
        currentPassword: 'Temporary-pass-2026',
        newPassword: 'Permanent-pass-2026',
      },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.headers['cache-control']).toBe('no-store');

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: pending.id } });
    expect(updated.status).toBe('ACTIVE');
    await expect(passwords.verify(updated.passwordHash, 'Permanent-pass-2026')).resolves.toBe(true);
    await expect(
      prisma.session.count({ where: { userId: pending.id, revokedAt: null } }),
    ).resolves.toBe(1);
    await expect(
      prisma.securityAuditEvent.count({
        where: { actorUserId: pending.id, action: 'PASSWORD_CHANGED' },
      }),
    ).resolves.toBe(1);
  });
});
