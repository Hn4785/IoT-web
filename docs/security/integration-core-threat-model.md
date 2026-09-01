# Integration Core Threat Model

Status: Implemented controls under verification

Reviewed: 2026-09-01

## Scope

This document covers `integration-core`: runtime configuration, the public health
route, normalized HTTP errors, and the private Weather API client. Authentication,
authorization, public station data, persistence and alert workflows belong to
later modules in the [Capability Map](../../CAPABILITY-MAP.md).

## Assets

- Weather API key and upstream service origin.
- Integrity and availability of the backend process.
- Weather measurements received from the upstream service.
- Stable public health and error contracts consumed by Role 2.
- Request IDs used to correlate operational failures.

No user PII or business database is introduced by this module.

## Trust boundaries

1. Process environment to runtime configuration: every environment value is
   untrusted until the Zod configuration schema accepts and normalizes it.
2. Role 2 or other HTTP clients to the NestJS/Fastify server: paths, headers and
   request IDs cross an untrusted public boundary.
3. Backend to Weather API: the configured origin and server-only API key leave
   the process; every response and status from the upstream is untrusted.
4. Backend to operators: logs, OpenAPI and error envelopes must not disclose
   credentials, upstream bodies, causes or stack traces.

## STRIDE review

| Threat                 | Abuse case                                                                                | Implemented control                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Spoofing               | A caller attempts to impersonate an authorized station-data user.                         | No station-data route is public before `identity-access`; health is intentionally public.                                                   |
| Tampering              | A caller injects a host/path through station input, or upstream returns a forged payload. | Fixed configured origin, literal path union, `URLSearchParams`, hostile station validation and response schemas.                            |
| Repudiation            | A failing request cannot be correlated with server evidence.                              | Server-generated/validated request ID is returned in the normalized error envelope and logged without secrets.                              |
| Information disclosure | Weather API key, upstream error body, cause or stack reaches Role 2 or Swagger.           | Key is attached only to protected upstream calls; `AppError.toJSON` and HTTP filter expose safe fields only; OpenAPI documents health only. |
| Denial of service      | Upstream hangs, redirect loops, or callers flood the API.                                 | Bounded upstream timeout, redirect rejection, global rate limit and validated/bounded query collections.                                    |
| Elevation of privilege | UI hiding is mistaken for authorization.                                                  | Public station endpoints are explicitly deferred until server-side RBAC and station scope exist.                                            |

## Implemented controls

- Strict runtime schema; production Weather origin requires HTTPS.
- API key remains server-only and is never included in health or OpenAPI output.
- Security headers through Fastify Helmet.
- Global request rate limit with normalized `429 RATE_LIMITED` response.
- Weather calls use a fixed origin, literal paths, GET only, redirect rejection
  and explicit timeout.
- JSON parsing and every Weather response schema are validated at the external
  boundary; failures map to safe `AppError` values.
- `/docs` and `/docs-json` exist only in development/test and expose only
  `/api/v1/health`.
- One pinned pnpm lockfile and an explicit deny for optional Scarf telemetry.

## Residual risks and follow-up

- `integration-core` provides no user authentication by design. Do not expose
  station or farm resources until `identity-access` is implemented and reviewed.
- Global in-memory rate limiting is process-local; multi-instance deployment
  requires a shared limiter or an infrastructure-level limit in `operations`.
- Upstream availability and certificate validity remain external dependencies;
  later operations work must add metrics, alerts and runbooks.
- OpenAPI is a development aid, not an authorization boundary. The production
  gate must remain covered by integration tests.
- Dependency audit detects known advisories only; provenance and allowed build
  scripts still require review on every dependency change.

## Verification evidence

On 2026-09-01, `pnpm audit` reported no known vulnerabilities. The Task 9 and
Task 10 completion gates re-run audit, tests, type checking, lint, build, format
and secret scans before the module can be merged.
