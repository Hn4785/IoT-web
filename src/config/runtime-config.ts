import { z } from 'zod';

const postgresUrl = z.url().superRefine((value, context) => {
  if (!['postgres:', 'postgresql:'].includes(new URL(value).protocol)) {
    context.addIssue({ code: 'custom', message: 'PostgreSQL URL is required' });
  }
});

function databaseTarget(value: string): string {
  const url = new URL(value);
  return `${url.host}${url.pathname}?schema=${url.searchParams.get('schema') ?? 'public'}`;
}

const frontendOrigin = z.url().transform((value, context) => {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    context.addIssue({ code: 'custom', message: 'An HTTP(S) origin is required' });
    return z.NEVER;
  }

  return url.origin;
});

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');
const stationCodes = z
  .string()
  .transform((value) => [
    ...new Set(
      value
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean),
    ),
  ])
  .pipe(z.array(z.string().regex(/^[A-Za-z0-9_-]{1,80}$/)).max(100));

const runtimeConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().min(1).max(65_535),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
    WEATHER_API_BASE_URL: z.url(),
    WEATHER_API_KEY: z.string().trim().min(1),
    WEATHER_API_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000),
    DATABASE_URL: postgresUrl,
    TEST_DATABASE_URL: postgresUrl,
    FRONTEND_ORIGIN: frontendOrigin,
    JWT_SECRET: z.string().min(32).max(4096),
    CREDENTIAL_PEPPER: z.string().min(32).max(4096),
    SOIL_LATEST_CACHE_TTL_MS: z.coerce.number().int().min(1).max(3_600_000),
    SOIL_HISTORY_CACHE_TTL_MS: z.coerce.number().int().min(1).max(3_600_000),
    SOIL_STALE_AFTER_MS: z.coerce.number().int().min(1).max(3_600_000),
    SOIL_STALE_IF_ERROR_MS: z.coerce.number().int().min(1).max(3_600_000),
    SOIL_CACHE_MAX_ENTRIES: z.coerce.number().int().min(1).max(10_000),
    ALERT_EVALUATION_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .max(3_600_000)
      .default(60_000),
    ALERT_EVALUATION_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),
    ALERT_EVALUATOR_LEASE_MS: z.coerce.number().int().min(1_000).max(3_599_999).default(55_000),
    ALERT_IDEMPOTENCY_RETENTION_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    ALERT_DEMO_METADATA_ENABLED: booleanString.default(false),
    ALERT_DEMO_STATION_CODES: stationCodes.default([]),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === 'production' &&
      new URL(value.WEATHER_API_BASE_URL).protocol !== 'https:'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['WEATHER_API_BASE_URL'],
        message: 'HTTPS is required in production',
      });
    }
    if (databaseTarget(value.DATABASE_URL) === databaseTarget(value.TEST_DATABASE_URL)) {
      context.addIssue({
        code: 'custom',
        path: ['TEST_DATABASE_URL'],
        message: 'Test database must be isolated',
      });
    }
    if (value.JWT_SECRET === value.CREDENTIAL_PEPPER) {
      context.addIssue({
        code: 'custom',
        path: ['CREDENTIAL_PEPPER'],
        message: 'Credential secrets must be distinct',
      });
    }
    if (value.ALERT_EVALUATOR_LEASE_MS >= value.ALERT_EVALUATION_INTERVAL_MS) {
      context.addIssue({
        code: 'custom',
        path: ['ALERT_EVALUATOR_LEASE_MS'],
        message: 'Alert evaluator lease must be shorter than its interval',
      });
    }
    if (value.NODE_ENV === 'production' && value.ALERT_DEMO_METADATA_ENABLED) {
      context.addIssue({
        code: 'custom',
        path: ['ALERT_DEMO_METADATA_ENABLED'],
        message: 'Demo alert metadata is forbidden in production',
      });
    }
  });

export type RuntimeConfig = Readonly<{
  nodeEnv: z.infer<typeof runtimeConfigSchema>['NODE_ENV'];
  port: number;
  logLevel: z.infer<typeof runtimeConfigSchema>['LOG_LEVEL'];
  weatherApiBaseUrl: string;
  weatherApiKey: string;
  weatherApiTimeoutMs: number;
  databaseUrl: string;
  testDatabaseUrl: string;
  frontendOrigin: string;
  jwtSecret: string;
  credentialPepper: string;
  soilLatestCacheTtlMs: number;
  soilHistoryCacheTtlMs: number;
  soilStaleAfterMs: number;
  soilStaleIfErrorMs: number;
  soilCacheMaxEntries: number;
  alertEvaluationIntervalMs: number;
  alertEvaluationBatchSize: number;
  alertEvaluatorLeaseMs: number;
  alertIdempotencyRetentionHours: number;
  alertDemoMetadataEnabled: boolean;
  alertDemoStationCodes: readonly string[];
}>;

export function parseRuntimeConfig(env: Record<string, string | undefined>): RuntimeConfig {
  const value = runtimeConfigSchema.parse(env);

  return Object.freeze({
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    logLevel: value.LOG_LEVEL,
    weatherApiBaseUrl: value.WEATHER_API_BASE_URL.replace(/\/$/, ''),
    weatherApiKey: value.WEATHER_API_KEY,
    weatherApiTimeoutMs: value.WEATHER_API_TIMEOUT_MS,
    databaseUrl: value.DATABASE_URL,
    testDatabaseUrl: value.TEST_DATABASE_URL,
    frontendOrigin: value.FRONTEND_ORIGIN,
    jwtSecret: value.JWT_SECRET,
    credentialPepper: value.CREDENTIAL_PEPPER,
    soilLatestCacheTtlMs: value.SOIL_LATEST_CACHE_TTL_MS,
    soilHistoryCacheTtlMs: value.SOIL_HISTORY_CACHE_TTL_MS,
    soilStaleAfterMs: value.SOIL_STALE_AFTER_MS,
    soilStaleIfErrorMs: value.SOIL_STALE_IF_ERROR_MS,
    soilCacheMaxEntries: value.SOIL_CACHE_MAX_ENTRIES,
    alertEvaluationIntervalMs: value.ALERT_EVALUATION_INTERVAL_MS,
    alertEvaluationBatchSize: value.ALERT_EVALUATION_BATCH_SIZE,
    alertEvaluatorLeaseMs: value.ALERT_EVALUATOR_LEASE_MS,
    alertIdempotencyRetentionHours: value.ALERT_IDEMPOTENCY_RETENTION_HOURS,
    alertDemoMetadataEnabled: value.ALERT_DEMO_METADATA_ENABLED,
    alertDemoStationCodes: Object.freeze(value.ALERT_DEMO_STATION_CODES),
  });
}
