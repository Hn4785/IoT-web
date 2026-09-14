# Phase C implementation plan — alerts and in-app notifications

Date: 2026-09-14
Status: Proposed for approval
Spec: `docs/superpowers/specs/2026-09-02-alert-config-design.md`

## Delivery boundary

Phase C consumes the sample-verified Phase B internal API. Local development may
use explicitly enabled demo metadata and the controlled fake Weather upstream.
Production must reject demo metadata, and real rule activation remains blocked
until Checkpoint B-device confirms units and metadata revisions.

No email, SMS, push provider, device publishing, MQTT ingestion or arbitrary
rule expression belongs to this plan.

## Dependency order

```text
demo/runtime boundary
  -> persistence invariants
  -> rule contracts and scoped API
  -> evaluator and alert lifecycle
  -> Checkpoint C1
  -> notification inbox
  -> capability endpoint and C-core gate
```

## Tasks

### Task C0 — Safe demo metadata boundary

Add bounded runtime settings and a metadata provider that confirms only the
configured seed station codes in development/test. Revisions use `demo:` and
production fails configuration validation when demo mode is enabled.

- Acceptance: production cannot start with demo metadata enabled.
- Acceptance: an unlisted station stays unconfirmed; an allowlisted demo station
  receives deterministic metadata with a `demo:` revision.
- Verify: focused runtime-config and provider tests, then typecheck.
- Dependencies: sample-verified Phase B metadata interface.
- Likely files: runtime config, example environment, metadata provider and their tests.

### Task C1 — Persistence invariants and migration

Add the minimum Phase C records for rules, evaluation state, alerts, immutable
lifecycle events, notifications, idempotency claims and evaluator lease. Enforce
one enabled rule per station/field and one unresolved alert per rule atomically.

- Acceptance: database constraints reject duplicate active rules, unresolved
  alerts, lifecycle recipients and idempotency keys.
- Acceptance: timestamps and numeric thresholds use the approved PostgreSQL types.
- Verify: migration against isolated `iot_test`, Prisma generation and database
  invariant tests.
- Dependencies: C0 confirms how demo metadata is represented without changing Station.
- Likely files: Prisma schema, one migration, generated client and one integration test.

### Checkpoint C-foundation

- C0 and C1 focused tests pass.
- Migration status is clean against `iot_test`.
- Diff contains no production path that can enable demo metadata.

### Task C2 — Rule contracts and pure validation

Define Zod input/query schemas, DTO projections, conditions, revision semantics,
cursor binding and OpenAPI schemas without exposing database rows.

- Acceptance: invalid numbers, ranges, fields, cursors, extra properties and
  stale revisions fail with the approved normalized errors.
- Acceptance: public DTOs match the approved Phase C spec exactly.
- Verify: contract unit tests and OpenAPI snapshot/path tests.
- Dependencies: C1 persistence names and invariants.
- Likely files: alert contracts, cursor helper and their tests.

### Task C3 — Scoped alert-rule API

Implement list/create/get/update as a vertical HTTP slice. Admin uses registry
scope; Farmer uses current farm membership; Client Developer is denied. POST
uses atomic idempotency, while PATCH uses optimistic revision reconciliation.

- Acceptance: unknown and cross-scope IDs are indistinguishable 404 responses.
- Acceptance: create/enable requires matching confirmed metadata and one active
  rule per station/field.
- Acceptance: disabling preserves evidence and follows the lifecycle contract.
- Verify: real HTTP/database integration tests for roles, races and retries.
- Dependencies: C0–C2.
- Likely files: rule repository, service, controller, module and integration test.

### Task C4 — Pure evaluator and durable progress

Implement the decision function separately from I/O, then persist last processed
observation and consecutive counters. Equal/older, missing, invalid, stale and
stale-if-error samples never advance state.

- Acceptance: two distinct breaches open; two distinct normal samples recover.
- Acceptance: restart preserves progress and the same observation never counts twice.
- Verify: table-driven unit tests plus persistence integration tests.
- Dependencies: C1–C2 and the Phase B latest-soil boundary.
- Likely files: evaluator types/function, evaluation repository and tests.

### Checkpoint C-rules

- C2–C4 focused tests pass.
- Rule authorization, idempotency and evaluator state transitions receive a
  focused code review before lifecycle HTTP actions are added.

### Task C5 — Scheduler lease and failure isolation

Add the 60-second evaluator orchestration with injected clock, PostgreSQL lease,
bounded deterministic batches and per-station failure isolation. Tests invoke it
directly and never sleep.

- Acceptance: only the lease holder evaluates and a failed station does not stop
  other stations.
- Acceptance: duplicate workers cannot create duplicate alert transitions.
- Verify: deterministic concurrency and failure-injection tests.
- Dependencies: C4.
- Likely files: scheduler, lease repository, module wiring and tests.

### Task C6 — Acknowledge and resolve lifecycle

Add alert list/detail, acknowledge and manual-resolution routes. Transitions,
immutable lifecycle event creation and idempotency result storage happen in one
transaction.

- Acceptance: acknowledge is idempotent; manual resolve is rejected while the
  latest distinct observation remains breached or unknown.
- Acceptance: automatic recovery, disable and metadata-change reasons are exact.
- Verify: state-table, concurrent-request and HTTP authorization tests.
- Dependencies: C3–C5.
- Likely files: alert repository, lifecycle service/controller and integration tests.

### Checkpoint C1 — Lifecycle gate

- C5–C6 tests prove timestamp deduplication, lease ownership, one unresolved
  alert, immutable events and safe retry behavior.
- Full backend test, typecheck, lint and build pass before notifications begin.

### Task C7 — Scoped in-app notification inbox

Create one durable notification per lifecycle event and eligible active Admin or
Farmer. Add cursor-paginated list and idempotent read/unread update. Recheck current
alert scope on every read.

- Acceptance: Client Developer never receives or reads notifications.
- Acceptance: removing farm membership immediately hides retained notifications.
- Acceptance: unread count and pagination are deterministic.
- Verify: recipient uniqueness, current-scope and HTTP integration tests.
- Dependencies: C6 lifecycle events.
- Likely files: notification repository, service, controller, module and tests.

### Task C8 — Honest device capability and completion gate

Expose `GET /device-configurations/capability` for Admin/Farmer with only
`NOT_AVAILABLE / DEVICE_CONTRACT_PENDING`. Complete OpenAPI and operator notes;
do not create device configuration data or publish routes.

- Acceptance: Client Developer is denied and no mutation route exists.
- Acceptance: OpenAPI documents all Phase C routes and normalized failures.
- Verify: capability/OpenAPI tests followed by the full repository gate.
- Dependencies: C7 and the stable Phase C route set.
- Likely files: capability controller, contracts, OpenAPI test and checkpoint note.

## Full verification gate

```powershell
pnpm test
pnpm test:coverage
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm audit --prod
pnpm db:status
git diff --check
```

Checkpoint C-core is backend-complete only after these commands pass. Frontend
mock replacement remains a separate integration step. Real rule activation and
the C-device design remain blocked by B-device evidence.

## Risks held closed

- Demo metadata leakage: production config rejects demo mode.
- Duplicate alerts: database uniqueness, timestamp dedupe, transactions and lease.
- Authorization drift: every request checks current role and farm/station scope.
- Upstream outage: counters remain unchanged and failures are isolated per station.
- Scope expansion: external notifications and device configuration stay deferred.
