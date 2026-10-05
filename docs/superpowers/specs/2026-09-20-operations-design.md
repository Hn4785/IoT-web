# Phase D Operations Design

Date: 2026-09-20

Status: D app/local revalidated 2026-10-05; receiving-team production gates remain open

Module id: `operations`

Scope decision (2026-10-05): the owner/team excludes MFA/SSO from this delivery.
They may add it later. This is a scope waiver, not an implemented security control.
Existing login, server-side authorization, secrets, audit and Super Admin recovery
remain required. Production host/domain and off-machine backup destination/owners
are still unspecified. Accepted backup objectives: RPO 24h, RTO 4h, 7 daily and
4 weekly copies; implementation and restore evidence must still satisfy them.
Final target clarified on the same date: a normal server-hosted website. Pi/local
is for development/team testing; its acceptance is not website release acceptance.
The receiving team owns deployment and actual production target acceptance. Codex
does not provision/configure their server. A deployment guide is a separate handoff.

## 1. Objective

Make the verified Phase A-C backend diagnosable, recoverable and reproducible
without weakening its authorization or secret boundaries. Phase D does not add
new farm, station, measurement or device-control behavior.

Success means operators can answer four questions with evidence:

1. Is the process alive and is this instance ready for traffic?
2. What security or administrative action happened, by whom and to what target?
3. Can the same build, migration and test gates be reproduced in CI?
4. Can data and credentials be restored or rotated after a failure?

## 2. Capability map and build order

| Module                | Responsibility                                              | Depends on           |
| --------------------- | ----------------------------------------------------------- | -------------------- |
| `operations-audit`    | Query safe, scoped security audit evidence                  | Phase A audit writes |
| `operations-signals`  | Structured logs, liveness, readiness and bounded metrics    | Runtime and database |
| `operations-delivery` | Reproducible image and CI quality gates                     | D1 approval          |
| `operations-recovery` | Migration, backup, restore, rotation and rollback rehearsal | Delivery baseline    |
| `operations-release`  | Staging E2E, load and security release evidence             | All prior modules    |

Build order:

```text
operations-audit + operations-signals -> D1
    -> operations-delivery -> operations-recovery -> operations-release
```

`operations-audit` and `operations-signals` may be implemented independently,
but neither is accepted until the shared D1 leakage and failure-injection review.

## 3. Approved behavior

### 3.1 Liveness and readiness

- `GET /api/v1/health` remains public liveness. It proves only that the process
  can serve HTTP and must not query PostgreSQL or an external provider.
- A separate readiness contract checks required local dependencies with bounded
  timeouts. Database failure makes the instance not ready without killing it.
- Weather and soil upstream outages are reported as degraded signals, not as a
  reason to fail application readiness; their routes already fail safely or use
  bounded stale data.
- Liveness and readiness never return URLs, credentials, stack traces, database
  names or raw dependency errors.

### 3.2 Persistent audit access

- Existing `SecurityAuditEvent` remains the append-only application record.
- Audit reads are cursor-paginated, newest first and restricted to the current
  Super Admin. Normal Admin, Farmer and Client Developer receive `403`.
- Filters are allowlisted (`action`, `targetType`, `result`, bounded time range);
  response metadata is projected through an explicit safe DTO rather than
  returning arbitrary stored JSON.
- Audit reads do not create audit rows. Security/admin mutations continue to
  record success or failure with request ID and actor when known.
- Database-role enforcement that denies audit update/delete is an OP-4 deployment
  control; application code must never expose update/delete audit routes.

### 3.3 Signals and metrics

- Application logs are structured and contain request ID, safe event name,
  bounded identifiers and error code. They never include tokens, cookies, API
  keys, passwords, authorization headers, connection strings or upstream bodies.
- Required counters cover HTTP outcomes, dependency failures, authentication
  failures, evaluator runs and notification delivery outcomes.
- Labels are finite and allowlisted. User IDs, request IDs, station IDs and raw
  paths are forbidden as metric labels.
- A metrics transport is not made Internet-public until the ingress/network
  boundary is approved. D1 may use an in-process registry in tests.

### 3.4 Delivery and recovery

- CI uses Node.js 24 and the pinned pnpm version with an immutable lockfile.
- Required gates are format, typecheck, lint, build, migrations, full tests,
  coverage, dependency audit, secret scan and image smoke test.
- PostgreSQL data remains outside the repository. No command may delete volumes
  as part of normal build, test or rollback.
- Backup/restore is accepted only after a restore into an isolated database and
  application-level verification. A successful backup command alone is not proof.
- Migration rollback favors forward fixes. Destructive reverse migration requires
  explicit approval and a verified backup.
- Secret rotation revokes or replaces affected sessions/credentials and must not
  print old or new secret values into logs or reports.

## 4. Failure model

The D1 and release gates must exercise at least:

- PostgreSQL unavailable, slow or restarted while the process remains alive;
- upstream timeout, invalid payload and temporary outage;
- two instances attempting evaluator work after lease expiry;
- concurrent audit-generating mutations and repeated idempotency keys;
- abrupt process termination during request handling;
- disk-full/backup failure represented by a controlled rehearsal;
- stale frontend session, revoked credentials and authorization changes;
- restore into a clean isolated target followed by role and data integrity checks.

The current process-local rate limiter is acceptable only for the local
single-instance baseline. Multi-instance deployment requires an approved gateway
limiter or shared store; the application must not guess proxy trust depth.

## 5. Project structure

```text
src/operations/                 audit query, readiness and signal boundaries
test/integration/operations/    authorization and failure-injection tests
docs/operations/                runbooks and rehearsal evidence
docker/                         runtime assets after D1 only
.github/workflows/              CI after D1 only
```

Reuse `AppError`, `PrismaService`, `CurrentPrincipal`, request IDs and existing
cursor conventions. Do not create a second error envelope, authorization model,
database client or configuration loader.

## 6. Code style example

Dependency health is represented as a small safe value, not a thrown raw error:

```ts
type DependencyState = Readonly<{
  status: 'ready' | 'degraded' | 'unavailable';
  checkedAt: string;
}>;
```

Controllers validate input and delegate. Services own policy and persistence.
Repository queries select only fields required by the response contract.

## 7. Testing strategy and commands

Every behavior change follows red-green-refactor. Database and concurrency tests
run against isolated `iot_test` with Vitest file parallelism disabled.

```powershell
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm build
pnpm db:status
pnpm audit --prod
git diff --check
```

D1 additionally requires deterministic failure-injection tests for database
readiness, log/DTO leakage and finite metric labels. OP-4 and OP-5 require dated
rehearsal evidence; unit tests cannot substitute for restore or staging evidence.

## 8. Boundaries

### Always

- Keep liveness independent from dependencies and readiness bounded.
- Re-check live role/status/authority before privileged audit reads.
- Sanitize structured logs, audit DTO metadata and failure responses.
- Preserve request IDs and current response envelopes.
- Record deferred production risks in the canonical backend issue ledger.

### Ask first

- Database schema or database-role changes.
- Redis, OpenTelemetry, Prometheus client or any new dependency.
- Reverse-proxy trust, public metrics exposure or multi-instance topology.
- RPO/RTO, backup destination, encryption key ownership and retention schedule.
- MFA/SSO provider and enrollment/recovery policy.

### Never

- Commit `.env`, credentials, backups or production data.
- Put readiness work into the public liveness handler.
- Use user-controlled or unbounded metric labels.
- Treat a generated backup as a successful restore.
- weaken auth, tests or audit guarantees to make a deployment gate pass.

## 9. Checkpoints

### D0 — baseline and scope

- Phase C full tests, coverage, build, lint, typecheck and migration status pass.
- This spec and its capability order are the Phase D source of truth.
- Known risks are mapped to a work package rather than silently accepted.

### D1 — audit and signals

- OP-1 and OP-2 contracts pass authorization, leakage and failure-injection tests.
- Liveness/readiness semantics and metric cardinality are reviewed before CI or
  container work begins.

### D — release

- D app/local: immutable build, static/regression/coverage/secret/dependency gates,
  guarded isolated restored-app acceptance and production-image smoke are verified
  in docs/checkpoints/2026-10-05-d-local.md. Local recovery keeps unrelated sessions
  and previous revocation evidence; no auth policy change or Pi DB mutation.
- D-production: the receiving team still supplies target staging, infrastructure,
  recovery/rotation, encrypted off-host backup and live-provider evidence. Remaining
  exceptions need named owners and explicit acceptance; local evidence is not a
  substitute for that gate or a `production-ready` claim.

## 10. Deferred deployment decisions

These do not block D0 or local OP-1/OP-2 implementation, but block the named gate:

- selected single-instance ingress/TLS/proxy topology and limiter policy — before
  that target's release; shared limiting is conditional on future multi-instance use;
- production metrics exposure and scraper network — before production target acceptance;
- RPO 24h, RTO 4h and 7 daily/4 weekly backups are accepted objectives; encrypted
  off-machine destination, key custodian, restore owner and target restore evidence
  remain required before production target acceptance;
- Super Admin recovery and credential-rotation evidence — before target release;
  MFA/SSO is excluded by the owner/team decision above;
- live CENTER/NODE hardware verification — before Phase B/C device claims.
