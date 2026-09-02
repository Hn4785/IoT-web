import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../src/generated/prisma/client.js';

function testDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error('TEST_DATABASE_URL is required for database tests');
  }

  const url = new URL(value);
  if (url.pathname !== '/iot_test') {
    throw new Error('Refusing to run database tests outside the iot_test database');
  }

  return value;
}

export function createTestPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl() }),
  });
}

export async function prepareTestDatabase(): Promise<void> {
  const prisma = createTestPrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "SecurityAuditEvent", "ApiKeyStationScope", "ApiKey", "ClientStationGrant", "FarmMembership", "Station", "Plot", "Farm", "Session", "SystemAuthority", "User" CASCADE',
    );
  } finally {
    await prisma.$disconnect();
  }
}
