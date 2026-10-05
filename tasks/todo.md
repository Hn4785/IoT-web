# Backend delivery checklist

Updated: 2026-10-05

This is the single short status index for the project. Detailed acceptance
criteria for the original modules remain in the
[original module roadmap](../docs/roadmaps/2026-09-02-backend-completion-roadmap.md),
open risks remain in the
[backend issue ledger](../docs/reviews/2026-09-04-backend-follow-up.md), and local
commands remain in the
[operations runbook](../docs/operations/LOCAL-RUNBOOK.md).

The current completion roadmap is [tasks/plan.md](plan.md). It adds durable
measurements and portable Pi/server deployment without reopening accepted B/C.
Execution through F-data is approved; formal reports/operator manuals are separate.
Final target clarified 2026-10-05: server-hosted website; Pi/local remains development
and team testing. Server/domain/ingress/backup gates must pass before website launch.
The receiving team performs deployment. Codex owns app/data verification and handoff
assets; deployment instructions are separate. Infrastructure gates are team-owned,
not reasons to claim the app is already production-ready or auto-deploy a server.

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

## B. Authorized station data — complete locally (owner accepted 2026-09-30)

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
- [x] B-integration-browser: The product owner completed the local Admin/Super
      Admin → Farmer → Client Developer acceptance pass against the running
      backend on 2026-09-30. The broader automated responsive/recovery matrix
      remains a release-quality gate under FE-6/QA-1, not a Phase B blocker.
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
      on Pi with all 11 migrations applied. `Manage Access` is the single browser
      surface for station grants to Farmer and Client Developer accounts; account
      administration only edits role and shows shared access read-only.
- [x] B-farmer-prep-local-demo-cleanup: Backed up the local database, then
      removed `Farm Demo`, `Plot Demo`, their seven test stations and the managed
      test source so Farmer work starts from an empty local hierarchy. Users,
      sessions and security-audit records were left intact; post-cleanup counts
      for demo Farm/Plot, managed sources and stations are all zero.
- [x] Deployment follow-up — Pi demo cleanup: Before the 2026-09-30 rollout,
      created a database/Compose backup, then removed the `Farm Demo` hierarchy
      in one transaction: two demo plots, twelve duplicate station rows, one
      membership, one client grant and three API-key scopes. Both removed source
      records and audit evidence were retained. Post-cleanup Farm/Plot counts are
      zero.
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
      devices. Product-owner browser acceptance for B/C was completed locally on
      2026-09-30; the wider automated recovery matrix remains under FE-6/QA-1.

Evidence: [`2026-09-10-phase-b-core.md`](../docs/checkpoints/2026-09-10-phase-b-core.md).

## C. Alerts and in-app notifications — complete locally (owner accepted 2026-09-30)

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
- [x] C-integration-browser: The product owner completed the local Admin/Farmer
      authorization, lifecycle and stale-session acceptance pass on 2026-09-30.
      Broader automated failure/recovery coverage remains tracked under QA-1.
- [x] C-device-boundary: Record the provider decision that the web configures
      alert thresholds only. Calibration and other intervention happen directly
      onsite; no device-write contract, payload or publish API will be added in
      the current product scope.

Evidence: [`2026-09-16-c1.md`](../docs/checkpoints/2026-09-16-c1.md).

## D. Operations — app/local complete; receiving-team production acceptance open

- [x] D0: Verify Phase C baseline and approve the operations design.
- [x] OP-1: Persist and expose Super Admin-scoped audit events safely.
- [x] OP-2: Add structured logs, bounded readiness and finite failure signals.
- [x] Checkpoint D1: Verify audit leakage and dependency failure injection.
- [x] OP-3: Add pinned Node image, immutable install and CI quality gates.
- [x] OP-4-local: Backup `iot_dev`, restore into an isolated database and run the
      application against the restore without overwrite/delete behavior.
- [x] OP-5-local: Pass production-image smoke and frontend OpenAPI contract gates.
- [x] Checkpoint D-local baseline (2026-09-20): Pass 58/58 test files, 369/369 tests,
      coverage, format, typecheck, lint, build, migration status, secret scan and
      diff check. Historical evidence remains separate from fresh revalidation.
- [x] D-backup-regression-local (2026-10-05): Native backup/restore failures stop
      immediately; a target-creation race cannot proceed to restore. Cleanup
      warnings cannot hide the original failure. Fourteen PowerShell regressions
      and an isolated `iot_test -> new iot_restore_d_*` application acceptance pass
      preserve readings, grants, ciphertext, lifecycle, notifications and audit.
- [x] D-dependencies-local: Apply the owner-approved compatible security patches;
      fresh production dependency audit has zero advisories. Immutable install
      and backend/frontend regression gates pass without auth-flow changes.
- [x] D-local-revalidation (2026-10-05): Fresh coverage/static gates and the patched
      non-root Linux/amd64 production image pass against the isolated restore.
      Stored reads retain timestamps; unauthenticated reads are denied; Swagger
      stays hidden. Isolated image network loss gives health 200/readiness 503,
      then readiness recovers after reconnect without stopping PostgreSQL.
- [ ] OP-4-production: Assign RPO/RTO, encrypted off-machine backup destination,
      retention, restore owner and credential-rotation procedure.
      Owner accepted RPO 24h, RTO 4h and 7 daily/4 weekly copies on 2026-10-05;
      destination, key custodian, restore owner and rotation evidence remain open.
- [ ] OP-5-staging: Pass complete role E2E, load limit and security acceptance on
      staging with production-like topology.
- [ ] D-infrastructure: Approve the selected single-instance target's ingress/TLS,
      trusted proxy hops, rate-limit placement/policy and private metrics boundary.
      Multi-instance/shared limiting and metrics aggregation remain conditional
      future extensions outside the final Pi/server roadmap, not hidden blockers.
- [x] D-security-MFA-scope: Owner/team excluded MFA/SSO from this delivery on
      2026-10-05; no MFA implementation or public-security certification is claimed.
- [x] D-security-recovery-local: Existing recovery changes the holder password,
      revokes only its active sessions, preserves older revocation evidence and
      unrelated sessions, and emits secret-free audit evidence. Two regressions pass.
- [ ] D-security-recovery-target: Receiving team verifies Super Admin recovery and
      credential rotation on its selected target without weakening login/access/audit.
- [ ] Checkpoint D-production: Accept all staging, infrastructure, backup,
      security and live-device evidence. Only this checkpoint may claim
      `production-ready`.

Evidence:
[`2026-09-20-d1.md`](../docs/checkpoints/2026-09-20-d1.md) and
[`2026-09-20-d-local.md`](../docs/checkpoints/2026-09-20-d-local.md).
Latest backend regression gate (2026-10-05): 85/85 files, 510/510 tests, coverage
88.69% statements / 78.52% branches / 93.99% functions / 91.27% lines and
`pnpm verify`. Test DB has all 12 migrations; post-update secret scan passed for 268 files.
Frontend: 181/181 tests, lint, build and zero production dependency advisories.
Fresh image/restore evidence: [D revalidation](../docs/checkpoints/2026-10-05-d-local.md).
September checkpoints are retained historical evidence, not current counts.

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
- [ ] FE-5: Verify the already-connected Super Admin audit view against the
      scoped contract in browser role/filter/cursor cases; do not expose the
      process-local metrics registry as a public UI API. The implementation is
      present; the remaining gate is acceptance evidence, not a new Audit page.
- [ ] FE-6: Run automated browser tests plus manual responsive/accessibility
      checks for Admin, Farmer and Client Developer.
- [ ] QA-1: Run normal, invalid-input, expired/revoked credential, concurrent,
      upstream-down, database-down/restart and recovery scenarios.
- [ ] QA-2: Record reproducible failures in the backend issue ledger and move an
      item to fixed only after regression evidence exists.

## Immediate next action

1. Local F2-F6 and Checkpoint F-data are complete with fresh regression and measured
   fixture evidence. D app/local stays complete; team-owned deployment stays open.
   The owner paused F7 and authorized a separate scoped F-data Git/Pi test rollout:
   only real-reading storage/collection logic, backup and additive migrations;
   preserve existing data and never seed/import fixtures or restore local test DB.
   Remaining D/F/FE updates will be published together after verification.
   Use the existing BE/FE branches; do not create a public test-release branch.
   No fixture/sample/test database is deployed or imported on Pi.
   F-data BE `de466ea` is now on Git/Pi; API/web/database smoke passes and genuine
   latest readings persist. Raw-history backfill remains `invalid`/unverified;
   this rollout does not close F-product, F7 or production gates. All future F/FE
   releases transfer verified logic only, never sample/test databases.
2. Close FE-2/FE-5/FE-6/QA-1/QA-2 through F16 with actual evidence, not blanket ticks.
3. Preserve the no-device-write scope and B/C owner acceptance.
4. Keep local/Pi acceptance distinct from website/public production acceptance.

## F. Final portable monitoring — execution approved through F-data

The receiving team deploys the server website using verified handoff assets.
Pi/local supports development/team testing; data transfer is explicit and never
bidirectional. Codex does not provision or deploy their host. The formal deployment
guide is a separate deliverable.

Detailed acceptance, candidate files, dependencies and verification are in
[tasks/plan.md](plan.md); only the short task index is maintained here.

- [ ] F0: Reconcile old TODO/issue evidence and clear verified quality/config debt.
      CI/config/format and capability-map debt reconciled locally. Owner-approved
      dependency patches passed fresh production audit (zero advisories) and full
      regression on 2026-10-05. Broader issue/browser/target reconciliation remains
      open; dependency success alone does not close F0 or authorize public release.
- [x] F1-data: Approve persistence/provenance/coverage and retention/capacity contracts.
      Owner approved 90-day real raw history plus separate last-known snapshots;
      detailed section 16 schema/DTO/collection contract approved 2026-10-05.
      Approval was local; the later scoped Pi rollout is recorded above.
- [ ] F1-target: Receiving team approves its server deployment target contract.
- [x] F2: Persist normalized real readings and latest snapshots with deduplication.
- [x] F3: Serve authorized durable latest data through outage and backend restart.
- [x] F4: Collect without a browser; bound retries, concurrency and resume watermarks.
- [x] F5: Import bounded raw history and query local history with honest coverage.
- [x] F6: Enforce reading retention/storage limits and safe collection-health signals.
- [x] Checkpoint F-data: Restart/outage/history/scope acceptance with durable readings.
      Local fixture acceptance, not live-provider/Pi/server certification:
      [checkpoint evidence](../docs/checkpoints/2026-10-05-f-data-progress.md).
      Original checkpoint applied migration only to local `iot_test`. Later Pi
      follow-up is recorded above; no F7 UI changes or full live-backfill claim.
- [ ] F7: Show exact-station last-known latest data; isolate endpoint failures.
- [ ] F8: Preserve exact-query history; isolate failed stations and stale responses.
- [ ] F9: Invalidate retained data on account/session/grant/source changes.
- [ ] F10: Verify fresh-only automatic alerts and notification recovery without duplicates.
- [ ] Checkpoint F-product: Role/browser acceptance for online/stored/empty/denied states.
- [ ] F11: Reproducible full-app packaging, migration runner and ARM64/server gates.
- [ ] F12-team: Validate deployment profile/target prerequisites for receiving-team handoff.
- [ ] F13-team: Team deployment, smoke and schema-safe rollback acceptance.
- [ ] F14: Rehearse Pi/server data and secret transfer with isolated restore/cutover.
- [ ] F15: Pass the additional website security, backup and measured capacity gate.
- [ ] F16: Close existing FE/QA gates and live-provider recovery with linked evidence.
- [ ] F17-local: Accept local/Pi after applicable F-data/F-product/deploy/QA gates.
- [ ] F17-web: Accept the website target only after F15 and its target-specific tests.

No item above is complete merely because this plan was written. Formal report and
operator/user manual work is excluded; existing in-app CSV/report functionality
still receives regression checks. D-production stays open until its own gates pass.
