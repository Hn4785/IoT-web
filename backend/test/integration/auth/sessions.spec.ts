import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { PasswordService } from '../../../src/auth/password.service.js';
import { TokenHashService } from '../../../src/auth/token-hash.service.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const config = makeTestRuntimeConfig();
const prisma = createTestPrismaClient();
const passwords = new PasswordService();
const tokenHashes = new TokenHashService(config.credentialPepper);
const password = 'Valid-password-2026';

type AuthResponse = { data: { accessToken: string; expiresIn: number } };
type ErrorResponse = { error: { code: string } };

function cookiePair(setCookie: string | string[] | undefined): string {
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!value) throw new Error('Expected refresh cookie');
  return value.split(';', 1)[0] ?? '';
}

function refreshToken(cookie: string): string {
  const value = cookie.slice('refreshToken='.length);
  if (!value || value === cookie) throw new Error('Expected refresh token cookie');
  return decodeURIComponent(value);
}

async function login(
  app: NestFastifyApplication,
): Promise<{ cookie: string; accessToken: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'farmer@example.test', password },
  });
  expect(response.statusCode).toBe(200);
  return {
    cookie: cookiePair(response.headers['set-cookie']),
    accessToken: response.json<AuthResponse>().data.accessToken,
  };
}

async function refresh(app: NestFastifyApplication, cookie: string, origin?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    headers: {
      cookie,
      ...(origin ? { origin } : {}),
    },
  });
}

describe('refresh session lifecycle', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await prepareTestDatabase();
    await prisma.user.create({
      data: {
        email: 'farmer@example.test',
        displayName: 'Farmer',
        passwordHash: await passwords.hash(password),
        role: 'FARMER',
        status: 'ACTIVE',
      },
    });
    app = await createApp(config);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('requires the exact frontend Origin before accepting a refresh cookie', async () => {
    const { cookie } = await login(app);

    for (const origin of [undefined, 'https://attacker.example']) {
      const response = await refresh(app, cookie, origin);
      expect(response.statusCode).toBe(403);
      expect(response.json<ErrorResponse>().error.code).toBe('FORBIDDEN');
    }
  });

  it('rejects an oversized refresh cookie with a safe authentication error', async () => {
    const response = await refresh(app, `refreshToken=${'x'.repeat(5000)}`, config.frontendOrigin);

    expect(response.statusCode).toBe(401);
    expect(response.json<ErrorResponse>().error.code).toBe('SESSION_EXPIRED');
  });

  it('rotates the refresh cookie and issues a new access token', async () => {
    const { cookie } = await login(app);
    const response = await refresh(app, cookie, config.frontendOrigin);

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const replacement = cookiePair(response.headers['set-cookie']);
    expect(replacement).not.toBe(cookie);
    expect(replacement).toContain('refreshToken=');
    const refreshed = response.json<AuthResponse>().data;
    expect(typeof refreshed.accessToken).toBe('string');
    expect(refreshed.expiresIn).toBe(900);
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${refreshed.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
  });

  it('allows only one concurrent rotation of the same token', async () => {
    const { cookie } = await login(app);
    const responses = await Promise.all([
      refresh(app, cookie, config.frontendOrigin),
      refresh(app, cookie, config.frontendOrigin),
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 401]);
  });

  it('detects reuse of a replaced token and revokes its whole family', async () => {
    const { cookie } = await login(app);
    const originalHash = tokenHashes.hash(refreshToken(cookie));
    const original = await prisma.session.findUniqueOrThrow({ where: { tokenHash: originalHash } });
    const rotated = await refresh(app, cookie, config.frontendOrigin);
    expect(rotated.statusCode).toBe(200);

    const replay = await refresh(app, cookie, config.frontendOrigin);
    expect(replay.statusCode).toBe(401);
    expect(replay.json<ErrorResponse>().error.code).toBe('SESSION_REUSED');
    await expect(
      prisma.session.count({ where: { familyId: original.familyId, revokedAt: null } }),
    ).resolves.toBe(0);
    await expect(
      prisma.securityAuditEvent.count({
        where: {
          actorUserId: original.userId,
          action: 'SESSION_REUSE_DETECTED',
          targetId: original.id,
        },
      }),
    ).resolves.toBe(1);
  });

  it('logs out idempotently without revoking an unrelated session', async () => {
    const current = await login(app);
    const unrelated = await login(app);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: { cookie: current.cookie, origin: config.frontendOrigin },
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['set-cookie']).toContain('refreshToken=;');
    }

    const [currentMe, unrelatedMe] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${current.accessToken}` },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${unrelated.accessToken}` },
      }),
    ]);
    expect(currentMe.statusCode).toBe(401);
    expect(unrelatedMe.statusCode).toBe(200);

    const unrelatedSession = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: tokenHashes.hash(refreshToken(unrelated.cookie)) },
    });
    expect(unrelatedSession.revokedAt).toBeNull();
  });

  it('uses a Secure, HttpOnly, Strict cookie in production', async () => {
    const productionApp = await createApp(makeTestRuntimeConfig({ nodeEnv: 'production' }));
    try {
      const response = await productionApp.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'farmer@example.test', password },
      });
      const setCookie = response.headers['set-cookie'];
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
    } finally {
      await productionApp.close();
    }
  });
});
