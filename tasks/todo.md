# Backend delivery checklist

Updated: 2026-09-20

This is the single short status index for the project. Detailed acceptance
criteria remain in the
[canonical roadmap](../docs/roadmaps/2026-09-02-backend-completion-roadmap.md),
open risks remain in the
[backend issue ledger](../docs/reviews/2026-09-04-backend-follow-up.md), and local
commands remain in the
[operations runbook](../docs/operations/LOCAL-RUNBOOK.md).

## Status meaning

- `[x]`: implemented and verified with the named checkpoint or quality gate.
- `[ ]`: still requires implementation, integration evidence or an external
  decision. A local substitute must not be marked complete.
- `sample-verified`: validated against controlled sample/fake-upstream data.
- `live-verified`: validated against the real CENTER/NODE provider.

## 0. Integration foundation — complete

- [x] IC-1: Reproducible Node 24 and pnpm tooling boundary.
- [x] IC-2: Validated runtime configuration with safe startup failure.
- [x] IC-3: Public liveness contract at `GET /api/v1/health`.
- [x] IC-4: Stable error envelope, request IDs and HTTP hardening.
- [x] IC-5: Weather query and response contracts.
- [x] IC-6: Controlled fake-upstream test server.
- [x] IC-7: Private Weather client success paths.
- [x] IC-8: Timeout, payload-size, schema and upstream failure controls.
- [x] IC-9: OpenAPI contract and operator documentation.
- [x] IC-10: Foundation completion gate.

## A. Identity and access — complete

- [x] IA-1: Approve identity/session/RBAC/API-key design.
- [x] IA-2: Add PostgreSQL/Prisma identity and authorization foundation.
- [x] IA-3: Add Admin user provisioning and safe account DTOs.
- [x] Checkpoint A1: Verify persistence, bootstrap and provisioning.
- [x] IA-4: Add login, `/auth/me`, forced password change and lockout.
- [x] IA-5: Add refresh rotation, replay detection, logout and revocation.
- [x] Checkpoint A2: Verify cookie, token, replay and logout boundaries.
- [x] IA-6: Enforce Farm/Plot/Station scope inheritance server-side.
- [x] IA-7: Add scoped Client Developer API-key lifecycle and limiter.
- [x] Checkpoint A: Verify three roles, Super Admin and emergency recovery.

Evidence: [`2026-09-02-phase-a.md`](../docs/checkpoints/2026-09-02-phase-a.md).

## B. Authorized station data — backend core complete

- [x] SD-1: Approve station DTO, filter, pagination and cache design.
- [x] SD-2: Add authorized Farm → Plot → Station hierarchy/list APIs.
- [x] Checkpoint B1: Verify ownership, inheritance and cross-scope denial.
- [x] SD-3: Add latest-soil mapping, validation, cache and safe fallback.
- [x] SD-4: Add bounded UTC history, aggregation and pagination.
- [x] SD-5: Add API-key station/latest/history contracts and rate metadata.
- [x] Checkpoint B-core: Verify backend against controlled sample upstream.
- [ ] B-integration: Replace remaining frontend station/soil mocks and run the
      browser role matrix against the current backend.
- [ ] B-device: Validate CENTER metadata and at least one NODE against the real
      provider before changing status from `sample-verified` to `live-verified`.

Evidence: [`2026-09-10-phase-b-core.md`](../docs/checkpoints/2026-09-10-phase-b-core.md).

## C. Alerts and in-app notifications — backend core complete

- [x] AC-1: Approve rule, lifecycle, notification and device-deferral design.
- [x] AC-2: Add scoped alert-rule contracts, validation and mutation APIs.
- [x] AC-3: Add deterministic evaluator, lease, idempotency and durable
      open/acknowledge/resolve lifecycle.
- [x] Checkpoint C1: Verify state transitions, concurrency and actor evidence.
- [x] AC-4: Add scoped in-app notification inbox, unread state and retention.
- [x] C-core: Verify lifecycle, notifications, retention and safe device
      capability response.
- [ ] C-integration: Connect frontend alert action center and notification inbox,
      then run Admin/Farmer authorization and stale-session browser cases.
- [ ] C-device: Approve real hardware schema, units, command transport,
      acknowledgement and failure behavior before adding configuration writes.

Evidence: [`2026-09-16-c1.md`](../docs/checkpoints/2026-09-16-c1.md).

## D. Operations — local release candidate complete

- [x] D0: Verify Phase C baseline and approve the operations design.
- [x] OP-1: Persist and expose Super Admin-scoped audit events safely.
- [x] OP-2: Add structured logs, bounded readiness and finite failure signals.
- [x] Checkpoint D1: Verify audit leakage and dependency failure injection.
- [x] OP-3: Add pinned Node image, immutable install and CI quality gates.
- [x] OP-4-local: Backup `iot_dev`, restore into an isolated database and run the
      application against the restore without overwrite/delete behavior.
- [x] OP-5-local: Pass production-image smoke and frontend OpenAPI contract gates.
- [x] Checkpoint D-local: Pass 58/58 test files, 369/369 tests, coverage, format,
      typecheck, lint, build, migration status, secret scan and diff check.
- [ ] OP-4-production: Assign RPO/RTO, encrypted off-machine backup destination,
      retention, restore owner and credential-rotation procedure.
- [ ] OP-5-staging: Pass complete role E2E, load limit and security acceptance on
      staging with production-like topology.
- [ ] D-infrastructure: Approve ingress/TLS, trusted proxy hops,
      multi-instance/shared rate limiting and private metrics aggregation.
- [ ] D-security: Approve MFA/SSO and Super Admin enrollment/recovery policy.
- [ ] Checkpoint D-production: Accept all staging, infrastructure, backup,
      security and live-device evidence. Only this checkpoint may claim
      `production-ready`.

Evidence:
[`2026-09-20-d1.md`](../docs/checkpoints/2026-09-20-d1.md) and
[`2026-09-20-d-local.md`](../docs/checkpoints/2026-09-20-d-local.md).

## Frontend and tester integration order

- [ ] FE-1: Freeze the current `/docs-json` contract and generate/update typed
      frontend DTO/API adapters without renaming backend routes ad hoc.
- [ ] FE-2: Re-run Phase A browser flows: login, forced password change,
      single-flight refresh, logout, user management, Super Admin transfer and API
      key create/copy/rotate/revoke.
- [ ] FE-3: Complete B-integration for farm, plot, station, latest, history,
      dashboard, report and Client Developer explorer pages.
- [ ] FE-4: Complete C-integration for alert rules, alert lifecycle and in-app
      notifications; keep device configuration visibly unavailable.
- [ ] FE-5: Connect the Admin audit view only to the scoped audit contract; do not
      expose the process-local metrics registry as a public UI API.
- [ ] FE-6: Run automated browser tests plus manual responsive/accessibility
      checks for Admin, Farmer and Client Developer.
- [ ] QA-1: Run normal, invalid-input, expired/revoked credential, concurrent,
      upstream-down, database-down/restart and recovery scenarios.
- [ ] QA-2: Record reproducible failures in the backend issue ledger and move an
      item to fixed only after regression evidence exists.

## Immediate next action

Start at `FE-1`, then complete `FE-2` through `FE-6` using controlled sample
data. In parallel, wait for real CENTER/NODE access and named production owners.
Do not block frontend integration on hardware, and do not mark B-device or
D-production complete using sample data.
