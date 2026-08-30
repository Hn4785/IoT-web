import { z } from 'zod';

const runtimeConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().min(1).max(65_535),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
    WEATHER_API_BASE_URL: z.url(),
    WEATHER_API_KEY: z.string().trim().min(1),
    WEATHER_API_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000),
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
  });

export type RuntimeConfig = Readonly<{
  nodeEnv: z.infer<typeof runtimeConfigSchema>['NODE_ENV'];
  port: number;
  logLevel: z.infer<typeof runtimeConfigSchema>['LOG_LEVEL'];
  weatherApiBaseUrl: string;
  weatherApiKey: string;
  weatherApiTimeoutMs: number;
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
  });
}
