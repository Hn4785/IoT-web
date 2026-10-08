# Data Source Access Implementation Plan

Status: **completed locally and accepted by the product owner on 2026-09-30**.
This file preserves the original execution sequence; unchecked boxes below are
historical plan steps, not open product work. Current completion evidence lives
in [`2026-09-10-phase-b-core.md`](../../checkpoints/2026-09-10-phase-b-core.md)
and the remaining release gates live in [`tasks/todo.md`](../../../tasks/todo.md).

**Goal:** Add securely owned and shared upstream API sources, then connect the existing Admin and Farmer monitoring UI without exposing credentials.

**Architecture:** PostgreSQL stores source ownership, grants, discovered stations, and AES-GCM encrypted upstream credentials. Existing station DTOs stay stable; station reads resolve an internal source-specific Weather client. Frontend parsing is local and sends only extracted URL/key fields.

**Tech Stack:** NestJS 12, Fastify 5, Prisma/PostgreSQL, Zod, Vitest, React 19, TypeScript, CSS modules.

**Spec:** `docs/design/specs/2026-09-28-data-source-access-design.md`

## Global Constraints

- Never log, document, commit, or expose an upstream key or pasted chat message.
- Frontend remains English and does not use `N/A` on changed surfaces.
- Client Developer platform keys remain separate from upstream source keys.
- Frontend commits stay local and are not pushed.
- Each behavior follows RED -> GREEN -> REFACTOR and each slice is committed atomically.

---

### Task 1: Encrypted source persistence boundary

**Files:** Prisma schema/migration, runtime config, a focused source-secret service and their tests.

**Interfaces:** Produces `DataSource`, `DataSourceGrant`, `Station.dataSourceId`, validated `dataSourceEncryptionKey` and `dataSourceAllowedOrigins`, plus `encrypt`/`decrypt` methods that never return persistence fields through DTOs.

- [ ] Add failing runtime-config tests for a missing/invalid 32-byte encryption key and malformed/non-HTTPS allowed origins.
- [ ] Run the focused tests and confirm the expected validation failures.
- [ ] Add failing crypto tests proving randomized ciphertext, round-trip decryption, and authentication failure on tampering.
- [ ] Run the focused tests and confirm the service is absent.
- [ ] Add the minimal runtime fields, AES-256-GCM service, Prisma models, and forward migration with one immutable system source for existing stations.
- [ ] Run config, crypto, migration, typecheck, and secret-scan checks; inspect the migration for destructive statements.
- [ ] Commit the verified persistence slice.

### Task 2: Source creation and safe listing

**Files:** New `data-sources` contracts/repository/service/controller/module plus real HTTP integration tests and app module registration.

**Interfaces:** Produces `POST /api/v1/data-sources`, `GET /api/v1/data-sources`, `GET /api/v1/data-sources/:id`, and safe `DataSourceDto` values from the approved spec.

- [ ] Write failing HTTP tests for Admin/Farmer creation, Client denial, allowlisted origin enforcement, invalid key/no-write behavior, owner/grantee/Admin listing, pagination, and DTO secret exclusion.
- [ ] Run the focused suite and verify every failure is caused by missing routes/behavior.
- [ ] Implement strict Zod contracts, repository transactions, source-specific fixed-path upstream client, and controller guards.
- [ ] Run the focused suite, then station-data/auth regressions.
- [ ] Add OpenAPI assertions proving no secret examples or persistence fields are exposed.
- [ ] Commit the verified create/list slice.

### Task 3: Access grants and owner-only reveal

**Files:** Extend data-source contracts/service/controller/repository, password verification, audit allowlist, and integration tests.

**Interfaces:** Produces test/reveal/grant-list/grant-put/grant-delete routes from the spec. Grant removal immediately changes Farmer station scope.

- [ ] Write failing owner/non-owner/Admin oversight/Client tests for grant and revoke behavior.
- [ ] Write failing reveal tests for current-password confirmation, owner-only access, secret-free audit metadata, and stable safe errors.
- [ ] Run focused tests and confirm expected authorization failures.
- [ ] Implement minimal grant/reveal logic using current policy, password service, retrying transactions, and audit service.
- [ ] Run focused tests and all identity/station authorization regressions.
- [ ] Commit the verified access-management slice.

### Task 4: Route station telemetry by source

**Files:** Weather client factory/internal interface, station repository/service, cache-key tests, and latest/history integration tests.

**Interfaces:** Existing public station/latest/history DTOs remain byte-compatible; internal station lookup provides source credentials to fixed upstream paths.

- [ ] Write failing tests with two fake upstream origins using the same station code and different values.
- [ ] Verify the current singleton Weather client causes the expected failure.
- [ ] Implement source resolution, origin/key decryption at the last responsible moment, per-source cache keys, and immutable system-source fallback.
- [ ] Run latest/history/client/alert regressions and verify credentials never enter errors or cache values.
- [ ] Commit the verified multi-source read slice.

### Task 5: Admin API Sources UI

**Files:** Frontend source DTO/service/parser, Admin page/components/styles/routes/sidebar, tests, integration guide, and `tasks/todo.md`.

**Interfaces:** Consumes the approved data-source routes. Produces English `API Sources` UI with local paste parsing, list columns, owner-only actions, shared monitoring link, and truthful states.

- [ ] Write failing parser tests for plain text, curl and JSON plus invalid/no-key input; assert original pasted text is not passed to the API service.
- [ ] Write failing component/route tests for `Visible Accounts`, owner-only reveal/manage actions, Admin oversight, error/empty copy, and no `N/A`.
- [ ] Implement the smallest UI using incumbent components and CSS tokens; do not add a new visual system.
- [ ] Run focused tests, typecheck, lint, build, and the Impeccable detector over changed targets.
- [ ] Commit locally; do not push.

### Task 6: Farmer owned/shared sources and shared monitoring

**Files:** Farmer routes/sidebar/pages, shared monitoring container, tests, integration guide, and tài liệu bàn giao.

**Interfaces:** Reuses Task 5 parser/source components and existing latest/history services. Farmer sees owned and shared sources; only owned rows expose manage/reveal actions.

- [ ] Write failing role/route/component tests for owner versus grantee behavior and immediate revoked-access handling.
- [ ] Extract the existing Farmer data presentation into a shared monitor consumed by Admin and Farmer without changing DTOs.
- [ ] Implement Farmer source list/add flow and simple English states.
- [ ] Run focused and shared UI regressions; commit locally without push.

### Task 7: Client cleanup and final Settings gate

**Files:** Client navigation/pages, account Settings page, route tests, integration guide, tài liệu bàn giao, and browser evidence.

**Interfaces:** Client upstream-source sharing stays absent. Settings contains only account information, change password and logout.

- [ ] Remove or hide unsupported duplicate Client surfaces while preserving approved API key, docs and explorer contracts.
- [ ] Add the minimal Settings route and tests without device/configuration toggles.
- [ ] Run Admin -> Farmer -> Client responsive browser matrix, session/authorization negatives, console checks, full frontend quality gates, and backend full verification.
- [ ] Commit frontend locally and record Phase B completion evidence; do not push frontend.
