# Farmer integration and three deferred fixes implementation plan

> Historical record: counts, pending steps and deployment holds describe this
> checkpoint/plan's dated scope. Current completion and release applicability
> are in [the task index](../../../tasks/todo.md); do not rerun old seed or rollout steps.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the local Farmer integration, make shared search and responsive layouts honest and usable, and freeze notification recipients at delivery start without deploying to Pi.

**Architecture:** Preserve the existing dirty Farmer work and treat backend DTOs as the source of truth. The shared topbar reads the authenticated inbox and authorized station hierarchy, never static notifications or device mocks. The delivery worker stores a recipient snapshot atomically on first dispatch and then processes that immutable set in bounded batches; current authorization still gates inbox reads.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner; NestJS, Prisma, PostgreSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-alert-config-design.md` and `D:/IoT-web/docs/integration/README.md`.

## Global constraints

- No push to GitHub or deployment to Pi in this checkpoint. Commit local, scoped, verified changes.
- Do not discard, reset, or stage unrelated working-tree changes. Inspect all overlapping dirty files before editing.
- No sample notification or device data in authenticated production UI; backend role/scope enforcement remains authoritative.
- Search only real, authorized stations; do not claim device search until a provider device contract exists.
- Recipient eligibility is frozen at the start of worker dispatch; grant/revocation after that point changes only subsequent jobs. Inbox reads still enforce current scope.

---

### Task 1: Farmer checkpoint and incoming Notifications reconciliation

**Files:** `D:/IoT-web/src/pages/farm-owner/*`, `D:/IoT-web/src/components/notifications/*`, `D:/IoT-web/src/components/layout/Topbar.tsx`, `D:/IoT-web/src/types/notification.ts`, `D:/IoT-web/src/services/notificationService.ts`, related `D:/IoT-web/test/*.test.ts`.

**Interfaces:** Consume `NotificationDto`, `NotificationPage`, `notificationService.list` and `.setRead`; produce a shared topbar inbox and Farmer pages that use current backend DTOs.

- [ ] Compare each dirty Farmer page and remote notification commit against the backend contract; record the merge boundary and preserve unrelated edits.
- [ ] Add a failing test: the topbar/notification adapter must consume `GET /notifications`, show the server `unreadCount`, and PATCH read state without importing `src/data/notifications.ts`.
- [ ] Run the focused test and confirm the expected failure; then connect the dropdown to the existing notification service and make its view-all action navigate to the Farmer inbox or a role-appropriate route.
- [ ] Run `npm test`, `npm run lint`, `npm run build`; verify no mock notification reaches an authenticated route. Commit only the reviewed files.

### Task 2: Authorized station search

**Files:** `D:/IoT-web/src/components/layout/Topbar.tsx`, its CSS, `D:/IoT-web/src/services/stationBrowserService.ts`, the shared search test.

**Interfaces:** Consume cursor-paginated `/farms`, `/farms/:id/plots`, `/plots/:id/stations`; produce role-scoped station results with route links and explicit loading, empty, and error states.

- [ ] Add failing tests for authorized station results, no-results, and no device contract/permission leakage.
- [ ] Run the focused tests to confirm failure; add the minimal paginated station search adapter, respecting cursor and an explicit bounded result/loading policy.
- [ ] Render a keyboard-accessible topbar result list; remove the misleading devices placeholder. Keep Client Developer scope fail-closed if portal bearer station search is unavailable.
- [ ] Verify focused tests, full frontend test/lint/build and browser desktop/mobile behavior. Commit this slice locally.

### Task 3: Responsive layout audit and correction

**Files:** `D:/IoT-web/src/components/layout/*`, confirmed Admin Device Health and Stations & Devices page styles, and only other pages proven affected by the browser audit.

**Interfaces:** Reuse existing spacing/width tokens; no API or DTO change.

- [ ] Capture/inspect the relevant pages at desktop and narrow viewport, naming the actual 4–5 affected pages rather than assuming them.
- [ ] Add a focused layout regression where the test tooling supports it; otherwise preserve before/after screenshots and viewport measurements.
- [ ] Correct container max-width, empty-state sizing, and responsive spacing in the smallest shared or page-specific CSS boundary.
- [ ] Recheck affected and adjacent pages at desktop and mobile, run frontend lint/build/tests, and commit this slice locally.

### Task 4: Recipient snapshot at first dispatch

**Files:** `prisma/schema.prisma`, one migration, `src/notifications/notification-delivery.worker.ts`, `test/integration/alert-config/notification-delivery.spec.ts`, `docs/superpowers/specs/2026-09-02-alert-config-design.md`, issue ledger.

**Interfaces:** Consume existing delivery job and eligible active Admin/Farmer scope; produce persisted `(lifecycleEventId, recipientUserId)` snapshot and resume-safe bounded delivery.

- [ ] Update the approved spec to say eligibility is evaluated exactly once when the worker first claims a job. Define revocation/grant behavior and retention cascade.
- [ ] Add failing database-backed tests: mid-job grant of a lower-ID user does not change the snapshot; mid-job revocation does not remove a queued recipient; restart/retry creates no duplicates.
- [ ] Run those tests and confirm failures caused by the current cursor-over-live-users logic.
- [ ] Add the smallest schema/migration and worker change: atomically materialize eligible IDs at first dispatch, then page only the snapshot. Preserve unique notifications and current inbox authorization.
- [ ] Verify migration against isolated test DB, focused integration tests, full `pnpm verify` and audit/diff checks; update issue ledger with evidence and commit only reviewed backend changes locally.

### Task 5: Cross-role review and handoff

**Files:** `D:/IoT-web/docs/internal-release-notes.md`, backend `tasks/todo.md`, backend issue ledger, only as required by verified outcomes.

- [ ] Run the Farmer browser matrix for Dashboard, Soil Dashboard, Historical Analysis, History Report, Alerts/Alert Center, Notifications; test scope loss, stale session, empty/error data, and refresh.
- [ ] Recheck Admin/Super Admin and Developer boundaries affected by the shared topbar; do not mark any role browser-verified without evidence.
- [ ] Run frontend tests/lint/build and backend focused/full gates after the final change; inspect exact staged diffs for secrets and unrelated edits.
- [ ] Commit local documentation/checkpoint changes. Do not push or deploy; report any incomplete gate and remaining risks.
