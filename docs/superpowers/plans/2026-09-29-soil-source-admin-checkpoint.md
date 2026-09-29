# Soil Source Admin Checkpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Admin experience for soil-only sources, station-scoped sharing, alert configuration, safe source removal and simplified user administration.

**Architecture:** Keep the upstream credential owned by one managed `DataSource`, import only stations with valid soil payloads, and authorize shared reads through explicit station grants. Farm and Plot remain local hierarchy resources selected or created atomically with the source. Admin UI consumes the typed backend contract and stops at a verified Admin browser checkpoint.

**Tech Stack:** NestJS 12, Fastify 5, Prisma/PostgreSQL, Zod, Vitest, React 19, TypeScript and CSS modules.

**Spec:** `docs/superpowers/specs/2026-09-28-soil-source-admin-checkpoint-design.md`

## Global Constraints

- Use RED -> GREEN -> REFACTOR for every behavior change.
- Never log, expose or commit an upstream `X-API-Key`.
- Outbound source calls use only allowlisted HTTPS origins, fixed paths, bounded responses, redirect rejection and configured timeouts.
- `CENTER` and stations without a valid soil payload are never imported, counted, shared or offered for alert rules.
- Client Developer grants and platform API keys remain separate from managed source grants.
- Changed UI remains English, keyboard accessible and never displays `N/A`.
- Commit backend and frontend locally in atomic increments; never push.
- Stop after the complete Admin browser checkpoint. Farmer cleanup and Settings are not part of this plan.

---

### Task 1: Soil-only upstream discovery

**Files:**

- Create: `src/data-sources/source-upstream.service.spec.ts`
- Modify: `src/data-sources/source-upstream.service.ts`
- Reuse: `src/integrations/weather/contracts.ts`

**Interfaces:**

- Produces: `discoverSoilStations(baseUrl: string, xApiKey: string): Promise<readonly string[]>`
- Replaces source creation and connection-test use of `listStations`.

- [ ] **Step 1: Write failing discovery tests**

```ts
it('returns only station codes with a numeric latest soil field', async () => {
  mockStations(['CENTER', 'NODE01', 'NODE02']);
  mockLatest([
    { station: 'CENTER', latest: { weather: weatherSample } },
    { station: 'NODE01', latest: { soil: soilSample } },
    { station: 'NODE02', latest: { water: waterSample } },
  ]);
  await expect(service.discoverSoilStations(baseUrl, key)).resolves.toEqual(['NODE01']);
});

it('rejects a source with no eligible soil station', async () => {
  mockStations(['CENTER']);
  mockLatest([{ station: 'CENTER', latest: { weather: weatherSample } }]);
  await expect(service.discoverSoilStations(baseUrl, key)).rejects.toMatchObject({
    code: 'NOT_SOIL_SOURCE',
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- src/data-sources/source-upstream.service.spec.ts`

Expected: FAIL because `discoverSoilStations` does not exist.

- [ ] **Step 3: Implement the fixed-path discovery call**

```ts
async discoverSoilStations(baseUrl: string, xApiKey: string): Promise<readonly string[]> {
  const codes = await this.listStations(baseUrl, xApiKey);
  const latest = await this.getJson(`${baseUrl}/data/latest`, {
    station: codes.join(','),
    type: 'soil',
  });
  return selectEligibleSoilCodes(codes, parseWeatherLatestResponse(latest).data);
}
```

The helper must use `URLSearchParams`, the existing one-MiB limit, timeout, redirect rejection and safe `AppError` mapping. A valid soil payload contains at least one finite numeric member from `SOIL_FIELDS`.

- [ ] **Step 4: Verify GREEN and regression safety**

Run: `pnpm test -- src/data-sources/source-upstream.service.spec.ts src/integrations/weather/contracts.spec.ts`

Expected: both suites pass with no secret values in snapshots or errors.

- [ ] **Step 5: Commit**

```text
feat: admit only soil observation stations
```

### Task 2: Atomic Farm/Plot select-or-create source creation

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260929090000_source_hierarchy_names/migration.sql`
- Modify: `src/data-sources/data-source.contracts.ts`
- Modify: `src/data-sources/data-source.service.ts`
- Modify: `src/data-sources/data-source.repository.ts`
- Test: existing data-source HTTP integration test file discovered with `rg "POST /api/v1/data-sources" src test`

**Interfaces:**

- Consumes one hierarchy choice per level:

```ts
type ResourceChoice = { id: string } | { name: string };
type CreateDataSourceInput = {
  name?: string;
  baseUrl: string;
  xApiKey: string;
  farm: ResourceChoice;
  plot: ResourceChoice;
};
```

- Produces a source only after external validation; new hierarchy and imported stations commit atomically.

- [ ] **Step 1: Write failing contract and HTTP tests** for existing/existing, new/new, existing/new, normalized duplicate names, concurrent duplicate creation, invalid soil/no-write and Farmer authorization.
- [ ] **Step 2: Verify RED** with the focused data-source suite; failures must be contract or behavior failures rather than setup errors.
- [ ] **Step 3: Add normalized hierarchy keys and constraints**

```prisma
model Farm {
  normalizedName String @unique @db.VarChar(160)
}

model Plot {
  normalizedName String @db.VarChar(160)
  @@unique([farmId, normalizedName])
}
```

The forward migration backfills normalized names deterministically and fails on pre-existing collisions instead of discarding data.

- [ ] **Step 4: Implement one serializable repository transaction** that resolves or creates the Farm and Plot, verifies scope, creates the source, imports only discovered NODEs and records the audit event. Map unique races to the existing row and never perform upstream I/O inside the transaction.
- [ ] **Step 5: Verify GREEN**

Run: `pnpm db:generate && pnpm test -- test/integration/data-sources/create-list.spec.ts && pnpm typecheck && pnpm security:secrets`

- [ ] **Step 6: Commit**

```text
feat: create source hierarchy atomically
```

### Task 3: Station-scoped source grants and read authorization

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260929100000_station_scoped_source_grants/migration.sql`
- Modify: `src/data-sources/data-source.contracts.ts`
- Modify: `src/data-sources/data-source.controller.ts`
- Modify: `src/data-sources/data-source.service.ts`
- Modify: `src/data-sources/data-source.repository.ts`
- Modify: `src/station-data/station.repository.ts`
- Test: data-source and station authorization integration suites.

**Interfaces:**

```ts
type SetSourceGrantInput = { stationIds: readonly string[] };
type DataSourceGrantDto = {
  user: { id: string; displayName: string; email: string };
  stationIds: readonly string[];
  createdAt: string;
};
```

Routes:

```text
PUT    /api/v1/data-sources/:sourceId/grants/:userId/stations
DELETE /api/v1/data-sources/:sourceId/grants/:userId/stations/:stationId
DELETE /api/v1/data-sources/:sourceId/grants/:userId
```

- [ ] **Step 1: Write failing owner/grantee/oversight tests** covering subset reads, cross-station denial, immediate single-station revoke, whole-account revoke, non-owner denial and Client Developer rejection.
- [ ] **Step 2: Verify RED** with focused data-source and station-data suites.
- [ ] **Step 3: Add `DataSourceGrantStation`** with a composite relation to `DataSourceGrant` and a station relation. Backfill every existing source grant with all current stations so the migration does not silently remove access.
- [ ] **Step 4: Implement strict grant DTOs and fail-closed read predicates**. Admin oversight may read all active sources but never owns, reveals, removes or changes grants on another owner's source.
- [ ] **Step 5: Verify GREEN**

Run: `pnpm db:generate && pnpm test -- test/integration/data-sources/access-management.spec.ts test/integration/station-data/hierarchy.spec.ts test/integration/station-data/latest.spec.ts test/integration/station-data/history.spec.ts && pnpm typecheck && pnpm lint`

- [ ] **Step 6: Commit**

```text
feat: scope source sharing to stations
```

### Task 4: Shared alert visibility and recipients

**Files:**

- Modify: `src/alert-config/alert-rule.service.ts`
- Modify: `src/alert-config/alert-lifecycle.service.ts`
- Modify: `src/alert-config/alert-evaluation.service.ts`
- Modify: `src/notifications/notification-delivery.worker.ts`
- Modify: `src/station-data/soil-metadata.provider.ts`
- Modify: `src/station-data/browser.controller.ts`
- Test: alert rule, lifecycle, evaluator and notification delivery suites.

**Interfaces:**

- Produce: `GET /api/v1/stations/:stationId/field-metadata` with confirmed field, unit and revision values.
- Owner may mutate a rule; a station grantee may list/read the station's rules and alerts only.
- Notification recipients are the source owner plus active accounts granted that station at delivery resolution time.

- [ ] **Step 1: Write failing tests** for grantee read-only access, non-granted denial, owner-only mutation, future-notification removal after revoke and metadata response exclusion when unconfirmed.
- [ ] **Step 2: Verify RED** with focused alert and notification suites.
- [ ] **Step 3: Implement a shared station-access predicate** and change recipient resolution from Farm membership to source owner plus active station grants. Keep historical delivered notifications unchanged.
- [ ] **Step 4: Add the safe metadata endpoint**

```ts
type SoilFieldMetadataDto = {
  fields: readonly { field: SoilField; unit: string; metadataRevision: string }[];
};
```

- [ ] **Step 5: Verify GREEN**

Run: `pnpm test -- src/alert-config src/notifications src/station-data && pnpm typecheck && pnpm lint`

- [ ] **Step 6: Commit**

```text
feat: route alerts through source station grants
```

### Task 5: Recoverable source removal

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260929110000_recoverable_source_removal/migration.sql`
- Modify: `src/data-sources/data-source.controller.ts`
- Modify: `src/data-sources/data-source.service.ts`
- Modify: `src/data-sources/data-source.repository.ts`
- Modify: alert resolution enum/contracts where needed.
- Create: `test/integration/data-sources/removal.spec.ts`
- Test: `test/integration/alert-config/rules.spec.ts`

**Interfaces:**

- Produce: idempotent `DELETE /api/v1/data-sources/:sourceId`.
- Add `DataSource.removedAt`; active queries require `removedAt: null`.

- [ ] **Step 1: Write failing tests** for owner-only removal, Admin oversight denial, idempotent retry, grant revocation, credential erasure, rule disabling, alert resolution and rollback on failure.
- [ ] **Step 2: Verify RED** with focused data-source tests.
- [ ] **Step 3: Implement one serializable removal transaction** that sets `removedAt`, clears ciphertext/nonce/tag/preview, removes grants, disables rules, resolves open alerts with `SOURCE_REMOVED`, and records a secret-free audit event.
- [ ] **Step 4: Verify GREEN**

Run: `pnpm db:generate && pnpm test -- test/integration/data-sources/removal.spec.ts test/integration/alert-config/rules.spec.ts && pnpm typecheck && pnpm security:secrets`

- [ ] **Step 5: Commit**

```text
feat: remove managed sources recoverably
```

### Task 6: Protected account deletion and read-only shared access

**Files:**

- Modify: `src/identity/identity.contracts.ts`
- Modify: `src/identity/identity.controller.ts`
- Modify: `src/identity/identity.service.ts`
- Modify: `src/identity/identity.repository.ts`
- Modify: `src/identity/retention.service.ts`
- Test: identity HTTP/integration and retention suites.

**Interfaces:**

- Produce: `DELETE /api/v1/admin/users/:userId` for the current Super Admin only.
- Extend `UserDetailDto` with read-only `sharedSources`, each containing only safe source identity and granted soil stations.

- [ ] **Step 1: Write failing tests** for non-Super-Admin denial, self/current-holder rejection, disabled login, session/API-key/source-grant revocation, audit preservation and read-only shared-access DTOs.
- [ ] **Step 2: Verify RED** with focused identity suites.
- [ ] **Step 3: Implement deletion request** by setting `status=DISABLED` and `deletionRequestedAt`, revoking credentials/access in the same transaction and preserving existing 90-day retention anonymization.
- [ ] **Step 4: Verify GREEN**

Run: `pnpm test -- src/identity src/auth && pnpm typecheck && pnpm lint && pnpm security:secrets`

- [ ] **Step 5: Commit**

```text
feat: protect administrative account deletion
```

### Task 7: Admin API Sources and Dashboard UI

**Files:**

- Modify: `D:/IoT-web/src/services/dataSourceService.ts`
- Modify: `D:/IoT-web/src/pages/admin/ApiSources.tsx`
- Modify: `D:/IoT-web/src/pages/admin/ApiSources.module.css`
- Modify: `D:/IoT-web/src/pages/admin/AdminDashboard.tsx`
- Modify: `D:/IoT-web/src/pages/admin/AdminDashboard.module.css`
- Modify: `D:/IoT-web/test/dataSourceService.test.ts`
- Modify: `D:/IoT-web/test/adminDataSourcesUx.test.ts`
- Modify: `D:/IoT-web/test/uiRegression.test.ts`

**Interfaces:** Consumes Tasks 1-5. Produces direct source entry, Farm/Plot select-or-create, station-scoped Manage Access, chart-icon View Data, owner-only Remove Source and truthful dashboard totals.

- [ ] **Step 1: Write failing UI/service tests** proving paste controls are absent, each hierarchy choice encodes by ID or name, selected station IDs reach the grant endpoint, owner-only actions render, confirmations are present and `CENTER` is absent from counts/selectors.
- [ ] **Step 2: Verify RED**

Run: `pnpm test -- test/dataSourceService.test.ts test/adminDataSourcesUx.test.ts test/uiRegression.test.ts`

- [ ] **Step 3: Implement the direct-entry modal** with `Source name`, `API URL`, `X-API-Key`, searchable select-or-create Farm and Plot controls and safe disabled/loading/error states.
- [ ] **Step 4: Implement station-scoped Manage Access and source removal**, using icons with accessible text/labels. Do not expose a key to a grantee or oversight Admin.
- [ ] **Step 5: Simplify the Dashboard** to `Farms`, `Plots`, `Soil Stations`, `Users`; hide unsupported operational health and use plain empty states.
- [ ] **Step 6: Verify GREEN**

Run: `pnpm test -- test/dataSourceService.test.ts test/adminDataSourcesUx.test.ts test/uiRegression.test.ts && pnpm typecheck && pnpm lint && pnpm build`

- [ ] **Step 7: Commit locally without pushing**

```text
feat: complete Admin soil source management
```

### Task 8: Admin alert rules and User Management UI

**Files:**

- Modify: `D:/IoT-web/src/pages/admin/AdminAlertCenter.tsx`
- Modify: `D:/IoT-web/src/pages/admin/AdminAlertCenter.module.css`
- Modify: `D:/IoT-web/src/pages/admin/UserManagement.tsx`
- Modify: `D:/IoT-web/src/pages/admin/UserManagement.module.css`
- Modify: related alert/user services and focused tests discovered with `rg "AdminAlertCenter|UserManagement" D:/IoT-web/test`.

**Interfaces:** Consumes Tasks 4 and 6. Edit User mutates role only and displays shared resources read-only. Delete Account is separate and Super-Admin-only. Rule creation derives unit/revision from confirmed metadata.

- [ ] **Step 1: Write failing component/service tests** for role-only editing, read-only sources/stations, separate delete confirmation, protected action visibility, metadata-driven rule creation and shared-account read-only rules.
- [ ] **Step 2: Verify RED** with the focused frontend test files.
- [ ] **Step 3: Simplify User Management** by removing display name, email, status, Farm membership and legacy station-grant mutation from Edit User; retain independent enable/disable, recovery, transfer and delete actions where authorized.
- [ ] **Step 4: Implement the owner rule form** with Station, Measurement, condition, thresholds, severity and enabled state. Do not render a device-write or calibration action.
- [ ] **Step 5: Verify GREEN**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`

- [ ] **Step 6: Commit locally without pushing**

```text
feat: finish Admin rules and account controls
```

### Task 9: Admin checkpoint verification

**Files:**

- Modify: `tasks/todo.md`
- Modify: `docs/checkpoints/<date>-admin-soil-source.md`

- [ ] **Step 1: Run the complete backend gate**

Run: `pnpm test && pnpm format:check && pnpm typecheck && pnpm lint && pnpm build && pnpm db:status && pnpm security:secrets`

- [ ] **Step 2: Run the complete frontend gate**

Run in `D:/IoT-web`: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`

- [ ] **Step 3: Run the Admin browser matrix** at 320px, 768px, 1024px and 1440px. Verify Dashboard, Stations & Devices, API Sources, Alert Center, Users and Audit Log; check keyboard navigation, responsive layout, network authorization and zero console errors.
- [ ] **Step 4: Record evidence** including commands, test totals, browser routes and any explicitly deferred non-Admin work.
- [ ] **Step 5: Commit checkpoint documentation locally and stop before Farmer/Settings**

```text
docs: record Admin soil source checkpoint
```
