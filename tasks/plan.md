# Implementation Plan: Final portable soil monitoring

Updated: 2026-10-06
Status: D app/local and local Checkpoint F-data complete on 2026-10-05.
F7-F10 and Checkpoint F-product-local are also complete with 557 backend and 218
frontend tests plus isolated role/browser data-state evidence. See
[F-product evidence](../docs/checkpoints/2026-10-05-f-product-progress.md).
F11 onwards, broad FE/QA and receiving-team target gates remain open.
Follow-up owner authorization: publish only completed F-data logic to Git/Pi for
internal testing, preserving existing data and applying its two additive migrations.
Latest owner instruction (2026-10-06): finish applicable F11-F17 and outstanding
FE/QA, fix the GitHub dependency-audit failure, and publish verified BE/FE code
to the existing Git branches and Pi. This supersedes the earlier local-only hold.
Codex coordinates and reviews; bounded Antigravity/subagents implement code.
Never publish sample/test databases or overwrite Pi data. Formal handoff paperwork
and the receiving team's website deployment remain separate.
Publish to the existing BE/FE branches, not a separate public test branch. All
future F/FE releases transfer verified system logic, never sample/fixture/test
databases to Pi/server. F-data follow-up: BE de466ea now runs on Pi with additive
migrations 12/13 and genuine latest readings. Raw-history validation currently
reports invalid; live backfill coverage remains unverified. See the single release
record in D:/IoT-web/docs/internal-release-notes.md. Reconcile this scoped BE
release before the later combined D/F/FE push; never force-push over it.

> For agentic workers: use superpowers:executing-plans for coordination, one approved
> slice at a time. Codex plans/reviews; project code follows the bounded Antigravity
> workflow in AGENTS.md. This roadmap is not an executable handoff or blanket consent.

## Goal and confirmed deployment model

Complete the existing monitoring app with durable real soil readings, honest
last-known/latest/history presentation, outstanding QA, and reproducible deployment
of the same application. Final delivery is a server-hosted website; Pi/local is
the development/team-test option, not the required production topology.

Clarification accepted 2026-10-05: the stakeholder expects a normal server-hosted
website rather than an internal Pi-only service. Finish the data foundation locally,
then prioritize the server website release gates. No server/domain is yet selected.

The owner chose data transfer when needed, not bidirectional Pi/cloud sync.
Two separately deployed copies are not automatically synchronized or one database.

Delivery ownership clarified 2026-10-05: the receiving team deploys the website.
Codex completes/verifies the app and reproducible handoff assets, not their server,
domain, TLS or infrastructure. The deployment guide is a separate deliverable.
Earlier intent-driven automatic deployment is no longer required for this delivery.
Do not infer permission to access or change a server from this plan.

## Scope and boundaries

- Preserve Admin/Super Admin, Farmer, Client Developer and accepted B/C functionality.
- Add durable measurements, bounded background collection/history catch-up, retention,
  explicit freshness/provenance/coverage and recovery after provider/backend failure.
- Complete role/session/accessibility/failure QA and portable single-instance packaging.
- Server infrastructure/application deployment and production target acceptance belong
  to the receiving team; no autonomous intent-based deployment implementation is needed.
- No remote device writes, calibration, SMS/email, predictive agronomy, PWA/browser
  offline storage, multi-instance infrastructure or two-way synchronization.
- Formal project reports and operator/user manuals are a separate workstream.
  Existing in-app History & Report/CSV remains supported and gets regression checks;
  no new reporting subsystem or report deliverable is included.
- Technical specs, tests and release evidence remain in scope, not deferred manuals.
- Current slice (latest owner update 2026-10-05): local F2-F6 and Checkpoint F-data
  are complete against the approved section 16 contract, including the separately
  approved internal fetch-generation columns. This supersedes the earlier F1 hold.
  The owner has now resumed F7-F10 and Checkpoint F-product locally. The earlier
  scoped F-data Pi rollout is historical; no new Pi changes or remote push are
  authorized during this iteration. No seeds/fixture data are delivery data.
  Formal reports/manuals remain excluded.
- MFA/SSO is excluded by the owner/team decision on 2026-10-05. Keep existing
  authentication, authorization, secret protection, audit and recovery controls.

## Sources, baseline and design approval

Active status is tasks/todo.md; frontend task files point here rather than duplicate
the final checklist. Existing module boundaries stay in CAPABILITY-MAP.md:
station-data provides measurements, alert-config consumes eligible samples,
operations owns deployment/recovery.

Read the relevant existing specs before each slice:
docs/superpowers/specs/2026-09-02-station-data-design.md and
docs/superpowers/specs/2026-09-20-operations-design.md.
Station-data section 16 is the approved local F-data storage/API/collection contract
(owner acceptance 2026-10-05). Earlier persistent-storage exclusions are superseded
only within that approved scope; receiving-team deployment gates remain separate.

B/C owner acceptance on 2026-09-30 stays closed. The single release record,
D:/IoT-web/docs/internal-release-notes.md (2026-10-05), records BE 6262e80/FE 089a116
on Pi and FE 181/BE 427 passing tests. These are prior evidence, not fresh live checks.
The four pre-existing formatting failures were cleared in 74aa0c3. Root verification
after durable latest implementation passed pnpm verify and 436/436 tests (72 files).
Fixture browser QA and container health do not prove complete role E2E.

Old issue-ledger seed/Farm Demo instructions predate accepted B/C and demo removal.
Reconcile them with newer evidence; never rerun old seeds to satisfy stale text.

## Approved F-data contract

Reuse PostgreSQL/Prisma without a new time-series engine. Persist validated readings
and serve stored results under current server-side source/station authorization.
The provider remains the origin of measurements; no fabricated samples during outage.

Keep sensor observedAt, original fetch/ingestion time, source/station identity,
metadata revision and delivery provenance distinct. Reading the local database is
not a successful provider connection. Latest may be old; history may cover only
part of a requested range. Represent those facts explicitly in the approved DTOs.

Owner-approved on 2026-10-05: retain normalized raw readings for 90 days and retain the
latest last-known snapshot separately for active stations. Decide collection interval,
backfill budgets and capacity from provider quotas and measured Pi storage, not
guesses. Do not store hourly/daily upstream aggregates as raw observations or average
averages. Unknown units/depth/sensor metadata stay unknown.

Persistence belongs to the backend. Browser retention is exact-query, current-session
memory only. It must clear on observed access loss/logout/account change; it is not
an offline-browser authorization mechanism and cannot detect remote revocation while
disconnected.

## Global execution constraints

Dependency audit update (2026-10-05): owner-approved compatible security patches
replace the earlier 14-advisory finding (7 high, 7 moderate). Nest runtime/testing
is pinned to 12.0.3, Fastify to 5.12.5 and affected transitive ranges are constrained.
Fresh root `pnpm audit --prod` passes with zero advisories; immutable install,
`pnpm verify` and 510/510 backend tests pass. Supply-chain age/build policies are
unchanged. Audit success is not public deployment or production acceptance.

- Node >=24.17.0 <25, pnpm 11.19.0, existing lockfiles/stack; no unapproved dependency.
- Same-origin /api/v1; no embedded Pi IP, secrets, provider keys or public DB.
- Ask before schema, auth, CORS, limiter, integration or security-policy changes.
- No dumps/credentials/tokens in Git, logs, test fixtures or screenshots.
- Never delete volumes, reintroduce demos, restore over a live DB or reset user work.
- TDD per approved slice: expected failing behavioral test -> minimal code -> green
  connected tests -> repository gates -> independent review.
- Aim for <=5 changed files per code slice; split candidate groups before dispatch.
- Every code handoff uses both delegation skills and budget policy: 20% reserve,
  exact paths/commands/limits/timeouts, <=4 mandatory skills, worker no commit/push/merge,
  <=2 correction rounds. Candidate paths below are not permission grants.
- This iteration authorizes application/data work, handoff assets and a verified
  Git/Pi release; the receiving team's server is not an autonomous deploy target.
  Receiving-team deployment/acceptance remains separate; destructive restore and
  new security policy require explicit approval.

## Ordered tasks with acceptance

### F0 — Baseline and quality debt

Depends: none. Split docs reconciliation and formatting into separate S slices.
Candidates: tasks/plan.md, tasks/todo.md, current issue ledger; four formatting files
named in the release record.
Acceptance: B/C remains closed; Audit implementation vs browser evidence distinguished;
CI/config discrepancies reproduced before being declared bugs. No demo/seed rewrite.
Verify: evidence/diff review; formatting-only slice runs pnpm verify plus connected tests.

### F1 — Approve storage, collection and deployment contracts

Depends: F0. S spec slices, no production code.
Candidates: existing station-data/operations specs; read schema/contracts/config.
Acceptance: approve dedup/correction identity, metadata/provenance/coverage, access and
source-removal behavior, retention/capacity, polling/backfill budgets, transfer policy
and local/private/public target gates.
Verify: examples for online/stored-only/empty/partial/denied/recovery; no DTO/migration
becomes authoritative before explicit schema/public-contract approval.

### F2 — Durable observations and latest snapshot

Depends: F1. M.
Candidates: prisma/schema.prisma, one new migration,
new src/station-data/soil-observation.repository.ts and DB tests.
Acceptance: finite validated values retain source/station/field/sensor-time identity;
retries deduplicate, older samples cannot overwrite newer snapshots, metadata changes
and same-timestamp corrections follow the approved policy.
Verify: isolated migration/insert/retry/restart/readback, duplicate station codes across
sources, raw-vs-aggregate separation and database failure.

### F3 — Authorized durable latest fallback

Depends: F2. M.
Candidates: station-data.service.ts, soil.mapper.ts, observation repository,
test/integration/station-data/latest.spec.ts and new durable-latest.spec.ts.
Acceptance: upstream success persists; eligible provider failure/backend restart serves
only matching authorized last-known data with unchanged sample time and truthful origin.
Access/source errors and DB failures never become stale success or markConnected.
Verify: success -> outage -> process restart -> stored read; no data -> truthful empty/error;
cross-source, removed source and revoked scope negatives.

### F4 — Collection without an open browser

Depends: F3. M; split lease/recovery if >5 files.
Candidates: new soil-collection.service.ts/tests, station-data.module.ts,
station-source-client.resolver.ts, approved collection-state repository.
Acceptance: active configured soil stations only; bounded concurrency/timeouts/backoff,
persistent watermark and safe shutdown. Overlap/restart cannot duplicate writes or
advance the watermark before committing.
Verify: deterministic fake provider/clock, no logged-in browser, overlapping workers,
outage/recovery, crash/restart; source removal stops further collection.

### F5 — Local history import and query

Depends: F4. Two M slices: raw backfill, then query/aggregation.
Candidates: new soil-history-import.service.ts/tests and soil-history.repository.ts/tests;
station-data.service.ts/history.mapper.ts only as required.
Acceptance: raw import pages within existing <=7-day windows and approved budgets.
Local UTC filters/order/cursors/mean/min/max/first/last preserve existing <=90-day
aggregate range limits. Gaps and partial coverage are explicit.
Bind continuations to query and data origin; do not silently mix upstream and
local pages or accept an incompatible cursor when falling back.
Verify: pagination/resume, zero/sparse values, duplicates, UTC boundaries, reference
aggregation fixtures; never label incomplete history complete or average averages.

### F6 — Storage bounds and collection health

Depends: F5. Separate M retention and S health slices.
Candidates: observation repository, identity/retention.service.ts/tests;
approved operations signals only.
Acceptance: bounded retention keeps active last-known snapshots and audit/lifecycle
evidence; safely surface stalled collection/storage pressure without secret or
unbounded metric labels. Distinguish DB failure from provider outage.
Verify: measure rows/indexes/WAL/backup bytes, disk/RAM headroom and query latency for
declared stations/samples/day/retention; controlled purge/disk-write failure recovery.

### Checkpoint F-data

Provider may be unavailable: controlled tests prove durable readings survive restart,
history coverage is honest and no wrong-source/unauthorized data is returned.
Live-provider recovery stays a separate evidence gate.

### F7 — Last-known latest presentation

Depends: F3 plus approved DTOs. M slices per page group.
FE candidates: src/types/soil.ts, services/latestSoilService.ts, new scoped state helper;
farm-owner/RealtimeSoilMonitoring.tsx, FarmDashboard.tsx, admin/StationDetail.tsx/tests.
Acceptance: sample age/last successful update/stored-old status/retry are visible.
Latest/history/alerts failures are independent; StationDetail never retains another
station's data after route changes. Successful empty response clears obsolete data.
Verify: focused tests and browser online -> refresh failure -> stored recovery.

### F8 — Exact-range history and partial-station recovery

Depends: F5/F7. M slices.
FE candidates: services/stationBrowserService.ts, history-query state helper,
farm-owner/HistoricalAnalysis.tsx and HistoryReport.tsx/focused tests.
Acceptance: state keys include actual begin/end, station/field/interval/aggregate/cursor.
One station failure preserves other valid series; gaps/coverage visible; late responses
cannot overwrite a changed selection.
Verify: selection/range changes, out-of-order requests, failed station, UTC/local labels
and existing truthful CSV behavior. No new report artifact.

### F9 — Purge data on scope/session changes

Depends: F7/F8. M.
FE candidates: scoped helper, hooks/useStationHierarchy.ts and scope-isolation tests;
auth store/API client only after explicit auth-flow approval.
Acceptance: account/role/environment/logout clears retained data; observed 401/403/404
and grant/source removal purge affected copies. Scope refresh works even when farm/plot
IDs stay unchanged; retention cannot bypass backend authorization.
Verify: each role, failed refresh, account switch, unchanged hierarchy IDs, revoked access.

### F10 — Fresh automatic alerts exactly once

Depends: F4/F5/F9. M.
Candidates: alert-config/alert-evaluation.service.ts, alert-evaluator.ts,
focused evaluation/notification integration tests.
Acceptance: preserve revision/metadata and observedAt ordering; old snapshots/backfilled
samples cannot produce duplicate or misleading live notifications; fresh recovered
samples resume current rules with existing owner/shared boundaries.
Verify: collector/evaluator overlap, restart, backfill, rule/grant changes and fanout.

### Checkpoint F-product

Browser acceptance Admin/Super Admin -> Farmer -> Client Developer for online,
stored-only, empty and denied states. Stored readings do not imply Connected provider.
No sample production data, remote writes or SMS.

### F11 — Reproducible full-app packaging

Depends: F0; finalize migration packaging after F2. M slices.
Candidates: BE Dockerfile, deployment Compose overrides, backend CI; FE Docker/proxy
definition in D:/IoT-web; packaging tests.
Acceptance: versioned web/API/DB, same-origin routing, private persistent DB and working
provider egress; native ARM64 and server architecture gates. Explicit maintenance/
migration runner; current pruned runtime is not assumed to contain Prisma CLI/tsx.
Verify: image/config/startup/deep-link/proxy tests, native dependencies, all required
safe CI config; no workstation-only volume paths or dotenv in assets.

### F12 — Receiving-team deployment preflight (handoff, not autonomous deploy)

Depends: F11 plus deployment contract. M.
Candidates: secret-free deployment configuration and validation in F11 assets;
deployment-guide content is separate. No natural-language target resolver is required.
Acceptance: team can select the server profile and validate CPU/Docker/storage/origin,
release/migration compatibility and required secrets before writing. Missing/ambiguous
target or existing-data conflict stops. Codex does not access/provision their host.
Verify: local profile/config validation; actual target preflight belongs to the team.

### F13 — Receiving-team apply, smoke and application rollback

Depends: F12/F-data/F-product. M slices for apply/rollback.
Candidates: versioned F11 assets and existing scripts/verify-release.mjs; no custom
remote orchestration framework is required. Team-owned acceptance: verified backup,
retained previous release, approved migration, rollout order and smoke/hash checks.
Verify: local packaging/smoke rehearsal, then team evidence for their staging rollout.
Rollback application only if schema-compatible; no automatic live-DB restore after a
migration failure. Recover interrupted rollout without deleting data.

### F14 — Safe host-to-host data transfer

Depends: F6/F11/F13. M.
Candidates: existing backup-restore-rehearsal.ps1 and proposed portable
backup/restore/cutover helper/tests.
Acceptance: isolated destination restore first; real readings, grants, alerts,
notifications/audit and source decryption remain correct. Source stays recoverable;
only one target becomes authoritative after explicit cutover.
Verify: isolated restore/count/scope/read checks and cutover/rollback rehearsal.
Securely transfer DATA_SOURCE_ENCRYPTION_KEY separately from dump; specify pepper/JWT/
session recovery policy, never secret values. Do not delete source volumes.

### F15 — Additional website security and capacity gate

Depends: F11-F14 and approved public/private target intent. Separate S/M slices.
Candidates: approved ingress/config/security/audit protection and scoped CI/tests.
Acceptance for public website: HTTPS, cookie/origin/proxy/IP policy, private DB/metrics,
off-host encrypted backup with RPO/RTO/restore owner, Super Admin recovery policy,
approved append-only audit protection and reviewed CI action pinning.
Approve and test the single-instance target's limiter placement/policy; the existing
local process limiter is not automatically approved for an Internet-facing proxy.
Verify: staging auth/role/proxy negatives, target load/disk failure/recovery, restore and
secret/dependency gates. LAN readiness is not public production readiness.
No multi-instance/shared limiter/Redis unless separately approved.

### F16 — Remaining TODO regression and live recovery

Depends: data/product/deploy gates; F15 before public acceptance. S/M by role/scenario.
Candidates: focused BE/FE/browser tests, existing issue ledger and single release record.
Acceptance: close FE-2, FE-5 acceptance, FE-6, QA-1/QA-2 with evidence: login/password/
refresh/logout/key lifecycle, user management/Super Admin transfer, audit scope/filter/
cursor, grant removal, responsive/accessibility and actual existing CSV download.
Include invalid input, expired/revoked credentials, concurrent requests/refresh
single-flight, upstream timeout and database-down/restart/recovery cases.
Verify: desktop/~390px at 100% zoom; each role, Pi/server same-origin smoke and negative
scope tests. FE-6 requires automated browser tests PLUS manual responsive/accessibility
checks, not either one alone; source tests alone are not E2E. Approve the browser
runner/dependencies and bounded commands before adding automation.
Live recovery proves advancing observedAt and one fresh rule notification. If the API
remains unavailable, keep only that live gate open; do not fabricate a passing result.

### F17 — Final technical acceptance

Depends: all applicable slices. S acceptance, no new feature.
Candidates: tasks/todo.md and existing internal release record.
Local/Pi complete only after applicable data/product/deploy/QA gates; website complete
only after its additional F15 target-specific security acceptance.
Record exact version/platform/limits; unit tests and healthy containers alone do not
justify production-ready. Formal reports and manuals remain separately requested.

## Verification commands and execution rhythm

These are existing commands for FUTURE approved execution, not results from this plan.
Use isolated DBs/ports. Never fault-inject against live Pi/server data.

Backend:

    pnpm exec vitest run --pool=threads --maxWorkers=1
    pnpm verify
    pnpm test:coverage
    pnpm security:secrets
    pnpm audit --prod --audit-level=high
    pnpm db:status
    pnpm release:check -- --skip-openapi

Run pnpm db:migrate:deploy only against the exact approved test/deployment destination
after its backup gate. Focused new tests use explicit paths with the same Vitest flags.

Frontend:

    npm test
    npm run lint
    npm run build
    node --experimental-strip-types --test test/stationBrowserService.test.ts test/latestSoilAdapter.test.ts

FE build includes TypeScript. There is no existing browser-E2E script; F16 approves
the runner and bounded commands before implementation. Coverage/audit are final gates.

Order: F0 -> F1 -> F2/F3 -> F4/F5/F6 -> F7/F8/F9/F10 -> product acceptance.
F11/F12 can proceed independently after their contract gate; F13 waits for data/product.
F14 rehearses transfer; F15 gates website; F16/F17 close acceptance.
No delivery-date promises before F0/F1 resolve the actual risks.

## Current execution

D app/local revalidation is complete on 2026-10-05: 510/510 backend tests with
coverage, static/migration/secret gates, zero production advisories, isolated restore/
recovery and patched non-root image smoke. Frontend 181/181 tests, lint/build/audit
also pass. Evidence: docs/checkpoints/2026-10-05-d-local.md. This is local application
acceptance, not receiving-team staging/production deployment acceptance.
The owner subsequently resumed work through F-data. F2-F6 and local F-data are now
fixture-verified with fresh full-suite, OpenAPI, migration and capacity evidence:
[F-data checkpoint](../docs/checkpoints/2026-10-05-f-data-progress.md).
Live-provider recovery, actual Pi/server capacity and public deployment remain
separate gates. F7-F10 and local F-product acceptance are now complete with linked
evidence; F11 onward is not implicitly authorized by the local-only publishing
instruction.
No Pi database change, remote push or receiving-team deployment in this iteration.
Team-owned target gates cannot be checked off with local substitute evidence.
