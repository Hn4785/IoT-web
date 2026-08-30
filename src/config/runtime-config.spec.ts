import { describe, expect, it } from 'vitest';

import { parseRuntimeConfig } from './runtime-config.js';

describe('parseRuntimeConfig', () => {
  it('normalizes a complete development configuration', () => {
    expect(
      parseRuntimeConfig({
        NODE_ENV: 'development',
        PORT: '3100',
        LOG_LEVEL: 'info',
        WEATHER_API_BASE_URL: 'https://weather.example/api/v1/',
        WEATHER_API_KEY: 'local-test-key',
        WEATHER_API_TIMEOUT_MS: '2500',
      }),
    ).toEqual({
      nodeEnv: 'development',
      port: 3100,
      logLevel: 'info',
      weatherApiBaseUrl: 'https://weather.example/api/v1',
      weatherApiKey: 'local-test-key',
      weatherApiTimeoutMs: 2500,
    });
  });

  it.each([
    [
      'production HTTP',
      { NODE_ENV: 'production', WEATHER_API_BASE_URL: 'http://weather.example/api/v1' },
    ],
    ['blank key', { WEATHER_API_KEY: '   ' }],
    ['zero port', { PORT: '0' }],
    ['oversized timeout', { WEATHER_API_TIMEOUT_MS: '30001' }],
  ])('rejects %s', (_name, override) => {
    const valid = {
      NODE_ENV: 'development',
      PORT: '3000',
      LOG_LEVEL: 'info',
      WEATHER_API_BASE_URL: 'https://weather.example/api/v1',
      WEATHER_API_KEY: 'test-key',
      WEATHER_API_TIMEOUT_MS: '5000',
    };

    expect(() => parseRuntimeConfig({ ...valid, ...override })).toThrow();
  });
});
