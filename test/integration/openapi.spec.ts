import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app/create-app.js';
import { makeTestRuntimeConfig } from '../helpers/runtime-config.js';

describe('OpenAPI contract', () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('documents health, authentication and administrator provisioning without credentials', async () => {
    app = await createApp(
      makeTestRuntimeConfig({
        weatherApiKey: 'must-not-appear',
      }),
    );

    const response = await app.inject({ method: 'GET', url: '/docs-json' });

    expect(response.statusCode).toBe(200);
    const document = response.json<{ paths: Record<string, unknown> }>();
    expect(Object.keys(document.paths)).toEqual([
      '/api/v1/auth/login',
      '/api/v1/auth/me',
      '/api/v1/auth/change-password',
      '/api/v1/health',
      '/api/v1/admin/users',
      '/api/v1/admin/users/{userId}',
      '/api/v1/admin/users/{userId}/reset-password',
    ]);
    expect(response.body).not.toContain('WEATHER_API_KEY');
    expect(response.body).not.toContain('X-API-Key');
    expect(response.body).not.toContain('must-not-appear');
  });

  it('serves the interactive API documentation at /docs', async () => {
    app = await createApp(
      makeTestRuntimeConfig({
        nodeEnv: 'development',
        weatherApiKey: 'must-not-appear',
      }),
    );

    const response = await app.inject({ method: 'GET', url: '/docs' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).not.toContain('must-not-appear');
  });

  it.each(['/docs-json', '/docs'])(
    'does not expose %s in production',
    async (documentationPath) => {
      app = await createApp(
        makeTestRuntimeConfig({
          nodeEnv: 'production',
          weatherApiBaseUrl: 'https://weather.example/api/v1',
          weatherApiKey: 'must-not-appear',
        }),
      );

      const response = await app.inject({ method: 'GET', url: documentationPath });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
      expect(response.body).not.toContain('must-not-appear');
    },
  );
});
