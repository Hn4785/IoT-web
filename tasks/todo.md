# Backend delivery checklist

Updated: 2026-09-29

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
- [x] B-integration-code: Replace frontend station/soil mocks with typed
      hierarchy, latest and history adapters; expose truthful loading, empty and
      upstream-error states.
- [ ] B-integration-browser: Run the Admin/Super Admin → Farmer → Client
      Developer browser role matrix against the current backend.
- [x] B-device-source: Provider confirmed on 2026-09-28 that all CENTER/NODE
      data delivered through the issued `X-API-Key` is real sensor data and the
      final input for acceptance. Do not store the key in evidence.
- [x] B-device-live-evidence: Marked `live-verified` on 2026-09-28 because the
      issued API reads directly from operating observation stations, values are
      updating, and the provider confirmed the CENTER/NODE data is real sensor
      data. Browser role coverage remains tracked separately.
- [x] B-source-1: Add encrypted Admin/Farmer-owned API sources and discover real
      stations only after a successful allowlisted upstream connection.
- [x] B-source-2: Add owner-managed Farmer sharing, Admin oversight,
      `Visible Accounts`, and owner-only audited key reveal.
- [x] B-source-3: Route latest/history through each station's source without
      changing public measurement DTOs or Client Developer platform keys.
- [x] B-source-FE-admin: Admin API Sources is implemented with English copy,
      direct connection fields, truthful states and no `N/A`; v2.5.6 is healthy
      on Pi with all 11 migrations applied. Client Developer stays outside source
      sharing and Settings stays last.
- [x] B-farmer-prep-local-demo-cleanup: Backed up the local database, then
      removed `Farm Demo`, `Plot Demo`, their seven test stations and the managed
      test source so Farmer work starts from an empty local hierarchy. Users,
      sessions and security-audit records were left intact; post-cleanup counts
      for demo Farm/Plot, managed sources and stations are all zero.
- [ ] B-farmer-deploy-pi-demo-cleanup: When the Farmer release is pushed to Pi,
      back up the Pi database and remove the corresponding `Farm Demo` /
      `Plot Demo` hierarchy there. Do not perform this Pi cleanup during local
      Farmer implementation.
- [x] B-source-FE-farmer: Reuse the approved direct-entry and owned/shared-source
      behavior for Farmer without widening Client Developer access.
- [x] B-source-remove-orphan-hierarchy: Removing the
      last active API source no longer leaves its empty Farm/Plot visible in
      Stations & Devices. The active hierarchy hides the now-empty Plot and Farm
      the active hierarchy only when no other active source/station uses them;
      preserve retained station, alert, notification and audit history instead
      of hard-deleting historical records. Cover both source-created and reused
      Farm/Plot cases with backend tests. Completed locally with active-source
      hierarchy filtering; the frontend reloads the hierarchy on navigation or
      refresh after removal.
- [x] B-admin-soil-source-checkpoint: Implement the approved soil-only admission,
      station-scoped sharing, owner-managed station rules and shared-recipient
      notifications, recoverable source removal, simplified role-only User
      editor, read-only shared-access display, protected account deletion,
      Farm/Plot select-or-create and the simplified direct-entry source form.
      Follow
      [`2026-09-28-soil-source-admin-checkpoint-design.md`](../docs/superpowers/specs/2026-09-28-soil-source-admin-checkpoint-design.md)
      in the listed delivery order; commit FE and BE locally and do not push.
- [x] B-alert-center-shared: Admin and Farmer now share one Alert Center with
      confirmed canonical soil field units/revisions, source-owner rule
      management, Automatic/Paused modes and read-only shared-recipient access.
      Automatic rules evaluate new samples and create in-app notifications for
      the source owner and authorized station viewers; they never control remote
      devices. Browser role acceptance remains tracked by
      B-integration-browser and C-integration-browser.

Evidence: [`2026-09-10-phase-b-core.md`](../docs/checkpoints/2026-09-10-phase-b-core.md).

## C. Alerts and in-app notifications — backend core complete

- [x] AC-1: Approve rule, lifecycle, notification and no-device-write design.
- [x] AC-2: Add scoped alert-rule contracts, validation and mutation APIs.
- [x] AC-3: Add deterministic evaluator, lease, idempotency and durable
      open/acknowledge/resolve lifecycle.
- [x] Checkpoint C1: Verify state transitions, concurrency and actor evidence.
- [x] AC-4: Add scoped in-app notification inbox, unread state and retention.
- [x] C-core: Verify lifecycle, notifications, retention and safe device
      capability response.
- [x] C-integration-code: Connect the alert action centers, in-app notification
      inbox and fail-closed device-capability screens to current backend contracts.
- [x] C-delivery-hardening: Move notification fanout to a durable bounded worker,
      freeze display values at transition time, and preserve pending jobs in retention.
- [ ] C-integration-browser: Run Admin/Farmer authorization, lifecycle and
      stale-session browser cases.
- [x] C-device-boundary: Record the provider decision that the web configures
      alert thresholds only. Calibration and other intervention happen directly
      onsite; no device-write contract, payload or publish API will be added in
      the current product scope.

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
- [x] Checkpoint D-local: Pass 58/58 test files, 371/371 tests, coverage, format,
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
Latest backend regression gate (2026-09-27): 59/59 files, 375/375 tests and
`pnpm verify`; this does not replace the earlier coverage/image/restore evidence.

## Frontend and tester integration order

Implementation mapping, endpoint rules and per-page acceptance steps are kept in
the frontend integration guide at `D:/IoT-web/docs/integration/README.md`. Use
that guide together with `/docs-json`; this checklist remains the status index
and must not duplicate the full contract.

### Agreed sequencing gate

- [x] Complete the locally implementable Phase B/C adapters and pages before the
      comprehensive browser pass. External provider and hardware contracts stay
      open and must not be replaced with fabricated data.
- [ ] After that gate, connect and verify one page at a time in this fixed role
      order: **Admin/Super Admin first → Farmer second → Client Developer last**.
- [ ] Finish each role's page matrix, authorization negatives and regression
      checks before moving to the next role. Shared components may be reused, but
      unfinished work from two roles must not be mixed into one checkpoint.

- [x] FE-1: Freeze the current `/docs-json` contract and update typed
      frontend DTO/API adapters without renaming backend routes ad hoc.
- [ ] FE-2: Re-run Phase A browser flows: login, forced password change,
      single-flight refresh, logout, user management, Super Admin transfer and API
      key create/copy/rotate/revoke.
- [x] FE-3: Complete B-integration code for farm, plot, station, latest, history,
      dashboard, report and Client Developer explorer pages.
- [x] FE-4: Complete C-integration code for alert rules, alert lifecycle and in-app
      notifications; keep remote device writes unavailable and direct threshold
      changes to Alert Center.
- [ ] FE-5: Connect the Admin audit view only to the scoped audit contract; do not
      expose the process-local metrics registry as a public UI API.
- [ ] FE-6: Run automated browser tests plus manual responsive/accessibility
      checks for Admin, Farmer and Client Developer.
- [ ] QA-1: Run normal, invalid-input, expired/revoked credential, concurrent,
      upstream-down, database-down/restart and recovery scenarios.
- [ ] QA-2: Record reproducible failures in the backend issue ledger and move an
      item to fixed only after regression evidence exists.

## Immediate next action

1. Run the remaining browser role matrix one page at a time in the fixed order
   **Admin/Super Admin → Farmer → Client Developer**.
2. Complete the remaining browser role matrix and registry checks without
   storing provider credentials; B-device data provenance is already
   `live-verified`.
3. Verify retained IoT Config/Config Proposals screens do not offer remote writes:
   threshold changes belong to Alert Center and physical intervention stays onsite.
4. Back up and clean the Pi demo hierarchy only when this Farmer release is
   deployed; local implementation must not mutate Pi state early.
5. Keep deployment-owner decisions separate; B-device `live-verified` must not
   be used to close the browser matrix or D-production.
