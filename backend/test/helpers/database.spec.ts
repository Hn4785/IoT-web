import { afterEach, describe, expect, it } from 'vitest';

import { createTestPrismaClient } from './database.js';

const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL;

afterEach(() => {
  process.env.TEST_DATABASE_URL = originalTestDatabaseUrl;
});

describe('test database safety boundary', () => {
  it('refuses to create a test client for iot_dev', () => {
    process.env.TEST_DATABASE_URL = 'postgresql://test:test@localhost:5432/iot_dev?schema=public';

    expect(() => createTestPrismaClient()).toThrow(
      'Refusing to run database tests outside the iot_test database',
    );
  });
});
