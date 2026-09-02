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
  });
}
