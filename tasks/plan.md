# Implementation Plan: Final portable soil monitoring

Updated: 2026-10-08
Status: D app/local, F-data/F-product, F11-F14 local and bounded FE/QA acceptance
are verified. Recorded 2026-10-06 release: backend 93 files/621 tests, frontend
242 tests and isolated HTTP/browser acceptance. BE source/CI follow-up `ec02462`;
API runtime `26df9ddc20c41aee250d7be3ef4815908ed4ebf4`, web runtime `aea78f5-arm64`.
Source/docs revisions and deployed runtime identities are intentionally distinct.
See the [single release record](https://github.com/Hn4785/IoT-web/blob/FE/docs/internal-release-notes.md),
[task index](todo.md) and [issue ledger](../docs/reviews/2026-09-04-backend-follow-up.md).
Live recovery/backfill and receiving-team target gates remain separate.
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
databases to Pi/server. Historical F-data follow-up: BE de466ea ran on Pi with additive
migrations 12/13 and genuine latest readings. Raw-history validation currently
reports invalid; live backfill coverage remains unverified. See the single release
record in D:/IoT-web/docs/internal-release-notes.md. This scoped BE release was
reconciled before the combined D/F/FE push, without force-push. The verified
2026-10-06 runtime rollout is recorded in the same release notes, not another manual.

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
  scoped F-data Pi rollout is historical. The 2026-10-06 owner instruction above
  supersedes the local-only hold: publish verified combined BE/FE and update Pi.
  No seeds/fixture data are delivery data.
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

FE build includes TypeScript. The bounded Playwright runner is now available; F16 uses
the runner and bounded commands before implementation. Coverage/audit are final gates.

Order: F0 -> F1 -> F2/F3 -> F4/F5/F6 -> F7/F8/F9/F10 -> product acceptance.
F11/F12 can proceed independently after their contract gate; F13 waits for data/product.
F14 rehearses transfer; F15 gates website; F16/F17 close acceptance.
No delivery-date promises before F0/F1 resolve the actual risks.

## Current execution

The applicable D/F/FE baseline and Git/Pi smoke were recorded on 2026-10-06;
older counts and no-push instructions in dated checkpoints are historical evidence.
The current task is H0–H7 documentation authoring/review and Git publication,
authorized on 2026-10-08. Logic, dated QA evidence and outstanding issues take
priority; operations is a short reproducibility reference. No runtime/schema/DB
change or Pi access. Receiving-team deployment/sign-off remain separate;
fixtures cannot close live/team-owned gates.

## H. Handoff documentation plan

Owner request: 2026-10-06. This extends the same final-delivery plan;
it does not replace F or reopen accepted B/C. The original acceptance criteria
remain below; the latest authoring/review status is in `tasks/todo.md` and the
single release record. Receiver acceptance is separate from completed writing.
Preparation was recorded on 2026-10-07. Owner requested drafting through H7 on
2026-10-08, all Word text black and docs published to Git.
Codex coordinates/final-reviews. Antigravity may draft bounded code-grounded sections
or cross-check Codex drafts in an isolated worktree; never auto-merge worker claims.

Updated: 2026-10-08. The source entry points below remain canonical; the FE
handover report is the controlled summary/inventory and source for one Word
export, not a duplicate API/manual contract. No Pi redeployment for docs-only edits.
Use the receiving company's template if supplied. Otherwise use the controlled
handover structure below; it is a project-sized practice, not a claim of ISO/OWASP
certification or a universal company template.

### H-prep — Agreed handover structure and required-asset matrix

Keep six content groups: summary/acceptance, technical architecture/API/database,
installation/operation/recovery, user guide, test results/open issues, and security.
These are content groups, not six mandatory new files or a manual per job title.
Retain the four maintained document entry points below and link existing authoritative
specs, OpenAPI, migrations, checkpoints and release notes instead of duplicating them.
H0 selected one professional black-text Word report because no company template
was supplied. FE `docs/handover/README.md` controls the export and links the four
maintained guides. No screenshot is claimed as live-provider evidence.

| Required asset                   | Planned authoritative location / evidence                 | Acceptance during drafting                                                                                                                                                                        |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source code                      | Git BE/FE revisions; H7 inventory/index                   | Exact repository/branch/commit and matching runtime image digest; source and reproducible tests, not generated output, secret files or disposable fixtures/data.                                  |
| Database                         | H2 schema/ERD/migrations; H4 recovery                     | Schema/migration order and data meaning are linked; any real-data backup transfer needs approved scope, encryption and named custodians. Never export production data merely to fill a checklist. |
| Images, files and resources      | FE tracked public/assets and guide evidence; H7 inventory | Actual relative path, purpose and applicable ownership/license; screenshots are masked and distinguish real-source from isolated QA evidence.                                                     |
| Configuration and environment    | Tracked example files; H4 configuration table             | Required/optional variables, safe examples and runtime requirements; real passwords/keys use a separate approved secure channel, never Git or the report.                                         |
| Dependencies and libraries       | BE/FE package manifests and lockfiles; H0/H5              | Exact runtime/package-manager requirements, install method, third-party notices where applicable and dated dependency-audit scope.                                                                |
| Installation and deployment      | H4 existing delivery/recovery and local runbook           | One recommended ordinary installation path per profile with verified commands, prerequisites, expected output, failure/stop conditions and safe rollback.                                         |
| Test cases and results           | H5 linked tests/checkpoints/release record                | Requirement-to-case/result traceability, version/platform/date and pass/fail/not-run status; automated, manual, fixture and live evidence remain distinct.                                        |
| Remaining bugs and functionality | Canonical issue ledger and scoped Trung entries; H5/H7    | Severity/impact, actual status, evidence, workaround and responsible party; distinguish defects, excluded features and pending receiving-target acceptance.                                       |

Document-control fields: title/identifier, version, applicable BE/FE revisions,
last-reviewed date, writer/reviewer, approval status and change history. Use stable
repo-relative links or revision-pinned repository URLs; a local Windows drive path
is not a portable receiver link. The inventory row format is asset/document, path,
revision/digest, scope/status, owner and receiver confirmation. Sign-off requires
the named receiving party; a prepared checkbox or running Pi is not formal acceptance.
Mark absent/not-applicable assets explicitly with a reason. Keep draft, reviewed
and receiver-accepted states separate, with preparer/reviewer/receiver dates and
accepted exceptions; unknown receiver details remain unassigned rather than invented.

Writing order: H0 baseline/template/inventory -> H1 scope -> parallel bounded H2/H3
and H4 sections -> H5 evidence/security reconciliation -> H6 cross-review -> H7
index and receiver acceptance. Review after H1/H2, after H3/H4, and before H7 delivery.
Codex writes/co-ordinates scope and operations and final-reviews; Antigravity may
write independent API/data/user-guide slices or check Codex facts through the bounded
workflow after fresh budget review. QA/SDET contributes test reproducibility;
Security reviews access/secret/recovery limits. No worker may commit, push, merge,
delete documents or expand code scope automatically.

### H0 — Freeze evidence and choose a small document set

Depends: applicable F/FE verification and Git/Pi release evidence.
Files: `tasks/todo.md`, FE `docs/internal-release-notes.md`, latest BE checkpoint.
Accept: exact BE/FE commits, architecture, migration list, verification commands,
limits and unresolved receiving-team decisions are linked, without secret values.
Read the current working diff before drafting: there are pre-existing unrelated edits.
Released 2026-10-06 evidence does not certify those edits. Preserve them, distinguish
the verified release from the working copy, and resolve any facts that diverge before
using them in a document. Do not roll back or silently publish someone else's work.
Review documents by meaning and SHA256; keep dated specs/ADRs/checkpoints as history.
Delete only proven duplicate/obsolete files after fixing inbound links; record paths
and Git recovery commit. Inventory found no exact duplicates, so no blanket deletion.

### H1 — Scope and system overview

Files: FE `README.md`, BE `CAPABILITY-MAP.md` (links, not a second module spec).
Writer: Codex; Antigravity cross-checks page/module references.
Include purpose, actors/role matrix, FE → API → PostgreSQL/provider flow, durable
readings, single authoritative Pi OR server, accepted boundaries and exclusions.
Accept: a newcomer can distinguish supported monitoring from device commands,
SMS/email, predictive advice, multi-instance and two-way sync, which are excluded.
Verify every capability against routes/DTOs/page navigation; use real masked screenshots
only after source recovery, or explicitly label isolated screenshots as QA evidence.

### H2 — Backend/API and database section

Files: FE `docs/integration/README.md`, links to BE module specs and `prisma/schema.prisma`.
Writer: bounded Antigravity per API/data slice; Codex reviews authorization/schema facts.
Include endpoint/auth/error conventions, roles, API-key lifecycle, database diagram,
13 migrations, raw 90-day retention, separate snapshot, dedup/fetch fencing,
provenance/coverage, collector budgets and fresh-only alerts.
Accept: each statement cites its actual controller/contract/schema/function and test;
no database records or credentials copied into documents. Existing specs remain canonical.
Verify with `pnpm release:check` on a non-production fixture and contract tests;
compare field names with `/docs-json`, not handwritten alternate DTOs.

### H3 — User and tester guide

Files: FE `README.md` and `docs/integration/README.md` (extend existing sections).
Writer: bounded Antigravity; Codex checks page wording and access behavior.
Include Admin/Super Admin, Farmer, Client Developer journeys; adding/sharing sources,
station selection, latest vs history, timezone/units, stored/stale/empty/denied states,
CSV, Alert Center/Notifications and safe one-time secret acknowledgement.
Accept: concrete action → expected screen/result → recovery action for each journey.
Verify using desktop/390px browser tests and manual keyboard/visual checks; no demo
seed is part of onboarding. Do not use User Management as the source-sharing screen.

### H4 — Deployment, operation and recovery guide

Files: BE `docs/operations/DELIVERY-RECOVERY.md`, `LOCAL-RUNBOOK.md`.
Writer: Codex; Antigravity checks named script flags/container paths independently.
Include prerequisites, explicit profile/preflight, immutable image digests, migration
runner, initialization, HTTPS/Secure cookie boundary, same-origin reverse proxy,
health/readiness, source outage, logs, backup encryption/key custody and isolated restore,
one-target cutover, compatible application rollback, secret rotation and troubleshooting.
Accept: commands have working directory, prerequisites, expected exit/status and stop
condition; no `down -v`, reset, production fault injection or automatic restore over data.
Use ordinary Docker/Compose and existing verified project scripts. Explain only the
minimal normal setup/start/status/logs path first; backup/restore/update/rollback are
separate procedures. Keep AI handoff, worktree management and internal fixture/test
orchestration out of the receiver's installation steps. Separate local/Pi test and
server profiles without weakening HTTPS, secret handling or data-preservation gates.
Verify every executable block against disposable environments. Record RPO 24h/RTO 4h
and 7 daily/4 weekly objectives as objectives until destination/owners/schedule are assigned.

### H5 — QA and known limitations

Files: latest BE checkpoint, canonical backend issue ledger, FE release notes.
Writer: Codex; Antigravity checks test names and reproducibility, no invented pass counts.
Include version/platform/date, automated vs manual vs live evidence, regression matrix,
security audit/CI links, backup/rollback results and receiving-team open gates.
Security is an explicit reviewed section: auth/session/scope/API keys, credential
storage and recovery, verified audits and accepted exclusions such as MFA/SSO.
Dependency audit is not a penetration test or ASVS certification. Retention of up to
90 days is not evidence of 90 populated days; RPO/RTO are accepted objectives, not
measured achievements. Carry the unobserved fresh provider-notification and target
backup/TLS/capacity gates forward without replacing them with fixture results.
Accept: fixed issues have RED/GREEN evidence and actual retest date; STT/status follow
the Trung sheet's existing 15-column form (A through O). No Pi infrastructure bugs in that bug list.
If Google Sheet cannot be verified, keep the same form locally and clearly state sync pending.

### H6 — Cross-review and small corrective changes

Depends: H1-H5 drafts. Review per section, not one huge context handoff.
Codex-written facts receive independent AG checks; AG-written facts receive Codex review.
Map suspected unused code to actual callers/contracts before touching it. Fix confirmed
defects with RED/GREEN tests; remove code only when behavior/API/access does not change.
Use bounded code handoffs and at most two corrections; no opportunistic broad refactor.
Re-run affected gates, update the canonical ledger/Trung form and release notes, then
repeat Git/Pi acceptance only if runtime code changed. Never describe a planned check as passed.

### H7 — Delivery index and receiving-team acceptance

Files: FE `README.md` links, BE `tasks/todo.md`, FE release notes.
Accept: one navigation index to the four maintained documents, specs and evidence;
receiver can build, start, read stored data, test permitted roles and rehearse recovery.
Receiver fills target/domain/TLS/proxy, backup destination/custodian/restore owner,
capacity limits and live-provider recovery evidence. Those decisions are not guessed
by an intern or an agent. Formal sign-off stays unchecked until the receiving team accepts.

Writing pattern for each section: purpose/audience → supported behavior → prerequisites
→ numbered procedure with expected results → failure/recovery → code/evidence links
→ limits/owner. Backend/Database, Frontend/UI, QA/SDET, Security and DevOps/System
perspectives are required; Tech Lead/Solution Architect contribute the overview and
cross-review. PM/BA/PO are acceptance stakeholders, not separate technical manuals.
UI/UX gets a practical screen guide, not a new design-system deliverable.

Primary references for command review:
[Docker single-server Compose](https://docs.docker.com/compose/how-tos/production/) and
[PostgreSQL 17 SQL dump/restore](https://www.postgresql.org/docs/17/backup-dump.html).
These explain tooling; project-specific policies and actual acceptance remain above.
Handover practice references: [Google SRE service onboarding/readiness](https://sre.google/sre-book/evolving-sre-engagement-model/)
for service-specific review, training and responsibility transfer, and
[Microsoft ADR/document repository guidance](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record)
for decision rationale, status and a single authoritative document repository.
