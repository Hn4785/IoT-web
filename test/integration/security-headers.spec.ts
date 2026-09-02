import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app/create-app.js';
import { makeTestRuntimeConfig } from '../helpers/runtime-config.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type RateLimitedBody = {
  success: false;
  error: { code: 'RATE_LIMITED'; message: string };
  requestId: string;
};

describe('HTTP hardening', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    app = await createApp(
      makeTestRuntimeConfig({
        weatherApiKey: 'security-test-key',
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('sets baseline security headers', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
  });

  it('returns the safe error envelope when the global request limit is exceeded', async () => {
    let response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    for (let requestNumber = 2; requestNumber <= 101; requestNumber += 1) {
      response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    }

    const body = response.json<RateLimitedBody>();

    expect(response.statusCode).toBe(429);
    expect(body).toEqual({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      requestId: body.requestId,
    });
    expect(body.requestId).toMatch(UUID_V4);
    expect(response.headers['x-request-id']).toBe(body.requestId);
  });
});
