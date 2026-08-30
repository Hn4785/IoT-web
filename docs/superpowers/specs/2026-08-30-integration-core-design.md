# Design Spec: `integration-core`

Date: 2026-08-30
Status: Awaiting user review
Initiative: IoT Soil Monitoring Backend

## Objective

`integration-core` establishes the secure, testable foundation of the Role 3
backend. It provides runtime configuration, a public health endpoint, a private
Weather API client, boundary validation, bounded network behavior, and one
normalized error model for later modules.

It does not expose station or telemetry data to the frontend. Those endpoints
belong to `station-data` and cannot become public until `identity-access`
provides authentication and station-level authorization.

## Success criteria

- The service starts only when required configuration is valid.
- `GET /api/v1/health` reports process health without authentication or secrets.
- Internal modules can call Weather API health, stations, latest, and history
  through a typed interface.
- Unexpected upstream data is rejected instead of trusted or forwarded.
- Network calls use explicit timeouts, reject redirects, and cannot use a
  caller-controlled upstream host.
- Failures map to stable, safe errors without stack traces or credentials.
- Every production behavior follows a verified red-green-refactor cycle.

## Technology decisions

- Node.js with strict TypeScript.
- NestJS with the Fastify HTTP adapter.
- pnpm with one committed lockfile and a pinned package-manager version.
- OpenAPI generated from public contracts.
- Runtime schema validation for environment, HTTP, and Weather API boundaries.
- PostgreSQL and Prisma are deferred until `identity-access`, the first module
  requiring durable state.
- API prefix: `/api/v1`.

Compatible stable dependency versions will be selected and locked at scaffold
time. Dependency install scripts remain disabled until their source is reviewed.

## Architecture

```text
HTTP request
    |
    v
NestJS with Fastify
    |-- HealthModule ---------> public health DTO
    |-- ConfigurationModule --> validated immutable configuration
    |-- WeatherClientModule --> private typed integration
    |       |
    |       v
    |   configured Weather API origin only
    |
    `-- ErrorModule ----------> normalized safe error response
```

### ConfigurationModule

Validate once at startup and expose typed, immutable values:

- `NODE_ENV`
- `PORT`
- `LOG_LEVEL`
- `WEATHER_API_BASE_URL`
- `WEATHER_API_KEY`
- `WEATHER_API_TIMEOUT_MS`

Production requires an HTTPS Weather API URL. Tests may use a controlled local
HTTP server. Request input cannot override the configured protocol or host.

### HealthModule

The public endpoint is a process liveness check. It does not expose environment
variables, upstream URLs, credentials, stack traces, hostnames, or database
details. External dependency readiness will be designed in `operations`; a
Weather API outage must not make process liveness flap.

### WeatherClientModule

The private contract for later modules is:

```ts
interface WeatherClient {
  getHealth(): Promise<WeatherHealth>;
  listStations(): Promise<readonly string[]>;
  getLatest(query: LatestWeatherQuery): Promise<readonly WeatherLatestStation[]>;
  getHistory(query: WeatherHistoryQuery): Promise<readonly WeatherHistoryStation[]>;
}
```

This contract represents validated upstream data, not frontend DTOs. Unit,
quality, sensor metadata, and authorization enrichment belong to `station-data`.

The client must:

- attach `X-API-Key` internally except for upstream `/health`;
- abort requests after an explicit timeout;
- reject redirects;
- build queries with URL APIs rather than string concatenation;
- validate the full upstream response envelope and nested data;
- never log the API key or complete sensitive headers;
- retain rate-limit metadata internally for later policies;
- return typed domain errors rather than raw transport errors.

## Public API contract

### `GET /api/v1/health`

Authentication: none.

HTTP 200 response:

```json
{
  "success": true,
  "data": {
    "service": "iot-api",
    "version": "0.1.0",
    "status": "healthy",
    "environment": "development",
    "time": "2026-08-30T10:30:15.123Z"
  }
}
```

### Error contract

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  },
  "requestId": "01J6M7D0N8Y6JQ7T2R4X9K3P5A"
}
```

- `code` is stable and machine-readable.
- `message` is safe and contains no stack trace, secret, or upstream body.
- Unknown exceptions map to HTTP 500 and `INTERNAL_ERROR`.
- Timeout maps internally to `UPSTREAM_TIMEOUT`.
- Invalid or unavailable upstream responses map to `UPSTREAM_UNAVAILABLE`.
- Validation details are returned only for client-controlled input and do not
  disclose upstream schemas or internal implementation.

## Weather query contracts

Latest supports optional allowlisted `station`, `type`, and `fields` lists.
`type` accepts only `weather`, `water`, and `soil`.

History supports `station`, `type`, `fields`, `begin`, `end`, `limit`, `order`,
`interval`, and `aggregate` according to Weather API v1.

- `limit` is an integer from 1 through 5000.
- `begin` and `end` are ISO 8601 UTC; when both exist, `begin <= end`.
- `order`, `interval`, and `aggregate` use explicit allowlists.
- Unknown input properties are rejected.
- Raw history records are sparse and may omit any field.
- Validation preserves sparse records and never invents or merges values.

## Threat model

Assets are the Weather API key, future application credentials, station-scoped
observation data, trustworthy health output, and diagnostic logs.

| Trust boundary | Abuse case | Required mitigation |
|---|---|---|
| Environment to process | Missing, malformed, or logged secret | Fail-fast validation and redacted logging |
| Browser to API | Oversized or malicious query | Schema validation, size limits, stable errors |
| API to Weather API | SSRF, hangs, redirects, secret leakage | Fixed origin, production HTTPS, timeout, redirect rejection, redaction |
| Weather API to API | Malformed or hostile JSON | Defensive parsing and complete schema validation |
| Exception to HTTP | Stack trace or implementation disclosure | Global safe mapper with request ID |
| Caller to health | Flooding | Bounded global rate limit before public deployment |

STRIDE priorities here are tampering, information disclosure, denial of service,
and spoofed upstream data. User spoofing and privilege escalation are addressed
by `identity-access` before business data endpoints are public.

## Test-driven development strategy

For every behavior:

1. Add one behavioral test.
2. Run it and verify the expected failure is caused by missing behavior.
3. Add the minimum production code needed to pass.
4. Run the focused test and the full suite.
5. Refactor only while all tests remain green.

Required test layers:

- Unit tests for environment, query, upstream response, and error schemas.
- HTTP integration tests for `/api/v1/health` and the global error envelope.
- Weather client contract tests against a controlled local HTTP server.
- Cases include header rules, query encoding, timeout, redirect rejection,
  sparse data, malformed JSON, invalid shapes, 401, 403, 429, and 500.
- Default tests never require the live Weather API or a real API key.

Tests assert observable behavior and module boundaries, not NestJS internals.

## Intended commands

These become executable after scaffold implementation:

```text
Install:    pnpm install --frozen-lockfile
Dev:        pnpm dev
Build:      pnpm build
Typecheck:  pnpm typecheck
Lint:       pnpm lint
Test:       pnpm test
Coverage:   pnpm test:coverage
Audit:      pnpm audit
```

## Project structure

```text
src/
  app/
  config/
  health/
  integrations/weather/
  common/errors/
  common/http/
test/
  integration/
  helpers/
docs/
  superpowers/specs/
tasks/
```

## Code style

- Strict TypeScript with no implicit `any` or unchecked boundary casts.
- Files and module ids use kebab-case; types/classes use PascalCase; fields and
  variables use camelCase.
- Prefer small pure schema/mapping functions and injected boundaries.
- Infer external TypeScript types from runtime schemas to prevent divergence.

Representative style:

```ts
export class WeatherClientService implements WeatherClient {
  constructor(
    private readonly config: WeatherConfiguration,
    private readonly transport: WeatherTransport,
  ) {}

  async listStations(): Promise<readonly string[]> {
    const response = await this.transport.get('/stations');
    return weatherStationsResponseSchema.parse(response).data;
  }
}
```

## Boundaries

### Always

- Validate all environment, HTTP, and upstream inputs at their boundaries.
- Observe a failing test before writing production behavior.
- Keep secrets in ignored environment files or deployment secret storage.
- Use safe structured errors and redacted logs.
- Keep the upstream host fixed by validated configuration.
- Run focused and complete verification before committing.

### Ask first

- Add or replace dependencies after the initial approved scaffold.
- Change authentication, CORS, rate limits, integrations, or API response shapes.
- Add persistence or change a database schema.
- Expose an endpoint without authentication.

### Never

- Commit secrets or real `.env` files.
- Put the Weather API key in frontend code, URLs, logs, or responses.
- Expose raw upstream responses or database/framework records.
- Disable TLS, validation, tests, or security headers for convenience.
- Accept a caller-supplied upstream base URL.
- Implement public station-data endpoints before authorization exists.

## Acceptance criteria

- Invalid required configuration prevents startup with a non-secret error.
- Health output matches the contract and contains no secret values.
- Weather requests use only the configured origin and correct API-key rule.
- Query validation rejects unsupported values and enforces history limits.
- Upstream envelopes and nested data are validated; sparse history stays sparse.
- Timeout, redirect, malformed data, rate-limit, authentication, and server
  failures map to typed safe errors.
- No production behavior exists without a test first observed failing.
- Build, typecheck, lint, tests, audit, and secret scan pass before completion.

## Explicitly deferred

- Login, token lifecycle, RBAC, and station authorization (`identity-access`).
- Public stations/latest/history and frontend DTOs (`station-data`).
- PostgreSQL/Prisma schemas (`identity-access` and later modules).
- Alerts and configuration lifecycle (`alert-config`).
- Production monitoring, backup, deployment, and SLOs (`operations`).

## Open questions

None block `integration-core`. Deployment origins, token strategy, user-data
retention, and database policy belong to the `identity-access` specification.
