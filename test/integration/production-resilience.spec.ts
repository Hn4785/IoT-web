import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app/create-app.js';
import { makeTestRuntimeConfig } from '../helpers/runtime-config.js';

type ErrorResponse = {
  success: false;
  error: { code: string; message: string };
  requestId: string;
};

describe('production-facing HTTP resilience', () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function freshApp(): Promise<NestFastifyApplication> {
    app = await createApp(makeTestRuntimeConfig());
    return app;
  }

  it.each([
    {
      name: 'malformed JSON',
      request: {
        method: 'POST' as const,
        url: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: '{"email":',
      },
      status: 400,
      code: 'VALIDATION_ERROR',
    },
    {
      name: 'unsupported content type',
      request: {
        method: 'POST' as const,
        url: '/api/v1/auth/login',
        headers: { 'content-type': 'text/plain' },
        payload: 'not-json',
      },
      status: 400,
      code: 'VALIDATION_ERROR',
    },
    {
      name: 'oversized request body',
      request: {
        method: 'POST' as const,
        url: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          email: 'body-marker@example.test',
          password: 'x'.repeat(1_100_000),
        }),
      },
      status: 413,
      code: 'VALIDATION_ERROR',
    },
  ])('normalizes $name without echoing hostile input', async ({ request, status, code }) => {
    const instance = await freshApp();
    const response = await instance.inject({
      ...request,
      headers: { ...request.headers, 'x-request-id': 'production-boundary' },
    });

    expect(response.statusCode).toBe(status);
    expect(response.headers['content-type']).toContain('application/json');
    const body = response.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(code);
    expect(body.error.message).toEqual(expect.any(String));
    expect(body.requestId).toBe('production-boundary');
    expect(response.body).not.toContain('body-marker@example.test');
    expect(response.body).not.toMatch(/node_modules|\.worktrees|SyntaxError/i);
  });

  it('allows only the configured browser origin in CORS preflight responses', async () => {
    const instance = await freshApp();
    const preflight = (origin: string) =>
      instance.inject({
        method: 'OPTIONS',
        url: '/api/v1/health',
        headers: {
          origin,
          'access-control-request-method': 'GET',
        },
      });

    const [allowed, denied] = await Promise.all([
      preflight('http://localhost:5173'),
      preflight('https://attacker.example'),
    ]);

    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(denied.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(denied.headers['access-control-allow-origin']).not.toBe('https://attacker.example');
    expect(denied.headers['access-control-allow-credentials']).toBe('true');
  });

  it.each([
    ['missing scheme', 'token'],
    ['wrong scheme casing', 'bearer token'],
    ['empty bearer', 'Bearer '],
    ['two bearer values', 'Bearer first, Bearer second'],
    ['oversized bearer', `Bearer ${'x'.repeat(4_097)}`],
  ])(
    'rejects %s without passing malformed credentials to the database',
    async (_name, authorization) => {
      const instance = await freshApp();
      const response = await instance.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json<ErrorResponse>().error.code).toMatch(/UNAUTHENTICATED|SESSION_EXPIRED/);
      expect(response.body).not.toContain(authorization);
    },
  );

  it('rejects duplicate API-key headers before credential lookup', async () => {
    const instance = await freshApp();
    const response = await instance.inject({
      method: 'GET',
      url: '/api/v1/client/stations',
      headers: { 'x-api-key': ['first', 'second'] },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json<ErrorResponse>().error.code).toBe('INVALID_API_KEY');
    expect(response.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('does not let HEAD bypass authentication on protected GET routes', async () => {
    const instance = await freshApp();
    const response = await instance.inject({ method: 'HEAD', url: '/api/v1/farms' });

    expect(response.statusCode).toBe(401);
    expect(response.body).toBe('');
  });

  it('keeps liveness available during a concurrent burst', async () => {
    const instance = await freshApp();
    const responses = await Promise.all(
      Array.from({ length: 120 }, (_, index) =>
        instance.inject({
          method: 'GET',
          url: '/api/v1/health',
          headers: { 'x-request-id': `burst-${index.toString()}` },
        }),
      ),
    );

    expect(responses.filter(({ statusCode }) => statusCode === 200)).toHaveLength(120);
    for (const response of responses) {
      expect(response.headers['x-request-id']).toMatch(/^burst-\d+$/);
      expect(response.statusCode).toBe(200);
    }
  });

  it('returns a safe 503 envelope when PostgreSQL cannot be reached', async () => {
    const config = makeTestRuntimeConfig({
      databaseUrl:
        'postgresql://iot_test:test@127.0.0.1:1/iot_test?schema=public&connect_timeout=1',
    });
    app = await createApp(config);
    const token = await new SignJWT({ sessionId: randomUUID() })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(randomUUID())
      .setIssuer('iot-api')
      .setAudience('iot-web')
      .setExpirationTime('1m')
      .sign(new TextEncoder().encode(config.jwtSecret));

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}`, 'x-request-id': 'database-down' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json<ErrorResponse>()).toEqual({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is temporarily unavailable',
      },
      requestId: 'database-down',
    });
    expect(response.body).not.toMatch(/127\.0\.0\.1|postgresql|ECONNREFUSED/i);
  });
});
