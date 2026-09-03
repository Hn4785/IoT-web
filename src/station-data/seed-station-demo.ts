import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { fileURLToPath } from 'node:url';

import { Prisma, PrismaClient } from '../generated/prisma/client.js';

const CONFIRMATION_FLAG = '--confirm-demo-seed';
const CONFLICT_MESSAGE = 'Demo seed conflict; no records were changed';

export const DEMO_KEYS = Object.freeze({
  farmName: 'Farm Demo',
  plotName: 'Plot Demo',
  stations: Object.freeze([
    Object.freeze({ upstreamCode: 'NODE01', name: 'Station NODE01' }),
    Object.freeze({ upstreamCode: 'NODE02', name: 'Station NODE02' }),
  ]),
});

export interface DemoSeedRepository {
  findFarmsByName(name: string): Promise<readonly { id: string; name: string }[]>;
  createFarm(name: string): Promise<{ id: string; name: string }>;
  findPlot(
    farmId: string,
    name: string,
  ): Promise<{ id: string; farmId: string; name: string } | null>;
  createPlot(farmId: string, name: string): Promise<{ id: string; farmId: string; name: string }>;
  findStationByCode(code: string): Promise<{
    id: string;
    plotId: string;
    upstreamCode: string;
    name: string;
  } | null>;
  createStation(input: { plotId: string; upstreamCode: string; name: string }): Promise<unknown>;
}

export type DemoSeedResult = Readonly<{ created: number; existing: number }>;

export function assertDemoSeedTarget(
  databaseUrl: string,
  nodeEnv: string | undefined,
  args: readonly string[],
): void {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('Demo seed requires a valid DATABASE_URL');
  }

  if (
    nodeEnv === undefined ||
    nodeEnv === 'production' ||
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    url.pathname !== '/iot_dev' ||
    args.length !== 1 ||
    args[0] !== CONFIRMATION_FLAG
  ) {
    throw new Error(
      `Demo seed is allowed only for /iot_dev outside production with ${CONFIRMATION_FLAG}`,
    );
  }
}

export async function ensureDemoRecords(repository: DemoSeedRepository): Promise<DemoSeedResult> {
  let created = 0;
  let existing = 0;
  const farms = await repository.findFarmsByName(DEMO_KEYS.farmName);
  if (farms.length > 1) throw new Error(CONFLICT_MESSAGE);

  const farm = farms[0] ?? (await repository.createFarm(DEMO_KEYS.farmName));
  if (farms.length === 0) created += 1;
  else existing += 1;

  const foundPlot = await repository.findPlot(farm.id, DEMO_KEYS.plotName);
  const plot = foundPlot ?? (await repository.createPlot(farm.id, DEMO_KEYS.plotName));
  if (foundPlot) existing += 1;
  else created += 1;

  for (const expected of DEMO_KEYS.stations) {
    const station = await repository.findStationByCode(expected.upstreamCode);
    if (station) {
      if (station.plotId !== plot.id || station.name !== expected.name) {
        throw new Error(CONFLICT_MESSAGE);
      }
      existing += 1;
      continue;
    }
    await repository.createStation({ plotId: plot.id, ...expected });
    created += 1;
  }

  return { created, existing };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Demo seed requires DATABASE_URL');
  assertDemoSeedTarget(databaseUrl, process.env.NODE_ENV, process.argv.slice(2));

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRawUnsafe(
          "SELECT pg_advisory_xact_lock(hashtext('iot-demo-station-seed'))",
        );
        const repository: DemoSeedRepository = {
          findFarmsByName: (name) =>
            transaction.farm.findMany({ where: { name }, select: { id: true, name: true } }),
          createFarm: (name) =>
            transaction.farm.create({ data: { name }, select: { id: true, name: true } }),
          findPlot: (farmId, name) =>
            transaction.plot.findUnique({
              where: { farmId_name: { farmId, name } },
              select: { id: true, farmId: true, name: true },
            }),
          createPlot: (farmId, name) =>
            transaction.plot.create({
              data: { farmId, name },
              select: { id: true, farmId: true, name: true },
            }),
          findStationByCode: (upstreamCode) =>
            transaction.station.findUnique({
              where: { upstreamCode },
              select: { id: true, plotId: true, upstreamCode: true, name: true },
            }),
          createStation: (data) => transaction.station.create({ data, select: { id: true } }),
        };
        return ensureDemoRecords(repository);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    process.stdout.write(
      `Demo registry ready: ${String(result.created)} created, ${String(result.existing)} existing\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Demo seed failed';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
