import 'dotenv/config';

import type { RuntimeConfig } from '../../src/config/runtime-config.js';

export function makeTestRuntimeConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    nodeEnv: 'test',
    port: 3000,
    logLevel: 'error',
    weatherApiBaseUrl: 'http://127.0.0.1:9999/api/v1',
    weatherApiKey: 'test-weather-key',
    weatherApiTimeoutMs: 500,
    databaseUrl:
      process.env.TEST_DATABASE_URL ??
      'postgresql://iot_test:test@localhost:5432/iot_test?schema=public',
    testDatabaseUrl:
      process.env.TEST_DATABASE_URL ??
      'postgresql://iot_test:test@localhost:5432/iot_test?schema=public',
    frontendOrigin: 'http://localhost:5173',
    jwtSecret: 'test-jwt-secret-with-at-least-32-characters',
    credentialPepper: 'different-test-pepper-with-32-characters',
    ...overrides,
  };
}
