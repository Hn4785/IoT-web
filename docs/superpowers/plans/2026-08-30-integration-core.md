# Integration Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure NestJS integration foundation with validated configuration, a public health contract, normalized errors, and a private Weather API client.

**Architecture:** A NestJS 12 application runs on Fastify 5. Configuration is validated once at startup; the Weather client accepts typed queries, calls only its configured upstream origin, validates every response, and returns typed safe failures. No station data is publicly exposed in this module.

**Tech Stack:** Node.js 24, TypeScript 6, pnpm 11, NestJS 12, Fastify 5, Zod 4, Vitest 4, ESLint 10, Prettier 3.

**Spec:** `docs/superpowers/specs/2026-08-30-integration-core-design.md`

## Global Constraints

- Node runtime is `>=24.19.0 <25`; package manager is exactly `pnpm@11.19.0`.
- API prefix is `/api/v1`; timestamps returned by this service are ISO 8601 UTC.
- Success envelope is `{ "success": true, "data": ... }`.
- Error envelope is `{ "success": false, "error": { "code": "...", "message": "..." }, "requestId": "..." }`.
- Validate environment, HTTP input, and Weather API output at their boundaries.
- Never commit secrets or expose/log `X-API-Key`.
- Weather requests use a validated configured origin, production HTTPS, explicit timeout, and redirect rejection.
- Public station endpoints remain out of scope until `identity-access` exists.
- Every production behavior is preceded by a test that is observed failing for the expected reason.
- Dependency releases must be at least 24 hours old. The optional Scarf telemetry postinstall is explicitly denied; no blanket script approval is allowed.

## File map

```text
package.json                         dependency and command boundary
pnpm-lock.yaml                       authoritative dependency resolution
pnpm-workspace.yaml                  release-age and build-script policy
.npmrc                              fail-closed install policy
.gitignore                          secret/build exclusions
.env.example                        non-secret runtime variable names
tsconfig.json                        strict shared TypeScript settings
tsconfig.build.json                  production build inputs
eslint.config.mjs                    lint policy
prettier.config.mjs                  formatting policy
vitest.config.ts                     unit/integration test discovery
src/main.ts                          process entrypoint only
src/app/create-app.ts                Nest/Fastify application factory
src/app/app.module.ts                root composition
src/config/runtime-config.ts         environment schema and immutable config
src/config/runtime-config.module.ts  global injection boundary for validated config
src/health/health.controller.ts      public liveness contract
src/health/health.module.ts           health composition
src/common/errors/app-error.ts        typed application failures
src/common/errors/http-error.filter.ts safe HTTP error mapping
src/common/http/request-id.ts         request correlation
src/integrations/weather/contracts.ts runtime query/response schemas
src/integrations/weather/weather-client.ts private integration interface
src/integrations/weather/weather-client.service.ts fetch implementation
src/integrations/weather/weather.module.ts dependency composition
test/helpers/upstream-server.ts       controlled real HTTP dependency
test/integration/*.spec.ts            consumer-visible HTTP behavior
```

---

### Task 1: Reproducible Tooling Boundary

**Files:**

- Create: `package.json`
- Create: `.npmrc`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `eslint.config.mjs`
- Create: `prettier.config.mjs`
- Create: `vitest.config.ts`
- Create: `test/tooling.spec.ts`
- Generate: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Node.js `>=24.19.0 <25`, pnpm `11.19.0`.
- Produces: deterministic `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm test:coverage` commands.

- [ ] **Step 1: Create the package manifest and fail-closed package policy**

```json
{
  "name": "iot-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24.19.0 <25" },
  "packageManager": "pnpm@11.19.0",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "nest start --watch",
    "start": "node dist/main.js",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "eslint . --max-warnings 0",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@fastify/helmet": "13.1.1",
    "@fastify/rate-limit": "11.2.0",
    "@fastify/static": "10.1.3",
    "@nestjs/common": "12.0.1",
    "@nestjs/core": "12.0.1",
    "@nestjs/platform-fastify": "12.0.1",
    "@nestjs/swagger": "12.0.1",
    "fastify": "5.12.1",
    "reflect-metadata": "0.2.2",
    "rxjs": "7.8.2",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@nestjs/cli": "12.0.0",
    "@nestjs/testing": "12.0.1",
    "@types/node": "24.13.3",
    "@vitest/coverage-v8": "4.1.11",
    "eslint": "10.9.1",
    "globals": "17.11.0",
    "prettier": "3.9.6",
    "typescript": "6.0.3",
    "typescript-eslint": "8.68.0",
    "vitest": "4.1.11"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
allowBuilds:
  '@scarf/scarf': false
minimumReleaseAge: 1440
minimumReleaseAgeStrict: true
```

`.npmrc`:

```ini
save-exact=true
strict-peer-dependencies=true
```

`.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.env
.env.local
.env.*.local
*.pem
*.key
*.log
```

`.env.example`:

```dotenv
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
WEATHER_API_BASE_URL=https://quantracgialai.metrostic.com/api/v1
WEATHER_API_KEY=replace-with-local-secret
WEATHER_API_TIMEOUT_MS=5000
```

- [ ] **Step 2: Create strict compiler, test, lint, and format configuration**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"]
}
```

```json
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "rootDir": "src" },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "test", "dist", "coverage"]
}
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
  },
});
```

```js
// eslint.config.mjs
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
);
```

```js
// prettier.config.mjs
export default { singleQuote: true, trailingComma: 'all', printWidth: 100 };
```

- [ ] **Step 3: Prove the test runner works without adding production behavior**

```ts
// test/tooling.spec.ts
import { describe, expect, it } from 'vitest';

describe('tooling', () => {
  it('executes TypeScript tests', () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 4: Install reproducibly and inspect the script boundary**

Run:

```powershell
pnpm install
pnpm ignored-builds
pnpm test test/tooling.spec.ts
pnpm typecheck
```

Expected: Scarf telemetry is explicitly denied, no unexpected build remains pending, the tooling test passes, and typecheck is clean.

- [ ] **Step 5: Commit the tooling boundary**

```powershell
git add package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc .gitignore .env.example tsconfig.json tsconfig.build.json eslint.config.mjs prettier.config.mjs vitest.config.ts test/tooling.spec.ts
git commit -m "chore: establish reproducible backend tooling"
```

---

### Task 2: Validated Runtime Configuration

**Files:**

- Create: `src/config/runtime-config.spec.ts`
- Create: `src/config/runtime-config.ts`

**Interfaces:**

- Consumes: a `NodeJS.ProcessEnv`-compatible record.
- Produces: `parseRuntimeConfig(env): RuntimeConfig`; `RuntimeConfig` has normalized `nodeEnv`, `port`, `logLevel`, `weatherApiBaseUrl`, `weatherApiKey`, and `weatherApiTimeoutMs`.

- [ ] **Step 1: RED — specify valid normalization**

```ts
import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig } from './runtime-config.js';

describe('parseRuntimeConfig', () => {
  it('normalizes a complete development configuration', () => {
    expect(
      parseRuntimeConfig({
        NODE_ENV: 'development',
        PORT: '3100',
        LOG_LEVEL: 'info',
        WEATHER_API_BASE_URL: 'https://weather.example/api/v1/',
        WEATHER_API_KEY: 'local-test-key',
        WEATHER_API_TIMEOUT_MS: '2500',
      }),
    ).toEqual({
      nodeEnv: 'development',
      port: 3100,
      logLevel: 'info',
      weatherApiBaseUrl: 'https://weather.example/api/v1',
      weatherApiKey: 'local-test-key',
      weatherApiTimeoutMs: 2500,
    });
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test src/config/runtime-config.spec.ts`

Expected: FAIL because `parseRuntimeConfig` does not exist.

- [ ] **Step 3: GREEN — implement the minimum schema**

```ts
import { z } from 'zod';

const runtimeConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  WEATHER_API_BASE_URL: z.url(),
  WEATHER_API_KEY: z.string().min(1),
  WEATHER_API_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000),
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
```

- [ ] **Step 4: Verify GREEN**

Run: `pnpm test src/config/runtime-config.spec.ts`

Expected: PASS.

- [ ] **Step 5: RED/GREEN — reject unsafe production configuration**

Add this table-driven test, run it RED, then add the refinement below:

```ts
it.each([
  [
    'production HTTP',
    { NODE_ENV: 'production', WEATHER_API_BASE_URL: 'http://weather.example/api/v1' },
  ],
  ['blank key', { WEATHER_API_KEY: '   ' }],
  ['zero port', { PORT: '0' }],
  ['oversized timeout', { WEATHER_API_TIMEOUT_MS: '30001' }],
])('rejects %s', (_name, override) => {
  const valid = {
    NODE_ENV: 'development',
    PORT: '3000',
    LOG_LEVEL: 'info',
    WEATHER_API_BASE_URL: 'https://weather.example/api/v1',
    WEATHER_API_KEY: 'test-key',
    WEATHER_API_TIMEOUT_MS: '5000',
  };
  expect(() => parseRuntimeConfig({ ...valid, ...override })).toThrow();
});
```

```ts
const runtimeConfigSchema = z
  .object({
    // fields from Step 3; WEATHER_API_KEY uses z.string().trim().min(1)
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
```

Run: `pnpm test src/config/runtime-config.spec.ts`

Expected: all five configuration behaviors PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/config/runtime-config.ts src/config/runtime-config.spec.ts
git commit -m "feat: validate runtime configuration"
```

---

### Task 3: Public Health Contract

**Files:**

- Create: `src/health/health.controller.ts`
- Create: `src/health/health.module.ts`
- Create: `src/app/app.module.ts`
- Create: `src/config/runtime-config.module.ts`
- Create: `src/app/create-app.ts`
- Create: `src/main.ts`
- Create: `test/integration/health.spec.ts`

**Interfaces:**

- Consumes: `RuntimeConfig` and package version `0.1.0`.
- Produces: `createApp(config): Promise<NestFastifyApplication>` and `GET /api/v1/health`.

- [ ] **Step 1: RED — specify health behavior through real HTTP injection**

```ts
import { afterEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/app/create-app.js';

describe('GET /api/v1/health', () => {
  let app: NestFastifyApplication | undefined;
  afterEach(async () => {
    await app?.close();
  });

  it('returns the stable liveness envelope without secret values', async () => {
    app = await createApp({
      nodeEnv: 'test',
      port: 3000,
      logLevel: 'error',
      weatherApiBaseUrl: 'http://127.0.0.1:9999/api/v1',
      weatherApiKey: 'must-not-appear',
      weatherApiTimeoutMs: 500,
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: { service: 'iot-api', version: '0.1.0', status: 'healthy', environment: 'test' },
    });
    expect(response.body).not.toContain('must-not-appear');
    expect(Number.isNaN(Date.parse(response.json().data.time))).toBe(false);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test test/integration/health.spec.ts`

Expected: FAIL because `createApp` does not exist.

- [ ] **Step 3: GREEN — build only the health path and composition root**

Apply these exact composition signatures; no file below `main.ts` reads `process.env`:

Controller response:

```ts
@Get()
getHealth() {
  return {
    success: true as const,
    data: {
      service: 'iot-api', version: '0.1.0', status: 'healthy' as const,
      environment: this.config.nodeEnv, time: new Date().toISOString(),
    },
  };
}
```

```ts
// src/config/runtime-config.module.ts
import { DynamicModule, Global, Module } from '@nestjs/common';
import type { RuntimeConfig } from './runtime-config.js';

export const RUNTIME_CONFIG = Symbol('RUNTIME_CONFIG');

@Global()
@Module({})
export class RuntimeConfigModule {
  static register(config: RuntimeConfig): DynamicModule {
    return {
      module: RuntimeConfigModule,
      providers: [{ provide: RUNTIME_CONFIG, useValue: config }],
      exports: [RUNTIME_CONFIG],
    };
  }
}
```

```ts
// src/app/app.module.ts
@Module({})
export class AppModule {
  static register(config: RuntimeConfig): DynamicModule {
    return { module: AppModule, imports: [RuntimeConfigModule.register(config), HealthModule] };
  }
}
```

```ts
// src/app/create-app.ts
export async function createApp(config: RuntimeConfig): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(config),
    new FastifyAdapter(),
    { logger: false },
  );
  app.setGlobalPrefix('api/v1');
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
```

```ts
// src/main.ts
const config = parseRuntimeConfig(process.env);
const app = await createApp(config);
await app.listen(config.port, '0.0.0.0');
```

- [ ] **Step 4: Verify GREEN and process startup**

Run:

```powershell
pnpm test test/integration/health.spec.ts
pnpm build
pnpm typecheck
```

Expected: PASS with no warnings; build emits `dist/main.js`.

- [ ] **Step 5: Commit**

```powershell
git add src/app src/health src/main.ts test/integration/health.spec.ts
git commit -m "feat: expose public health contract"
```

---

### Task 4: Safe Errors, Request IDs, and HTTP Hardening

**Files:**

- Create: `src/common/errors/app-error.ts`
- Create: `src/common/errors/http-error.filter.ts`
- Create: `src/common/http/request-id.ts`
- Modify: `src/app/create-app.ts`
- Create: `test/integration/errors.spec.ts`
- Create: `test/integration/security-headers.spec.ts`

**Interfaces:**

- Consumes: thrown `AppError` or unknown exception and optional inbound `x-request-id`.
- Produces: `AppError(code, statusCode, safeMessage, cause?)`; safe JSON errors; `x-request-id` response header; Helmet headers; bounded global rate limit.

- [ ] **Step 1: RED — specify a normalized 404 with correlation**

```ts
it('normalizes an unknown route and returns its request id', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/missing',
    headers: { 'x-request-id': 'req-test-123' },
  });
  expect(response.statusCode).toBe(404);
  expect(response.headers['x-request-id']).toBe('req-test-123');
  expect(response.json()).toEqual({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Resource not found' },
    requestId: 'req-test-123',
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test test/integration/errors.spec.ts`

Expected: FAIL because Nest's default 404 body is returned.

- [ ] **Step 3: GREEN — implement typed errors and the global filter**

```ts
export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    readonly statusCode: number,
    readonly safeMessage: string,
    options?: ErrorOptions,
  ) {
    super(safeMessage, options);
  }
}
```

Use the following request-ID functions and filter decision table. Register the
filter with `app.useGlobalFilters(new HttpErrorFilter())`:

```ts
// src/common/http/request-id.ts
import { randomUUID } from 'node:crypto';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function selectRequestId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}
```

```ts
// Fastify adapter and response hook in createApp
const adapter = new FastifyAdapter({
  genReqId: (request) => selectRequestId(request.headers['x-request-id']),
});
const app = await NestFactory.create<NestFastifyApplication>(AppModule.register(config), adapter, {
  logger: false,
});
app
  .getHttpAdapter()
  .getInstance()
  .addHook('onSend', (request, reply, payload, done) => {
    void reply.header('x-request-id', request.id);
    done(null, payload);
  });
```

```ts
// filter mapping body; use FastifyRequest/FastifyReply from fastify
const status =
  exception instanceof AppError
    ? exception.statusCode
    : exception instanceof HttpException
      ? exception.getStatus()
      : 500;
const code =
  exception instanceof AppError ? exception.code : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR';
const message =
  exception instanceof AppError
    ? exception.safeMessage
    : status === 404
      ? 'Resource not found'
      : 'An unexpected error occurred';
reply.status(status).send({ success: false, error: { code, message }, requestId: request.id });
```

Log only `{ requestId: request.id, code, status }`; never serialize headers,
`exception.message`, stack, cause, or response body for unknown failures.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm test test/integration/errors.spec.ts`

Expected: normalized 404 test PASS.

- [ ] **Step 5: RED/GREEN — reject malicious request IDs and hide unknown failures**

Add an integration-only controller that throws `new Error('secret-stack-marker')`.
Assert the response is HTTP 500/`INTERNAL_ERROR`, does not contain the marker,
and generates a UUID when `x-request-id` includes CR/LF or exceeds 128 characters.
Observe each test fail, then extend the hook/filter minimally.

- [ ] **Step 6: RED/GREEN — enforce headers and rate limiting**

```ts
it('sets baseline security headers', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['x-frame-options']).toBeDefined();
});
```

Register `@fastify/helmet` and `@fastify/rate-limit` in `createApp`. Configure a
finite default limit from an internal constant; do not add CORS in this module.
Add a focused test app with a limit of one request and assert the second request
is HTTP 429 with code `RATE_LIMITED`.

- [ ] **Step 7: Verify and commit**

```powershell
pnpm test test/integration/errors.spec.ts test/integration/security-headers.spec.ts
pnpm test
pnpm typecheck
git add src/common src/app/create-app.ts test/integration/errors.spec.ts test/integration/security-headers.spec.ts
git commit -m "feat: normalize and harden HTTP responses"
```

---

### Task 5: Weather Query and Response Contracts

**Files:**

- Create: `src/integrations/weather/contracts.spec.ts`
- Create: `src/integrations/weather/contracts.ts`

**Interfaces:**

- Consumes: unknown latest/history queries and unknown Weather API JSON.
- Produces: `parseLatestWeatherQuery`, `parseWeatherHistoryQuery`, `parseWeatherHealthResponse`, `parseWeatherStationsResponse`, `parseWeatherLatestResponse`, `parseWeatherHistoryResponse` plus inferred readonly types.

- [ ] **Step 1: RED — specify allowlisted latest queries**

```ts
it('accepts and normalizes a latest soil query', () => {
  expect(
    parseLatestWeatherQuery({
      station: ['CENTER', 'NODE01'],
      type: ['soil'],
      fields: ['moisture', 'ph'],
    }),
  ).toEqual({
    station: ['CENTER', 'NODE01'],
    type: ['soil'],
    fields: ['moisture', 'ph'],
  });
});

it.each([[{ type: ['unknown'] }], [{ station: [''] }], [{ fields: ['temperature', '<script>'] }]])(
  'rejects an unsafe latest query %#',
  (input) => {
    expect(() => parseLatestWeatherQuery(input)).toThrow();
  },
);
```

- [ ] **Step 2: Verify RED, then implement minimum latest schema**

Run: `pnpm test src/integrations/weather/contracts.spec.ts`

Expected: FAIL because parser is missing.

Use this exact schema shape and verify all literal cases pass:

```ts
const stationCode = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const fieldName = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/);
const measurement = z.enum(['weather', 'water', 'soil']);
const uniqueList = <T extends z.ZodType<string>>(item: T) =>
  z
    .array(item)
    .max(100)
    .refine((items) => new Set(items).size === items.length, 'duplicates are not allowed');
const latestWeatherQuerySchema = z.strictObject({
  station: uniqueList(stationCode).optional(),
  type: uniqueList(measurement).optional(),
  fields: uniqueList(fieldName).optional(),
});
export const parseLatestWeatherQuery = (input: unknown) => latestWeatherQuerySchema.parse(input);
```

- [ ] **Step 3: RED — specify history ranges and enums**

```ts
it('rejects history when begin is after end', () => {
  expect(() =>
    parseWeatherHistoryQuery({
      begin: '2026-08-31T00:00:00Z',
      end: '2026-08-30T00:00:00Z',
      limit: 100,
      order: 'asc',
      interval: 'raw',
      aggregate: 'mean',
    }),
  ).toThrow();
});
```

Add literal passing coverage for limits `1` and `5000`; failing coverage for
`0`, `5001`, non-UTC timestamps, unsupported interval, aggregate, and unknown
properties. Observe failure, then apply this strict refined schema:

```ts
const utcTimestamp = z
  .string()
  .refine(
    (value) => value.endsWith('Z') && !Number.isNaN(Date.parse(value)),
    'UTC timestamp required',
  );
const weatherHistoryQuerySchema = latestWeatherQuerySchema
  .extend({
    begin: utcTimestamp.optional(),
    end: utcTimestamp.optional(),
    limit: z.number().int().min(1).max(5000).default(100),
    order: z.enum(['asc', 'desc']).default('desc'),
    interval: z.enum(['raw', '1m', '5m', '10m', '30m', '1h', '6h', '1d', '1w']).default('raw'),
    aggregate: z.enum(['mean', 'min', 'max', 'first', 'last', 'sum', 'count']).default('mean'),
  })
  .strict()
  .refine(
    (value) => !value.begin || !value.end || Date.parse(value.begin) <= Date.parse(value.end),
    { path: ['begin'], message: 'begin must not be after end' },
  );
export const parseWeatherHistoryQuery = (input: unknown) => weatherHistoryQuerySchema.parse(input);
```

- [ ] **Step 4: RED — specify complete upstream envelopes and sparse records**

```ts
it('preserves a valid sparse raw history record', () => {
  const parsed = parseWeatherHistoryResponse({
    success: true,
    data: [
      {
        station: 'NODE01',
        history: { soil: [{ ts: 1784276746000, time: '2026-07-17T08:25:46Z', light: 28.958 }] },
      },
    ],
  });
  expect(parsed.data[0]?.history.soil?.[0]).toEqual({
    ts: 1784276746000,
    time: '2026-07-17T08:25:46Z',
    light: 28.958,
  });
});

it('rejects a successful latest envelope with a string timestamp', () => {
  expect(() =>
    parseWeatherLatestResponse({
      success: true,
      data: [
        {
          station: 'NODE01',
          latest: {
            soil: {
              ts: '1784882119021',
              time: '2026-07-24T08:35:19Z',
              _fieldTs: {},
              moisture: 43,
            },
          },
        },
      ],
    }),
  ).toThrow();
});
```

Implement the envelope family with these concrete shared schemas. A parser for
each endpoint calls the corresponding `.parse(input)` and returns its inferred type:

```ts
const timestampMs = z.number().int().nonnegative();
const dynamicValue = z.union([z.number(), z.string(), z.boolean(), z.null()]);
const fieldTimestamps = z.record(fieldName, timestampMs);
const latestMeasurement = z
  .object({
    ts: timestampMs,
    time: utcTimestamp,
    _fieldTs: fieldTimestamps,
  })
  .catchall(dynamicValue);
const historyRecord = z.object({ ts: timestampMs, time: utcTimestamp }).catchall(dynamicValue);
const latestByType = z.partialRecord(measurement, latestMeasurement);
const historyByType = z.partialRecord(measurement, z.array(historyRecord));
const successEnvelope = <T extends z.ZodType>(data: T) =>
  z.object({ success: z.literal(true), data }).strict();
const healthResponseSchema = successEnvelope(
  z
    .object({
      service: z.string(),
      version: z.string(),
      status: z.string(),
      environment: z.string(),
      ts: timestampMs,
      time: utcTimestamp,
    })
    .strict(),
);
const stationsResponseSchema = successEnvelope(z.array(stationCode));
const latestResponseSchema = successEnvelope(
  z.array(z.object({ station: stationCode, latest: latestByType }).strict()),
);
const historyResponseSchema = successEnvelope(
  z.array(z.object({ station: stationCode, history: historyByType }).strict()),
);
const failureResponseSchema = z
  .object({ success: z.literal(false), message: z.string().min(1) })
  .strict();

export type LatestWeatherQuery = z.infer<typeof latestWeatherQuerySchema>;
export type WeatherHistoryQuery = z.infer<typeof weatherHistoryQuerySchema>;
export type WeatherHealth = z.infer<typeof healthResponseSchema>['data'];
export type WeatherLatestStation = z.infer<typeof latestResponseSchema>['data'][number];
export type WeatherHistoryStation = z.infer<typeof historyResponseSchema>['data'][number];

export const parseWeatherHealthResponse = (input: unknown) => healthResponseSchema.parse(input);
export const parseWeatherStationsResponse = (input: unknown) => stationsResponseSchema.parse(input);
export const parseWeatherLatestResponse = (input: unknown) => latestResponseSchema.parse(input);
export const parseWeatherHistoryResponse = (input: unknown) => historyResponseSchema.parse(input);
export const parseWeatherFailureResponse = (input: unknown) => failureResponseSchema.parse(input);
```

Export parsers for all five schemas, including `failureResponseSchema`; never
allow a failure envelope to satisfy a success parser.

- [ ] **Step 5: Verify mutation coverage and commit**

Run:

```powershell
pnpm test src/integrations/weather/contracts.spec.ts
pnpm typecheck
git add src/integrations/weather/contracts.ts src/integrations/weather/contracts.spec.ts
git commit -m "feat: define Weather API boundary contracts"
```

Expected: changing limit bounds, accepting a new upstream type, or requiring all
raw fields would fail at least one named test.

---

### Task 6: Controlled Upstream Test Server

**Files:**

- Create: `test/helpers/upstream-server.ts`
- Create: `test/helpers/upstream-server.spec.ts`

**Interfaces:**

- Consumes: a sequence of explicit `UpstreamResponse` fixtures.
- Produces: `startUpstreamServer(responses): Promise<UpstreamServer>` with `baseUrl`, captured real requests, and `close()` owned by the test helper.

- [ ] **Step 1: RED — specify a real controllable HTTP boundary**

```ts
it('serves a literal fixture and captures the actual request', async () => {
  const server = await startUpstreamServer([{ status: 200, body: { success: true, data: [] } }]);
  try {
    const response = await fetch(`${server.baseUrl}/api/v1/stations`, {
      headers: { 'x-api-key': 'test-key' },
    });
    expect(await response.json()).toEqual({ success: true, data: [] });
    expect(server.requests).toEqual([
      {
        method: 'GET',
        path: '/api/v1/stations',
        headers: expect.objectContaining({ 'x-api-key': 'test-key' }),
      },
    ]);
  } finally {
    await server.close();
  }
});
```

- [ ] **Step 2: Verify RED, implement, and verify GREEN**

Run: `pnpm test test/helpers/upstream-server.spec.ts`

Expected RED: helper module missing. Implement with `node:http`, listen on
`127.0.0.1` and port `0`, capture method/path/headers, and keep cleanup only in
the test helper. Support literal JSON, raw body, response headers, delay, and
redirect fixtures. Re-run and expect PASS.

The helper contract is exact:

```ts
export interface UpstreamResponse {
  status: number;
  body?: unknown;
  rawBody?: string;
  headers?: Readonly<Record<string, string>>;
  delayMs?: number;
}
export interface CapturedRequest {
  method: string;
  path: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
}
export interface UpstreamServer {
  baseUrl: string;
  requests: CapturedRequest[];
  close(): Promise<void>;
}
export async function startUpstreamServer(
  responses: readonly UpstreamResponse[],
): Promise<UpstreamServer>;
```

Consume one response per request; if fixtures are exhausted, return HTTP 500
with raw body `unexpected request`. Delay with a test-helper timer, serialize
`body` with `JSON.stringify`, and use `server.close()` in the returned cleanup.

- [ ] **Step 3: Commit**

```powershell
git add test/helpers/upstream-server.ts test/helpers/upstream-server.spec.ts
git commit -m "test: add controlled Weather API server"
```

---

### Task 7: Private Weather Client Success Paths

**Files:**

- Create: `src/integrations/weather/weather-client.ts`
- Create: `src/integrations/weather/weather-client.service.spec.ts`
- Create: `src/integrations/weather/weather-client.service.ts`
- Create: `src/integrations/weather/weather.module.ts`

**Interfaces:**

- Consumes: `RuntimeConfig`, validated query inputs, controlled upstream HTTP.
- Produces: `WeatherClient` with `getHealth`, `listStations`, `getLatest`, and `getHistory`.

- [ ] **Step 1: RED — health omits API key while stations includes it**

```ts
it('uses the API key only for protected upstream endpoints', async () => {
  const upstream = await startUpstreamServer([
    {
      status: 200,
      body: {
        success: true,
        data: {
          service: 'weather-api',
          version: '1.0.0',
          status: 'healthy',
          environment: 'test',
          ts: 1784271234567,
          time: '2026-07-21T10:30:15.123Z',
        },
      },
    },
    { status: 200, body: { success: true, data: ['CENTER', 'NODE01'] } },
  ]);
  const client = makeClient(upstream.baseUrl, 'server-only-key');
  try {
    await client.getHealth();
    expect(await client.listStations()).toEqual(['CENTER', 'NODE01']);
    expect(upstream.requests[0]?.headers['x-api-key']).toBeUndefined();
    expect(upstream.requests[1]?.headers['x-api-key']).toBe('server-only-key');
  } finally {
    await upstream.close();
  }
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test src/integrations/weather/weather-client.service.spec.ts`

Expected: FAIL because Weather client files do not exist.

- [ ] **Step 3: GREEN — implement successful GET and validation path**

Implement `WeatherClientService` with constructor-injected `RuntimeConfig` and
global `fetch`. Do not expose a generic public `request(url)` method. The private
request primitive and public path mapping are:

```ts
export interface WeatherClient {
  getHealth(): Promise<WeatherHealth>;
  listStations(): Promise<readonly string[]>;
  getLatest(query: LatestWeatherQuery): Promise<readonly WeatherLatestStation[]>;
  getHistory(query: WeatherHistoryQuery): Promise<readonly WeatherHistoryStation[]>;
}

private async getJson(path: '/health' | '/stations' | '/data/latest' | '/data/history', query?: URLSearchParams): Promise<unknown> {
  const url = new URL(`${this.config.weatherApiBaseUrl}${path}`);
  if (query) url.search = query.toString();
  const headers = path === '/health' ? undefined : { 'x-api-key': this.config.weatherApiKey };
  const response = await fetch(url, {
    method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(this.config.weatherApiTimeoutMs),
  });
  if (!response.ok) throw mapUpstreamStatus(response.status);
  return response.json();
}

async listStations(): Promise<readonly string[]> {
  return parseWeatherStationsResponse(await this.getJson('/stations')).data;
}
```

Implement the other public methods with their matching literal path, query
builder, and Task 5 parser. The path union makes arbitrary hosts/paths impossible.

- [ ] **Step 4: RED/GREEN — query encoding is literal and host is fixed**

Add complete successful latest/history fixtures and assert captured paths exactly:

```text
/api/v1/data/latest?station=CENTER%2CNODE01&type=soil&fields=moisture%2Cph
/api/v1/data/history?station=NODE01&begin=2026-07-17T00%3A00%3A00Z&end=2026-07-18T00%3A00%3A00Z&limit=100&order=asc&interval=raw&aggregate=mean
```

Assert a station value containing `/`, `?`, or `https://` is rejected by the
query parser and therefore cannot influence the host. Observe failures before
adding URLSearchParams mapping.

- [ ] **Step 5: Verify all success paths and commit**

```powershell
pnpm test src/integrations/weather/weather-client.service.spec.ts
pnpm typecheck
git add src/integrations/weather test/helpers
git commit -m "feat: add validated Weather API client"
```

---

### Task 8: Weather Client Failure Controls

**Files:**

- Create: `src/common/errors/app-error.spec.ts`
- Modify: `src/integrations/weather/weather-client.service.spec.ts`
- Modify: `src/integrations/weather/weather-client.service.ts`
- Modify: `src/common/errors/app-error.ts`

**Interfaces:**

- Consumes: upstream timeout, redirect, malformed body, invalid schema, and non-2xx responses.
- Produces: safe `AppError` values using `UPSTREAM_TIMEOUT`, `UPSTREAM_UNAVAILABLE`, or `RATE_LIMITED`; no upstream body or API key in public fields.

- [x] **Step 1: RED — timeout aborts the dependency call**

```ts
it('maps an upstream timeout without exposing the API key', async () => {
  const upstream = await startUpstreamServer([
    { status: 200, delayMs: 250, body: { success: true, data: [] } },
  ]);
  const client = makeClient(upstream.baseUrl, 'never-leak-this-key', 25);
  try {
    await expect(client.listStations()).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
      statusCode: 504,
      safeMessage: 'Weather service timed out',
    });
  } finally {
    await upstream.close();
  }
});
```

- [x] **Step 2: Verify RED, implement AbortSignal timeout, verify GREEN**

Run: `pnpm test src/integrations/weather/weather-client.service.spec.ts -t timeout`

Expected RED: request completes instead of timing out. Use `AbortSignal.timeout`
or a controller whose timer is cleared in `finally`; map only the recognized
abort error to HTTP 504. Re-run and expect PASS.

```ts
function mapTransportError(error: unknown): AppError {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return new AppError('UPSTREAM_TIMEOUT', 504, 'Weather service timed out');
  }
  return new AppError('UPSTREAM_UNAVAILABLE', 502, 'Weather service is unavailable');
}
```

Wrap `fetch` and JSON/schema parsing in separate `try` blocks so an HTTP status,
timeout, malformed JSON, and invalid schema reach the deliberate mapping branch.

- [x] **Step 3: RED/GREEN — reject redirects and malformed payloads**

Add independent fixtures for HTTP 302, invalid JSON, `{ success: true, data: 7 }`,
and a success envelope missing required timestamps. Assert every case rejects as
`UPSTREAM_UNAVAILABLE`/502 and that `JSON.stringify(error)` contains neither the
API key nor raw upstream body. Observe each failure before adding mapping.

Use `new AppError(..., { cause: error })` only internally. Define `AppError.toJSON`
to return `{ code, statusCode, safeMessage }`; it must omit `stack` and `cause`.

- [x] **Step 4: RED/GREEN — map upstream HTTP statuses predictably**

Use literal upstream failure envelopes and assert:

| Upstream status | Internal code          | HTTP status |
| --------------- | ---------------------- | ----------- |
| 401 or 403      | `UPSTREAM_UNAVAILABLE` | 502         |
| 429             | `RATE_LIMITED`         | 503         |
| 500             | `UPSTREAM_UNAVAILABLE` | 502         |

```ts
function mapUpstreamStatus(status: number): AppError {
  if (status === 429)
    return new AppError('RATE_LIMITED', 503, 'Weather service rate limit exceeded');
  return new AppError('UPSTREAM_UNAVAILABLE', 502, 'Weather service is unavailable');
}
```

Capture `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` in
an internal metadata type on successful protected calls, but never include
headers or credentials in thrown safe messages.

- [x] **Step 5: Run the failure suite and commit**

```powershell
pnpm test src/integrations/weather/weather-client.service.spec.ts
pnpm test
pnpm typecheck
git add src/integrations/weather/weather-client.service.ts src/integrations/weather/weather-client.service.spec.ts src/common/errors/app-error.ts
git commit -m "feat: bound and sanitize Weather API failures"
```

---

### Task 9: OpenAPI Contract and Operator Documentation

**Files:**

- Modify: `src/health/health.controller.ts`
- Modify: `src/app/create-app.ts`
- Modify: `test/integration/errors.spec.ts`
- Create: `test/integration/openapi.spec.ts`
- Create: `README.md`
- Create: `docs/security/integration-core-threat-model.md`

**Interfaces:**

- Consumes: approved health and error contracts.
- Produces: `/docs-json` in non-production, documented local commands, environment guidance, and a maintained threat-model checklist.

- [x] **Step 1: RED — OpenAPI exposes only the approved public business path**

```ts
it('documents the health contract without Weather credentials', async () => {
  const response = await app.inject({ method: 'GET', url: '/docs-json' });
  expect(response.statusCode).toBe(200);
  const document = response.json();
  expect(Object.keys(document.paths)).toEqual(['/api/v1/health']);
  expect(response.body).not.toContain('WEATHER_API_KEY');
  expect(response.body).not.toContain('X-API-Key');
});
```

- [x] **Step 2: Verify RED, generate OpenAPI, verify GREEN**

Run: `pnpm test test/integration/openapi.spec.ts`

Expected RED: `/docs-json` returns 404. Add explicit Swagger response models and
generate docs only when `nodeEnv !== 'production'`. Keep the UI at `/docs` and
JSON at `/docs-json`; do not document the private Weather client.

- [x] **Step 3: RED/GREEN — production does not expose documentation**

Create the app with `nodeEnv: 'production'` and an HTTPS upstream. Assert
`GET /docs-json` returns the normalized 404. Observe failure before gating
Swagger setup by environment.

- [x] **Step 4: Write operator documentation from verified commands**

README must contain:

- module scope and explicit deferred capabilities;
- copy `.env.example` to an ignored `.env` and replace the placeholder locally;
- install/dev/build/test/typecheck/lint/audit commands;
- health curl example and exact success envelope;
- statement that Weather credentials are server-only;
- link to the approved spec, capability map, and threat model.

Threat-model document must record the assets, boundaries, STRIDE review,
implemented controls, residual risks, and the date/status of package audit.

- [x] **Step 5: Verify docs behavior and commit**

```powershell
pnpm test test/integration/openapi.spec.ts
pnpm format:check
git add src/health/health.controller.ts src/app/create-app.ts test/integration/openapi.spec.ts README.md docs/security/integration-core-threat-model.md
git commit -m "docs: publish integration-core contract"
```

---

### Task 10: Integration-Core Completion Gate

**Files:**

- Modify only if verification finds an evidenced defect: files owned by Tasks 1-9.
- Modify: `docs/superpowers/specs/2026-08-30-integration-core-design.md` status after every gate passes.

**Interfaces:**

- Consumes: complete integration-core implementation.
- Produces: reproducible verification evidence and an approved module ready for `identity-access` specification.

- [x] **Step 1: Run the complete verification suite**

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:coverage
pnpm audit
git diff --check
```

Expected: every command exits 0 with no warnings treated as ignorable. Coverage
must include all validation/error branches named in the spec; do not add tests
that assert trivial framework or source-text behavior solely to raise a number.

- [x] **Step 2: Perform security evidence checks**

```powershell
git grep -n -i -E "(password|secret|api[_-]?key|token)" -- . ":(exclude)pnpm-lock.yaml"
git log -p --all | Select-String -Pattern '(?i)(weather_api_key\s*=|x-api-key\s*:\s*[A-Za-z0-9])'
pnpm ignored-builds
```

Review every match as documentation, placeholder, or real secret. If a real
secret is found, stop, rotate it, remove it from history, and rerun the scan.
Confirm no unexpected build script is pending, Scarf telemetry remains explicitly
denied, and audit has no unmitigated reachable critical/high advisory. Never use
forced audit fixes.

- [x] **Step 3: Run an adversarial contract review**

Check these mutations against existing tests:

- remove HTTPS production enforcement;
- change maximum history limit from 5000 to 5001;
- forward a caller-supplied upstream host;
- attach `X-API-Key` to `/health`;
- accept a string `ts` from Weather API;
- stop aborting timed-out requests;
- include an exception message in the HTTP 500 response.

Each mutation must have a named test that would fail. Add a failing regression
test before fixing any uncovered behavior.

- [x] **Step 4: Review implementation against all three requested skills**

API review: typed inputs/outputs, stable errors, consistent naming, validated
boundaries, no public implementation leakage.

Security review: threat boundaries, secret redaction, fixed upstream origin,
timeouts, redirect rejection, security headers, rate limiting, dependency audit.

TDD review: every production behavior has a test that was observed failing for
the correct missing behavior; tests exercise real HTTP behavior or the real
local upstream boundary.

- [x] **Step 5: Mark the spec implemented and commit the completion evidence**

Change spec status from `Approved by user` to `Implemented and verified` only
after Steps 1-4 pass.

```powershell
git add docs/superpowers/specs/2026-08-30-integration-core-design.md
git commit -m "docs: record integration-core verification"
git status --short --branch
```

Expected: clean `codex/integration-core` worktree. Integration into the base branch
is a separate user decision. The next implementation action is to brainstorm and
approve `identity-access`; do not expose station data as a shortcut.
