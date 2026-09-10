# Phase B-core backend checkpoint

Date: 2026-09-10  
Branch: `codex/integration-core`  
Implementation commits: `5802f1e..eeadfb4`  
Status: backend contract verified; not pushed or merged.

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

## Known boundaries

- `pnpm audit --prod` reports one moderate `mysql2` advisory pulled through
  Prisma tooling. Runtime is PostgreSQL-only and no MySQL protocol path is used;
  this remains tracked for a controlled Prisma update and does not represent a
  reachable high/critical production finding.
- Node 24.17.0 LTS is installed under `E:\Dev\nvm`; the full test, typecheck,
  lint, format and build gate passed on this declared runtime.
- Frontend replacement of station/soil mocks is not verified, so the shared
  Checkpoint B-core remains open.
- B-device remains open until CENTER metadata and at least one real station are
  verified against the live upstream API.
