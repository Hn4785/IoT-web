# Phase B — authorized station data checkpoint

> Historical record: counts, pending steps and deployment holds describe this
> checkpoint/plan's dated scope. Current completion and release applicability
> are in [the task index](../../tasks/todo.md); do not rerun old seed or rollout steps.

Initial core evidence: 2026-09-10

Local completion accepted: 2026-09-30

Branch: `codex/integration-core`  
Implementation commits: `5802f1e..eeadfb4`  
Status: **complete locally**. The product owner accepted the integrated
Admin/Super Admin → Farmer → Client Developer flows on 2026-09-30. Deployment
follow-ups and the wider automated recovery matrix remain release gates, not
Phase B implementation blockers.

## Evidence

- `pnpm test`: 41 files, 219 tests passed.
- `pnpm test:coverage`: 41 files, 219 tests passed; 88.11% statements,
  78.58% branches, 92.59% functions and 89.74% lines.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`:
  passed.
- `pnpm db:status`: PostgreSQL `iot_dev` is up to date (1 migration).
- `pnpm ignored-builds`: no automatically ignored builds; only the configured
  `@scarf/scarf` entry.
- `git diff --check`: passed.

Admin and Farmer browser routes enforce Bearer identity and current hierarchy
scope. Client routes require an active Client Developer API key and use the
current intersection of account station grants and key station scopes. Tests
cover safe cross-scope denials, latest/history mapping, sparse fields, caching,
history bounds/cursors and per-key rate-limit/reset behavior.

## Completion follow-up

- The provider confirmed on 2026-09-28 that the connected CENTER/NODE feed is
  real sensor data; B-device is `live-verified` without storing its credential
  in evidence.
- Typed hierarchy, latest/history, dashboards, reports and Client API Explorer
  are connected without sample-data fallback.
- API Sources owns the only browser station-grant editor for both Farmer and
  Client Developer accounts. User Management edits roles and shows shared
  access read-only.
- Admin and Farmer use the shared Alert Center for rule configuration,
  lifecycle and in-app notifications. Rules do not write to physical devices.
- Client navigation contains Dashboard, API Access and API Tools. Change
  Password and Log out remain in the global account menu for all three roles.
- Frontend evidence recorded on 2026-09-30: 152/152 tests, lint and production
  build passed. Focused backend source-access tests passed 19/19 with lint and
  build; after Docker recovery PostgreSQL was healthy and `/health` plus
  `/readiness` returned HTTP 200.
- The accepted build was deployed to Pi staging on 2026-09-30 as
  `agrisense-api:d152337` and `agrisense-web:be73c29`. All 11 migrations already
  matched, LAN/public health and readiness returned HTTP 200, and the protected
  audit endpoint returned 401 without credentials. The previous `v2.5.6`
  images and the pre-rollout database/Compose backup remain the rollback path.

## Retained boundaries

- `pnpm audit --prod` reports one moderate `mysql2` advisory pulled through
  Prisma tooling. Runtime is PostgreSQL-only and no MySQL protocol path is used;
  this remains tracked for a controlled Prisma update and does not represent a
  reachable high/critical production finding.
- Node 24.17.0 LTS is installed under `E:\Dev\nvm`; the full test, typecheck,
  lint, format and build gate passed on this declared runtime.
- The full backend suite was not re-claimed in the final local pass because its
  parallel database setup timed out while Docker was wedged. Earlier core
  evidence above remains valid; the latest source-access slice uses focused
  regression evidence.
- FE-6 and QA-1 continue to track the broader automated responsive,
  accessibility, failure and recovery matrix for release hardening.
