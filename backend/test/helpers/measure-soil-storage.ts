import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import { execFileSync, spawnSync } from 'node:child_process';
import { createTestPrismaClient, prepareTestDatabase } from './database.js';
import { requireLocalMeasurementTarget } from './soil-measurement-target.js';
import { SoilReadingRepository } from '../../src/station-data/soil-reading.repository.js';
import { StoredHistoryRepository } from '../../src/station-data/stored-history.repository.js';
import {
  SOIL_FIELDS,
  parseSoilHistoryQuery,
} from '../../src/station-data/station-data.contracts.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { AuthorizedStation } from '../../src/station-data/station.repository.js';

if (process.env.RUN_F_DATA_MEASUREMENT !== '1')
  throw new Error('Explicit fixture measurement opt-in required');
const target = requireLocalMeasurementTarget(process.env.TEST_DATABASE_URL);
const boundPort = execFileSync('docker', ['port', 'integration-core-postgres-1', '5432/tcp'], {
  encoding: 'utf8',
  timeout: 5000,
  windowsHide: true,
});
if (boundPort.trim() !== '127.0.0.1:5432')
  throw new Error('Measurement dump target does not match the local database');
const prisma = createTestPrismaClient();
const repository = new SoilReadingRepository(prisma as PrismaService);
const history = new StoredHistoryRepository(prisma as PrismaService, repository);
const now = new Date();
const dayMs = 86_400_000;
const timed = async (work: () => Promise<unknown>, repetitions = 3) => {
  const samples: number[] = [];
  for (let i = 0; i < repetitions; i++) {
    const start = performance.now();
    await work();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const maximum = samples.at(-1);
  if (median === undefined || maximum === undefined) throw new Error('No timing samples');
  return {
    medianMs: Number(median.toFixed(1)),
    maxMs: Number(maximum.toFixed(1)),
  };
};
try {
  await prepareTestDatabase();
  const farm = await prisma.farm.create({ data: { name: 'F-data measurement fixture' } });
  const plot = await prisma.plot.create({ data: { name: 'Fixture', farmId: farm.id } });
  const stations: AuthorizedStation[] = [];
  for (const code of ['MEASURE01', 'MEASURE02']) {
    const row = await prisma.station.create({
      data: { plotId: plot.id, name: code, upstreamCode: code },
    });
    stations.push({ ...row, code, farmId: farm.id });
  }
  for (const days of [1, 7, 90]) {
    // Guarded disposable iot_test only; reclaim prior profile allocations for honest sizes.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "SoilReading"');
    const wal = await prisma.$queryRaw<{ lsn: string }[]>`SELECT pg_current_wal_lsn()::text AS lsn`;
    const walStart = wal[0];
    if (!walStart) throw new Error('Missing WAL sample');
    const insertTime = await timed(async () => {
      await prisma.$executeRaw`
        INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", "lastFetchedAt", origin)
        SELECT s."dataSourceId", s.id, f.field,
          ${now.toISOString()}::timestamptz - ${days} * interval '1 day' + n.i * interval '120 seconds',
          (n.i % 97)::double precision + 0.125,
          ${now.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz, 'rawHistory'
        FROM "Station" s CROSS JOIN unnest(${[...SOIL_FIELDS]}::text[]) AS f(field)
          CROSS JOIN generate_series(1, ${days * 720}) AS n(i)
        WHERE s.id = ANY(${stations.map((s) => s.id)}::uuid[])`;
    }, 1);
    await prisma.$executeRawUnsafe('ANALYZE "SoilReading"');
    const stats = await prisma.$queryRaw<
      {
        rows: bigint;
        tableBytes: bigint;
        indexBytes: bigint;
        totalBytes: bigint;
        walBytes: bigint;
      }[]
    >`
      SELECT (SELECT count(*) FROM "SoilReading") AS rows, pg_table_size('"SoilReading"') AS "tableBytes",
        pg_indexes_size('"SoilReading"') AS "indexBytes", pg_total_relation_size('"SoilReading"') AS "totalBytes",
        pg_wal_lsn_diff(pg_current_wal_lsn(), ${walStart.lsn}::pg_lsn)::bigint AS "walBytes"`;
    const statistic = stats[0];
    const station = stations[0];
    if (!statistic || !station) throw new Error('Missing measurement fixture/statistics');
    const params = {
      begin: new Date(now.getTime() - days * dayMs).toISOString(),
      end: now.toISOString(),
      fields: SOIL_FIELDS.join(','),
      limit: 100,
    };
    const rawQuery = parseSoilHistoryQuery({
      ...params,
      begin: new Date(now.getTime() - Math.min(days, 7) * dayMs).toISOString(),
    });
    const first = await history.getHistory(station, rawQuery);
    const continuation = first?.page.nextCursor;
    if (!continuation) throw new Error('Missing measurement continuation');
    const raw = await timed(() => history.getHistory(station, rawQuery));
    const cursor = await timed(() =>
      history.getHistory(station, { ...rawQuery, cursor: continuation }),
    );
    const aggregate = await timed(() =>
      history.getHistory(
        station,
        parseSoilHistoryQuery({ ...params, interval: '1h', aggregate: 'mean' }),
      ),
    );
    const ingestion = await timed(() =>
      repository.ingestLatest(station, {
        station,
        fetchedAt: new Date(now.getTime() + 1).toISOString(),
        fields: SOIL_FIELDS.map((field) => ({ field, value: 80, observedAt: now.toISOString() })),
      }),
    );
    const emptyRetentionScan = await timed(() => repository.prune(now));
    const countPlan = await prisma.$queryRawUnsafe(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT count(*) FROM "SoilReading" WHERE "stationId" = '${station.id}'::uuid`,
    );
    const dump = spawnSync(
      'docker',
      [
        'exec',
        'integration-core-postgres-1',
        'pg_dump',
        '-U',
        decodeURIComponent(target.username),
        '-d',
        'iot_test',
        '--format=custom',
      ],
      { encoding: null, maxBuffer: 256 * 1024 * 1024 },
    );
    if (dump.status !== 0) throw new Error(`Fixture dump failed: ${String(dump.status)}`);
    console.log(
      JSON.stringify({
        days,
        profile: '2 stations x 8 fields x 120s',
        insertedRows: String(statistic.rows),
        bytes: Object.fromEntries(
          Object.entries(statistic)
            .filter(([k]) => k !== 'rows')
            .map(([k, v]) => [k, String(v)]),
        ),
        dumpBytes: dump.stdout.length,
        timings: { insertTime, raw, cursor, aggregate, ingestion, emptyRetentionScan },
        stationCountPlan: countPlan,
      }),
    );
  }
} finally {
  await prisma.$disconnect();
}
