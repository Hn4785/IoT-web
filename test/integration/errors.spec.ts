import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app/create-app.js';
import type { RuntimeConfig } from '../../src/config/runtime-config.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('HTTP errors', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    app = await createApp({
      nodeEnv: 'test',
      port: 3000,
      logLevel: 'error',
      weatherApiBaseUrl: 'http://127.0.0.1:9999/api/v1',
      weatherApiKey: 'error-test-key',
      weatherApiTimeoutMs: 500,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('normalizes an unknown route and returns its request id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/missing',
      headers: { 'x-request-id': 'req-test-123' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['x-request-id']).toBe('req-test-123');
    expect(response.json()).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
      requestId: 'req-test-123',
    });
  });

  it.each([
    ['CR/LF characters', 'attacker\r\ninjected-header'],
    ['more than 128 characters', 'a'.repeat(129)],
  ])('replaces request ids containing %s', async (_case, requestId) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { 'x-request-id': requestId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toMatch(UUID_V4);
    expect(response.headers['x-request-id']).not.toBe(requestId);
  });

  it('hides unknown exception details from the response', async () => {
    await app.close();
    const throwingConfig: RuntimeConfig = {
      get nodeEnv(): RuntimeConfig['nodeEnv'] {
        throw new Error('secret-stack-marker');
      },
      port: 3000,
      logLevel: 'error',
      weatherApiBaseUrl: 'http://127.0.0.1:9999/api/v1',
      weatherApiKey: 'error-test-key',
      weatherApiTimeoutMs: 500,
    };
    app = await createApp(throwingConfig);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { 'x-request-id': 'req-error-500' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      requestId: 'req-error-500',
    });
    expect(response.body).not.toContain('secret-stack-marker');
  });
});
