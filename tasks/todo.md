# Backend delivery checklist

Updated: 2026-10-08

This is the single short status index for the project. Detailed acceptance
criteria for the original modules remain in the
[original module roadmap](../docs/roadmaps/2026-09-02-backend-completion-roadmap.md),
open risks remain in the
[backend issue ledger](../docs/reviews/2026-09-04-backend-follow-up.md), and local
commands remain in the
[operations runbook](../docs/operations/LOCAL-RUNBOOK.md).

The current completion roadmap is [tasks/plan.md](plan.md). It adds durable
measurements and portable Pi/server deployment without reopening accepted B/C.
Execution through applicable F17 and FE/QA is approved; formal reports/operator
manuals are separate. Owner authorized Git/Pi publication on 2026-10-06 after
independent review and verification; the earlier local-only hold is superseded.
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
D-local historical regression gate (2026-10-05): 85/85 files, 510/510 tests, coverage
88.69% statements / 78.52% branches / 93.99% functions / 91.27% lines and
`pnpm verify`. Test DB has all 12 migrations; post-update secret scan passed for 268 files.
Frontend: 181/181 tests, lint, build and zero production dependency advisories.
Fresh image/restore evidence: [D revalidation](../docs/checkpoints/2026-10-05-d-local.md).
These D and September checkpoints are retained historical evidence, not current
F-product counts. F-product baseline: backend 89 files/557 tests and frontend
218 tests, with verification linked below; coverage was not rerun for that checkpoint.
Latest F/FE release evidence is maintained in FE `docs/internal-release-notes.md`.

## Frontend and tester integration order

Implementation mapping, endpoint rules and per-page acceptance steps are kept in
the frontend integration guide at `D:/IoT-web/docs/integration/README.md`. Use
that guide together with `/docs-json`; this checklist remains the status index
and must not duplicate the full contract.

### Agreed sequencing gate

- [x] Complete the locally implementable Phase B/C adapters and pages before the
      comprehensive browser pass. External provider and hardware contracts stay
      open and must not be replaced with fabricated data.
- [x] After that gate, connect and verify one page at a time in this fixed role
      order: **Admin/Super Admin first → Farmer second → Client Developer last**.
- [x] Finish each role's page matrix, authorization negatives and regression
      checks before moving to the next role. Shared components may be reused, but
      unfinished work from two roles must not be mixed into one checkpoint.

- [x] FE-1: Freeze the current `/docs-json` contract and update typed
      frontend DTO/API adapters without renaming backend routes ad hoc.
- [x] FE-2: Re-run Phase A browser flows: login, forced password change,
      single-flight refresh, logout, user management, Super Admin transfer and API
      key create/copy/rotate/revoke.
      HTTP fixture desktop/mobile covers account/key/transfer/logout/reload;
      clipboard compared in actual Chromium at 1440/390px without logging secrets.
      Concurrent refresh and late-session races have focused RED/GREEN regressions.
- [x] FE-3: Complete B-integration code for farm, plot, station, latest, history,
      dashboard, report and Client Developer explorer pages.
- [x] FE-4: Complete C-integration code for alert rules, alert lifecycle and in-app
      notifications; keep remote device writes unavailable and direct threshold
      changes to Alert Center.
- [x] FE-5: Verify the already-connected Super Admin audit view against the
      scoped contract in browser role/filter/cursor cases; do not expose the
      process-local metrics registry as a public UI API. The implementation is
      present; actual HTTP filter/cursor and Admin denial pass on desktop/mobile.
- [x] FE-6: Run automated browser tests plus manual responsive/accessibility
      checks for Admin, Farmer and Client Developer.
      Mock/HTTP suites plus keyboard/layout checks at 1440/390px. This is bounded
      application acceptance, not a complete WCAG certification or receiver-target test.
- [x] QA-1-local: Run normal, invalid-input, expired/revoked credential, concurrent,
      upstream-down, database-down/restart and recovery scenarios.
      Isolated integration/failure/recovery tests only; never fault-inject on Pi.
- [x] QA-2: Record reproducible failures in the backend issue ledger and move an
      item to fixed only after regression evidence exists.
      Local 15-column form and verified retest dates. Selected confirmed logic
      entries are recorded in Trung 48–57; the ledger preserves the local/Sheet mapping.

## Immediate next action

1. Publish the reviewed H documentation and black-text Word report. The verified D/F/FE
   rollout and final web follow-up reached Git/Pi on 2026-10-06; smoke evidence
   remains in the [single release record](https://github.com/Hn4785/IoT-web/blob/FE/docs/internal-release-notes.md).
   The 2026-10-08 docs publication does not change runtime or authorize Pi access.
2. Keep the known empty-history-window/backfill limitation visible in the
   [issue ledger](../docs/reviews/2026-09-04-backend-follow-up.md). Raw coverage
   remains unverified; do not describe retention capacity as 90 populated days.
3. Obtain natural fresh-provider notification/recovery evidence when available;
   do not trigger genuine rules artificially or mark F16-live/F17 complete from fixtures.
4. Receiving-team server/TLS/backup/capacity acceptance stays separate. Preserve
   accepted B/C and no-device-write scope. Future authorized releases use existing
   BE/FE branches and verified logic only, never sample/test databases or seed data.

## F. Final portable monitoring — applicable final execution approved

The receiving team deploys the server website using verified handoff assets.
Pi/local supports development/team testing; data transfer is explicit and never
bidirectional. Codex does not provision or deploy their host. The formal deployment
guide is a separate deliverable.

Detailed acceptance, candidate files, dependencies and verification are in
[tasks/plan.md](plan.md); only the short task index is maintained here.

- [x] F0-local: Reconcile old TODO/issue evidence and clear verified quality/config debt.
      CI/config/format and capability-map debt reconciled locally. Owner-approved
      dependency patches passed fresh production audit (zero advisories) and full
      regression on 2026-10-05. Verified issue fixes are linked in the ledger;
      unresolved broad browser and target acceptance are explicitly assigned to
      F16/F1-target/D-production. This local closure does not authorize public release.
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
      Original 2026-10-05 checkpoint applied migration only to local `iot_test`
      and did not include F7. The later combined rollout is in the release record;
      it still does not prove full live backfill.
- [x] F7: Show exact-station last-known latest data; isolate endpoint failures.
      Independent endpoints, original timestamps, request/route fencing and
      empty/denied purging verified locally; FE commit `d405a64`.
- [x] F8: Preserve exact-query history; isolate failed stations and stale responses.
      Full query identity, per-station retry, original provenance/coverage,
      gap/CSV semantics and unchanged-query retention on scope shrink verified
      locally; FE commit `3959bb5`.
- [x] F9: Invalidate retained data on account/session/grant/source changes.
      Session/environment scope, all-level hierarchy refresh with unchanged IDs,
      stale pagination fencing and access-loss purging verified locally.
- [x] F10: Verify fresh-only automatic alerts and notification recovery without duplicates.
      Backend local: canonical backfill is not relabeled as fresh upstream; stored
      snapshots cannot advance automatic rules. Positive evaluation rechecks READY,
      revision/unit/metadata under lock. Seven new regressions plus existing
      lifecycle/recipient/restart/lease tests pass; full gate 89 files/557 tests and
      `pnpm verify`. Browser F-product and live-provider/target gates remain separate.
      [evidence](../docs/checkpoints/2026-10-05-f-product-progress.md).
- [x] Checkpoint F-product-local: Role/browser acceptance for online/stored/empty/denied states.
      Original 2026-10-05 evidence: isolated browser fixtures exercise pages for Admin/Super Admin,
      Farmer and Client Developer; backend 557/557 and frontend 218/218 tests,
      typecheck/lint/build and backend format/audit pass. No provider/DB/Pi calls
      in the browser fixture and no authentication E2E/live-target certification.
      At that checkpoint FE-2/FE-5/FE-6/QA-1/F16 were separate, including native CSV download.
      [evidence](../docs/checkpoints/2026-10-05-f-product-progress.md).
      The original local-only hold was superseded by the verified 2026-10-06
      release and F16-local HTTP/CSV checks. No fixture/sample delivery occurred.
- [x] F11: Reproducible full-app packaging, migration runner and ARM64/server gates.
      Runtime/tools separated; native amd64/ARM64 CI and same-origin full-stack smoke.
- [x] F12-local: Implement and verify read-only explicit-profile deployment preflight.
      Invalid secrets/images/migration prefix/origin/profile fail closed; CLI passes.
- [ ] F12-team: Validate deployment profile/target prerequisites on the receiving host.
- [x] F13-local: Rehearse full-stack apply/smoke and schema-safe application rollback.
      Disposable stack readiness/deep-link/proxy and previous-image rollback pass;
      PostgreSQL container/volume unchanged; no schema reversal or source DB restore.
- [ ] F13-team: Team deployment, smoke and schema-safe rollback acceptance.
- [x] F14-local: Verify encrypted portable backup and isolated restore/transfer.
      Authenticated envelope/tamper/no-overwrite tests and actual isolated restore;
      scope, durable readings, ciphertext decryption and lifecycle remain correct.
- [ ] F14-target: Receiving team accepts secret custody and explicit one-target cutover.
- [ ] F15: Pass the additional website security, backup and measured capacity gate.
- [x] F16-local: Close existing FE/QA gates with isolated HTTP/browser/regression evidence.
- [ ] F16-live: Verify advancing provider observedAt and one fresh automatic-rule
      notification after recovery. Do not trigger genuine rules artificially on Pi.
- [ ] F17-local/Pi: Accept final runtime rollout after applicable data/product/deploy/QA
      and live-recovery evidence. Local tests do not close the unobserved live gate.
- [ ] F17-web: Accept the website target only after F15 and its target-specific tests.

No item above is complete merely because this plan was written. Formal report and
operator/user manual work is tracked separately in H; existing in-app CSV/report
functionality still receives regression checks. D-production stays open until its
own gates pass.

## H. Handover documentation

Owner approved drafting through H7 and publishing docs on 2026-10-08. Logic,
honest QA results and remaining issues are primary; operations is a short
reproducibility reference. Word text is black. No runtime/schema/DB change or
Pi redeployment in this documentation task. Details:
[handover plan](plan.md#h-handoff-documentation-plan).

- [x] H-prep: Record the six content groups, all eight required asset categories,
      portable links/document-control fields, ordinary installation-command policy,
      bounded writer/reviewer roles and checkpoints. Only the plan is prepared.
- [x] H-maintenance: Audit existing docs and disposable copies, reconcile current
      statuses/links and preserve historical evidence before manual drafting.
      2026-10-07: 43 tracked Markdown files, no exact duplicates or broken relative
      file/heading links. Local ledger retains 18 rows, STT 48–65, all 15 columns.
      No proven unused backup copies removed; protected rehearsal material and
      other worktrees remain untouched. This is doc maintenance, not H0–H7 completion.
- [x] H0: Reconcile current working edits against the verified release, freeze
      revisions/evidence, and confirm receiving template/export format and inventory.
      BE `ec02462` and FE `5dbeea53` are the frozen source baselines; image/tag
      identity is recorded separately. No company template supplied: one controlled
      Vietnamese Word report, all writing black, backed by maintained Markdown.
- [x] H1: Draft scope/architecture and supported/excluded feature/role overview.
- [x] H2: Draft linked backend/API/database content without duplicating contracts.
- [x] Checkpoint H1/H2-docs: Review scope, schema/API facts, links and release identity.
- [x] H3: Draft role-based user journeys, expected outcomes and recovery actions.
- [x] H4: Draft simple installation plus operation/backup/restore/rollback guide.
- [x] Checkpoint H3/H4-docs: Cross-check commands against scripts/Compose, page steps,
      secret masking and local/demo versus receiving-server boundaries. Fresh
      preflight/backup unit tests: 40/40; Compose configuration validation passes.
      Reuse the dated isolated rehearsal/browser evidence; the entire rewritten
      command set and receiving-host installation were not rerun during authoring.
- [x] H5: Consolidate test traceability, security evidence, known issues and open gates.
- [x] H6: Independently review bounded sections; reproduce suspected defects before
      any separately scoped code correction. No broad cleanup or automatic merge.
      Antigravity H2/H3 received one correction round and independent source review;
      H6 cross-review addressed test paths, key/recovery wording and checkout identity.
      No new confirmed runtime defect or runtime change in this documentation task.
- [x] H7-docs: Complete the portable asset/document index and reviewed Word export.
      FE `docs/handover/README.md` links four maintained guides, eight asset categories,
      dated QA/security evidence and the canonical issue ledger. Word export is
      9 pages, with linked contents and black text; all pages visually reviewed.
- [ ] H7-receiver: Receiving party fills names, date, accepted exceptions and sign-off.
- [ ] Checkpoint H-delivery: Receiver can follow the installation/user/recovery steps;
      inventory paths/revisions match, secrets are absent and open gates stay explicit.

H documentation is prepared and reviewed, not receiver-accepted. Keep the existing
F/live/production gates unchanged; neither a report nor a running demo closes the
empty-history P2, fresh-provider notification evidence or receiving-target acceptance.
