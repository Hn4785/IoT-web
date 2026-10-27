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
      'TRUNCATE TABLE "EvaluatorLease", "IdempotencyClaim", "InAppNotification", "AlertLifecycleEvent", "Alert", "AlertEvaluationState", "AlertRule", "SecurityAuditEvent", "ApiKeyStationScope", "ApiKey", "ClientStationGrant", "DataSourceGrantStation", "DataSourceGrant", "FarmMembership", "Station", "DataSource", "Plot", "Farm", "Session", "SystemAuthority", "User" CASCADE',
    );
    await prisma.dataSource.create({
      data: {
        id: '00000000-0000-0000-0000-000000000001',
        kind: 'SYSTEM',
        name: 'System Weather Source',
        baseUrl: 'runtime://weather',
        connectionStatus: 'CONNECTED',
        lastCheckedAt: new Date(),
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
