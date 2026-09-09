import { describe, expect, it } from 'vitest';

import { parseRuntimeConfig } from './runtime-config.js';

const completeEnvironment = {
  NODE_ENV: 'development',
  PORT: '3100',
  LOG_LEVEL: 'info',
  WEATHER_API_BASE_URL: 'https://weather.example/api/v1/',
  WEATHER_API_KEY: 'local-test-key',
  WEATHER_API_TIMEOUT_MS: '2500',
  DATABASE_URL: 'postgresql://iot_app:local@localhost:5432/iot_dev?schema=public',
  TEST_DATABASE_URL: 'postgresql://iot_app:local@localhost:5432/iot_test?schema=public',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  JWT_SECRET: 'j'.repeat(32),
  CREDENTIAL_PEPPER: 'p'.repeat(32),
  SOIL_LATEST_CACHE_TTL_MS: '30000',
  SOIL_HISTORY_CACHE_TTL_MS: '300000',
  SOIL_STALE_AFTER_MS: '900000',
  SOIL_STALE_IF_ERROR_MS: '300000',
  SOIL_CACHE_MAX_ENTRIES: '500',
} as const;

describe('parseRuntimeConfig', () => {
  it('normalizes a complete development configuration', () => {
    expect(parseRuntimeConfig(completeEnvironment)).toEqual({
      nodeEnv: 'development',
      port: 3100,
      logLevel: 'info',
      weatherApiBaseUrl: 'https://weather.example/api/v1',
      weatherApiKey: 'local-test-key',
      weatherApiTimeoutMs: 2500,
      databaseUrl: completeEnvironment.DATABASE_URL,
      testDatabaseUrl: completeEnvironment.TEST_DATABASE_URL,
      frontendOrigin: completeEnvironment.FRONTEND_ORIGIN,
      jwtSecret: completeEnvironment.JWT_SECRET,
      credentialPepper: completeEnvironment.CREDENTIAL_PEPPER,
      soilLatestCacheTtlMs: 30_000,
      soilHistoryCacheTtlMs: 300_000,
      soilStaleAfterMs: 900_000,
      soilStaleIfErrorMs: 300_000,
      soilCacheMaxEntries: 500,
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
    ['same database', { TEST_DATABASE_URL: completeEnvironment.DATABASE_URL }],
    [
      'same database with different credentials',
      {
        TEST_DATABASE_URL:
          'postgresql://other_user:other_password@localhost:5432/iot_dev?schema=public',
      },
    ],
    ['short JWT secret', { JWT_SECRET: 'short' }],
    ['shared secrets', { CREDENTIAL_PEPPER: completeEnvironment.JWT_SECRET }],
    ['wildcard origin', { FRONTEND_ORIGIN: '*' }],
    ['zero soil latest cache TTL', { SOIL_LATEST_CACHE_TTL_MS: '0' }],
    ['negative soil latest cache TTL', { SOIL_LATEST_CACHE_TTL_MS: '-1' }],
    ['non-integer soil latest cache TTL', { SOIL_LATEST_CACHE_TTL_MS: '1.5' }],
    ['excessive soil latest cache TTL', { SOIL_LATEST_CACHE_TTL_MS: '3600001' }],
    ['excessive soil history cache TTL', { SOIL_HISTORY_CACHE_TTL_MS: '3600001' }],
    ['excessive soil stale-after', { SOIL_STALE_AFTER_MS: '3600001' }],
    ['excessive soil stale-if-error', { SOIL_STALE_IF_ERROR_MS: '3600001' }],
    ['zero soil cache max entries', { SOIL_CACHE_MAX_ENTRIES: '0' }],
    ['negative soil cache max entries', { SOIL_CACHE_MAX_ENTRIES: '-1' }],
    ['non-integer soil cache max entries', { SOIL_CACHE_MAX_ENTRIES: '10.5' }],
    ['excessive soil cache max entries', { SOIL_CACHE_MAX_ENTRIES: '10001' }],
  ])('rejects %s', (_name, override) => {
    expect(() => parseRuntimeConfig({ ...completeEnvironment, ...override })).toThrow();
  });
});
