import { describe, expect, it } from 'vitest';

import { assertBrowserAcceptanceGuard } from './browser-acceptance-server.js';

describe('browser acceptance launcher safety guard', () => {
  const env = {
    TEST_DATABASE_URL: 'postgresql://iot_test:test@localhost:5432/iot_test?schema=public',
    NODE_ENV: 'test',
    QA_FIXTURE_PASSWORD: 'super-secure-fixture-password-123',
  };
  const argv = ['node', 'server.ts', '--confirm-isolated-browser-fixture'];

  it.each([
    [
      'wrong protocol',
      { ...env, TEST_DATABASE_URL: 'https://t:t@localhost:5432/iot_test' },
      argv,
      /database/i,
    ],
    [
      'wrong schema',
      { ...env, TEST_DATABASE_URL: 'postgresql://t:t@localhost:5432/iot_test?schema=private' },
      argv,
      /schema/i,
    ],
    [
      'connection options',
      { ...env, TEST_DATABASE_URL: 'postgresql://t:t@localhost:5432/iot_test?options=unsafe' },
      argv,
      /options/i,
    ],
    ['production', { ...env, NODE_ENV: 'production' }, argv, /production/i],
    ['missing flag', env, ['node', 'server.ts'], /confirm-isolated-browser-fixture/i],
    ['missing TEST_DATABASE_URL', { ...env, TEST_DATABASE_URL: '' }, argv, /TEST_DATABASE_URL/i],
    [
      'remote host',
      { ...env, TEST_DATABASE_URL: 'postgresql://t:t@remote.test:5432/iot_test' },
      argv,
      /host/i,
    ],
    [
      'wrong database',
      { ...env, TEST_DATABASE_URL: 'postgresql://t:t@localhost:5432/iot_prod' },
      argv,
      /database/i,
    ],
    [
      'wrong port',
      { ...env, TEST_DATABASE_URL: 'postgresql://t:t@localhost:5433/iot_test' },
      argv,
      /port/i,
    ],
    ['missing password', { ...env, QA_FIXTURE_PASSWORD: '' }, argv, /QA_FIXTURE_PASSWORD/i],
    ['short password', { ...env, QA_FIXTURE_PASSWORD: 'short' }, argv, /QA_FIXTURE_PASSWORD/i],
  ])('rejects %s', (_, testEnv, testArgv, pattern) => {
    expect(() => {
      assertBrowserAcceptanceGuard(testEnv, testArgv);
    }).toThrow(pattern);
  });

  it.each([
    ['localhost', env],
    ['127.0.0.1', { ...env, TEST_DATABASE_URL: 'postgresql://t:t@127.0.0.1:5432/iot_test' }],
  ])('passes with valid %s', (_, testEnv) => {
    expect(() => {
      assertBrowserAcceptanceGuard(testEnv, argv);
    }).not.toThrow();
  });
});
