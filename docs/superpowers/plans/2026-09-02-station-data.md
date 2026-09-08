# Station Data B-core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose authorized farm, plot, station, latest-soil and bounded history APIs to browser and Client Developer callers without persisting measurements or leaking the Weather API boundary.

**Architecture:** Browser Bearer routes and Client API-key routes remain separate trust boundaries. Both resolve an authorized registry station and call one `StationDataService`, which validates and maps Weather responses into explicit DTOs, then uses bounded in-memory cache/coalescing. PostgreSQL stores only hierarchy and authorization; sensor time series remain upstream.

**Tech Stack:** Node.js 24, TypeScript 6 strict mode, NestJS 12 with Fastify 5, Prisma 7/PostgreSQL, Zod 4, Vitest 4, existing controlled Weather client and fake HTTP upstream.

**Spec:** `docs/superpowers/specs/2026-09-02-station-data-design.md`

## Global Constraints

- Work only in `D:/IoT-api/.worktrees/integration-core` on local branch `codex/integration-core`; do not push or merge.
- Read `AGENTS.md`, `CAPABILITY-MAP.md` and the approved station-data spec before each execution session.
- Use TDD for every behavior: focused RED, confirm the expected failure, minimal GREEN, refactor while green, then an atomic commit.
- Public prefix is `/api/v1`; success and error envelopes remain unchanged.
- Browser data requires a current Bearer principal. Admin sees the current registry; Farmer sees current farm memberships; Client Developer Bearer access is forbidden.
- Client data requires `X-API-Key`; effective scope is the intersection of active owner, current account grant and current key scope.
- Weather host and credential remain owned by `integration-core`; request data can select only a database-resolved `Station.upstreamCode`.
- Soil fields are exactly `temperature`, `moisture`, `ec`, `ph`, `nitrogen`, `phosphorus`, `potassium`, `light`.
- Preserve upstream numeric values; B-core returns `unit`, `sensorId` and `depthCm` as `null`.
- While installation keeps the upstream API unavailable, use the approved API Guide response JSON as the sample contract and label the resulting evidence `sample-verified`.
- Cover the planned `CENTER` plus `NODE01` through `NODE06` topology as compatibility fixtures without hardcoding it as the permanent registry. The six node stations share one JSON structure; `CENTER` behavior remains unverified.
- Do not add measurement tables, Redis, WebSockets, SSE, alerts, reports, weather/water DTOs or hardware configuration.
- Test database target must remain exactly `/iot_test`; demo seed target must remain exactly `/iot_dev`.
- New dependencies, auth-flow changes, CORS changes and externally visible contract changes require a spec update and user approval first.

## File Structure

```text
src/station-data/station-data.contracts.ts  HTTP/query schemas, DTOs and OpenAPI schemas
src/station-data/cursor.ts                  strict opaque hierarchy/history cursor codec
src/station-data/station.repository.ts      scoped registry queries and station-code resolution
src/station-data/hierarchy.service.ts       browser/client hierarchy orchestration
src/station-data/browser.controller.ts      Bearer hierarchy/latest/history routes
src/station-data/soil.mapper.ts             pure latest/history validation and normalization
src/station-data/soil-metadata.provider.ts  internal confirmed/unconfirmed metadata boundary
src/station-data/bounded-cache.ts           LRU, TTL, coalescing and stale-if-error primitive
src/station-data/station-data.service.ts     Weather query, cache and DTO orchestration
src/station-data/client.controller.ts       X-API-Key station/latest/history routes
src/station-data/client-rate-limit.guard.ts per-key process-local limiter and response headers
src/station-data/station-data.module.ts      module wiring and injectable clock/cache boundaries
src/station-data/seed-station-demo.ts        explicit idempotent iot_dev seed command
test/helpers/access-token.ts                 reusable integration-test access-token issuer
test/integration/station-data/*.spec.ts      real HTTP and PostgreSQL contract tests
```

Existing files changed by the plan:

```text
src/app/app.module.ts
src/api-keys/api-key.guard.ts
src/api-keys/api-key.service.ts
src/api-keys/api-key.module.ts
src/common/errors/app-error.ts
src/config/runtime-config.ts
src/config/runtime-config.spec.ts
src/integrations/weather/contracts.ts
src/integrations/weather/contracts.spec.ts
src/integrations/weather/weather-client.service.ts
src/integrations/weather/weather-client.service.spec.ts
test/helpers/database.ts
test/helpers/runtime-config.ts
package.json
.env.example
README.md
tasks/todo.md
docs/checkpoints/2026-09-03-b1.md
docs/checkpoints/2026-09-03-phase-b-core.md
```

---

### Task 1: Shared Station Contracts and Opaque Cursors

**Files:**

- Create: `src/station-data/station-data.contracts.ts`
- Create: `src/station-data/cursor.ts`
- Create: `src/station-data/cursor.spec.ts`
- Create: `test/helpers/access-token.ts`

**Interfaces:**

- Consumes: existing `AppError`, Prisma `UserRole`, JWT test configuration.
- Produces:

```ts
export const SOIL_FIELDS: readonly SoilField[];
export type SoilField =
  'temperature' | 'moisture' | 'ec' | 'ph' | 'nitrogen' | 'phosphorus' | 'potassium' | 'light';
export type CursorPage<T> = Readonly<{ items: readonly T[]; nextCursor: string | null }>;
export type FarmDto = Readonly<{ id: string; name: string }>;
export type PlotDto = Readonly<{ id: string; farmId: string; name: string }>;
export type StationDto = Readonly<{
  id: string;
  farmId: string;
  plotId: string;
  name: string;
  code: string;
}>;
export type HierarchyQuery = Readonly<{ limit: number; cursor?: string }>;
export function parseHierarchyQuery(value: unknown): HierarchyQuery;
export function parseUuid(value: unknown): string;
export function encodeCursor(value: CursorPayload): string;
export function decodeCursor<K extends CursorKind>(
  value: string,
  expectedKind: K,
): Extract<CursorPayload, { kind: K }>;
export async function issueAccessToken(input: {
  prisma: PrismaClient;
  config: RuntimeConfig;
  userId: string;
}): Promise<string>;
```

Cursor union:

```ts
export type CursorPayload =
  | { v: 1; kind: 'farm'; name: string; id: string }
  | { v: 1; kind: 'plot'; parentId: string; name: string; id: string }
  | { v: 1; kind: 'station'; parentId: string; name: string; id: string }
  | { v: 1; kind: 'client-station'; name: string; id: string }
  | {
      v: 1;
      kind: 'soil-history';
      queryFingerprint: string;
      boundaryTime: string;
      boundaryFingerprint: string;
      boundaryOccurrence: number;
    };

export type CursorKind = CursorPayload['kind'];
```

- [ ] **Step 1: Write strict cursor RED tests**

```ts
import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor.js';

describe('station-data cursor codec', () => {
  it('round-trips a bounded typed hierarchy cursor', () => {
    const encoded = encodeCursor({ v: 1, kind: 'farm', name: 'Farm A', id: crypto.randomUUID() });
    expect(decodeCursor(encoded, 'farm')).toMatchObject({ v: 1, kind: 'farm', name: 'Farm A' });
    expect(encoded).not.toContain('Farm A');
  });

  it.each(['', 'not-base64', Buffer.from('{}').toString('base64url'), 'x'.repeat(2049)])(
    'rejects malformed cursor %s',
    (cursor) =>
      expect(() => decodeCursor(cursor, 'farm')).toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
      ),
  );

  it('rejects a cursor from another route kind', () => {
    const cursor = encodeCursor({ v: 1, kind: 'farm', name: 'A', id: crypto.randomUUID() });
    expect(() => decodeCursor(cursor, 'plot')).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm test src/station-data/cursor.spec.ts`

Expected: FAIL because `cursor.ts` and its exports do not exist.

- [ ] **Step 3: Implement bounded cursor and query contracts**

Use strict Zod cursor variants, a maximum encoded length of 2048 and
`Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')`. Decode in a
try/catch, validate the discriminated union, require the expected kind and map
every failure to:

```ts
throw new AppError('VALIDATION_ERROR', 400, 'Cursor is invalid');
```

History fingerprint fields are lowercase 64-character SHA-256 hex strings;
`boundaryOccurrence` is an integer from 1 through 5000.

`parseHierarchyQuery` must accept unknown Fastify query input, default `limit`
to 50, bound it to 1..100, reject extra keys and allow a cursor of 1..2048
characters. `parseUuid` maps every Zod failure to the existing safe validation
error. Export OpenAPI schemas beside the runtime schemas so controller metadata
does not duplicate limits.

- [ ] **Step 4: Add the reusable access-token test helper**

Move the proven session-plus-JWT sequence from
`test/integration/identity/scopes.spec.ts` into `issueAccessToken`. It must create
a current 15-minute session and sign issuer `iot-api`, audience `iot-web`, subject
user ID and `sessionId` with `config.jwtSecret`. Do not alter existing tests in
this task.

- [ ] **Step 5: Run focused verification**

Run: `pnpm test src/station-data/cursor.spec.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src/station-data/station-data.contracts.ts src/station-data/cursor.ts src/station-data/cursor.spec.ts test/helpers/access-token.ts
git commit -m "feat: define station data contracts"
```

---

### Task 2: Authorized Browser Hierarchy

**Files:**

- Create: `src/station-data/station.repository.ts`
- Create: `src/station-data/hierarchy.service.ts`
- Create: `src/station-data/browser.controller.ts`
- Create: `src/station-data/station-data.module.ts`
- Create: `test/integration/station-data/hierarchy.spec.ts`
- Modify: `src/app/app.module.ts`

**Interfaces:**

- Consumes: `AccessTokenGuard`, `CurrentPrincipalValue`, Task 1 DTO/query/cursor contracts, existing Prisma hierarchy.
- Produces:

```ts
export class StationRepository {
  listFarms(principal: CurrentPrincipalValue, query: HierarchyQuery): Promise<CursorPage<FarmDto>>;
  listPlots(
    principal: CurrentPrincipalValue,
    farmId: string,
    query: HierarchyQuery,
  ): Promise<CursorPage<PlotDto>>;
  listStations(
    principal: CurrentPrincipalValue,
    plotId: string,
    query: HierarchyQuery,
  ): Promise<CursorPage<StationDto>>;
  getStation(principal: CurrentPrincipalValue, stationId: string): Promise<StationDto | null>;
  getAuthorizedStation(
    principal: CurrentPrincipalValue,
    stationId: string,
  ): Promise<AuthorizedStation | null>;
}

export type AuthorizedStation = Readonly<StationDto & { upstreamCode: string }>;

export class HierarchyService {
  listFarms(principal: CurrentPrincipalValue, query: HierarchyQuery): Promise<CursorPage<FarmDto>>;
  listPlots(
    principal: CurrentPrincipalValue,
    farmId: string,
    query: HierarchyQuery,
  ): Promise<CursorPage<PlotDto>>;
  listStations(
    principal: CurrentPrincipalValue,
    plotId: string,
    query: HierarchyQuery,
  ): Promise<CursorPage<StationDto>>;
  getStation(principal: CurrentPrincipalValue, stationId: string): Promise<StationDto>;
}
```

- [ ] **Step 1: Write HTTP RED tests for Admin, Farmer and Client Developer**

Create two farms, one plot/station under each, one Admin, one Farmer assigned only
to farm A and one Client Developer. Issue real tokens with Task 1's helper. Assert:

```ts
expect((await get('/api/v1/farms', adminToken)).json().data.items).toHaveLength(2);
expect((await get('/api/v1/farms', farmerToken)).json().data.items).toEqual([
  expect.objectContaining({ id: farmA.id }),
]);
expect((await get(`/api/v1/farms/${farmB.id}/plots`, farmerToken)).statusCode).toBe(404);
expect((await get(`/api/v1/stations/${stationB.id}`, farmerToken)).statusCode).toBe(404);
expect((await get('/api/v1/farms', clientToken)).statusCode).toBe(403);
```

Add 105 deterministically named farms and assert the default page contains 50,
the cursor page has no duplicate IDs, and changing a farm cursor into a plot
route returns `400 VALIDATION_ERROR`.

- [ ] **Step 2: Run hierarchy integration test and confirm RED**

Run: `pnpm test test/integration/station-data/hierarchy.spec.ts`

Expected: FAIL with 404 because station-data routes are not registered.

- [ ] **Step 3: Implement scoped keyset queries**

`StationRepository` must order every list by `{ name: 'asc' }, { id: 'asc' }`,
fetch `limit + 1`, emit a cursor from the last returned item and never load an
unbounded collection. A continuation filter is exactly `(name > cursor.name) OR
(name = cursor.name AND id > cursor.id)`. Plot/station cursor `parentId` must
equal the route parent ID or parsing returns `400 VALIDATION_ERROR`. Apply these
Prisma conditions in the query itself:

```ts
const farmScope =
  principal.role === 'ADMIN'
    ? {}
    : principal.role === 'FARMER'
      ? { memberships: { some: { userId: principal.userId } } }
      : { id: '00000000-0000-4000-8000-000000000000' };

const stationScope =
  principal.role === 'ADMIN'
    ? {}
    : principal.role === 'FARMER'
      ? { plot: { farm: { memberships: { some: { userId: principal.userId } } } } }
      : { id: '00000000-0000-4000-8000-000000000000' };
```

The service first requires `principal.status === 'ACTIVE'` and role ADMIN or
FARMER. Client Developer receives `403 FORBIDDEN`. Missing and out-of-scope
parents/items both become `404 NOT_FOUND`. Map `upstreamCode` only to public
`code`; never return it under its database name.

- [ ] **Step 4: Implement four Bearer routes**

Register `StationDataModule` in `AppModule`. Apply `@UseGuards(AccessTokenGuard)`,
`@ApiBearerAuth()` and exact route/query/UUID OpenAPI metadata. Controllers parse
all input through Task 1 contracts and return:

```ts
return { success: true, data: await this.hierarchy.listFarms(principal, query) };
```

Repeat the same envelope for plots, stations and station detail. Controllers do
not query Prisma or Weather.

`StationDataModule` imports `AuthModule` for `AccessTokenGuard`. Task 6 adds
`WeatherModule`; Task 8 adds `ApiKeyModule`. It exports `StationRepository`,
`HierarchyService` and, after Task 6, `StationDataService` plus the metadata
provider token.

- [ ] **Step 5: Run focused tests and authorization regression**

Run:

```powershell
pnpm test test/integration/station-data/hierarchy.spec.ts test/integration/identity/scopes.spec.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```powershell
git add src/station-data src/app/app.module.ts test/integration/station-data/hierarchy.spec.ts
git commit -m "feat: expose authorized station hierarchy"
```

---

### Task 3: Safe Development Registry Seed and Checkpoint B1

**Files:**

- Create: `src/station-data/seed-station-demo.ts`
- Create: `src/station-data/seed-station-demo.spec.ts`
- Create: `docs/checkpoints/2026-09-03-b1.md`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `tasks/todo.md`

**Interfaces:**

- Consumes: validated `DATABASE_URL`, existing Prisma Farm/Plot/Station models.
- Produces: `pnpm db:seed-station-demo -- --confirm-demo-seed` and deterministic demo natural keys.

Use these stable natural keys:

```ts
export const DEMO_KEYS = Object.freeze({
  farmName: 'Farm Demo',
  plotName: 'Plot Demo',
  stations: [
    { upstreamCode: 'NODE01', name: 'Station NODE01' },
    { upstreamCode: 'NODE02', name: 'Station NODE02' },
  ],
});

export interface DemoSeedRepository {
  findFarmsByName(name: string): Promise<readonly { id: string; name: string }[]>;
  createFarm(name: string): Promise<{ id: string; name: string }>;
  findPlot(
    farmId: string,
    name: string,
  ): Promise<{ id: string; farmId: string; name: string } | null>;
  createPlot(farmId: string, name: string): Promise<{ id: string; farmId: string; name: string }>;
  findStationByCode(code: string): Promise<{
    id: string;
    plotId: string;
    upstreamCode: string;
    name: string;
  } | null>;
  createStation(input: { plotId: string; upstreamCode: string; name: string }): Promise<unknown>;
}
```

- [ ] **Step 1: Write seed safety RED tests**

Test exported `assertDemoSeedTarget(databaseUrl, nodeEnv, args)` without opening
a database. It must reject production, `/iot_test`, any database other than
exact `/iot_dev`, and missing/wrong confirmation. Test exported
`ensureDemoRecords(repository: DemoSeedRepository)` twice against a deterministic
in-memory fake implementing find/create operations. Assert one Farm Demo, one
Plot Demo, NODE01/NODE02, no delete/update calls and a conflict when a stable
natural key already points at a different parent/name. Tests never invoke the
CLI or connect to `iot_dev`.

- [ ] **Step 2: Run seed tests and confirm RED**

Run: `pnpm test src/station-data/seed-station-demo.spec.ts`

Expected: FAIL because the seed command does not exist.

- [ ] **Step 3: Implement fail-closed idempotent seed**

The command parses the URL with `new URL`, requires pathname exactly `/iot_dev`,
requires non-production and exact argument `--confirm-demo-seed`. For each stable
natural key, read first: create when absent; accept when every expected field and
parent matches; otherwise abort with a safe conflict message. Serialize the
database operation in one transaction using
`SELECT pg_advisory_xact_lock(hashtext('iot-demo-station-seed'))`. Resolve Farm by
exact name and reject duplicates, Plot by `(farmId, name)`, and Station by unique
`upstreamCode`. Never update, truncate, delete or create identities/grants/keys.
Disconnect Prisma in `finally` and print only created/existing counts.

- [ ] **Step 4: Add operator command and documentation**

Add:

```json
"db:seed-station-demo": "tsx src/station-data/seed-station-demo.ts"
```

Document the exact command, the four created records, `/iot_dev` guard and the
fact that memberships/grants remain an Admin action.

- [ ] **Step 5: Verify Checkpoint B1**

Run:

```powershell
pnpm test test/integration/station-data/hierarchy.spec.ts src/station-data/seed-station-demo.spec.ts
pnpm test test/integration/identity/scopes.spec.ts
pnpm typecheck
pnpm build
```

Write `docs/checkpoints/2026-09-03-b1.md` with command outputs, scope-denial
evidence, pagination evidence, seed safety evidence, branch name and “local only;
not pushed or merged”. Mark SD-2 and Checkpoint B1 complete in `tasks/todo.md`
only after every command passes.

- [ ] **Step 6: Commit Task 3**

```powershell
git add src/station-data/seed-station-demo.ts src/station-data/seed-station-demo.spec.ts package.json README.md docs/checkpoints/2026-09-03-b1.md tasks/todo.md
git commit -m "feat: seed development station registry"
```

---

### Task 4: Pure Latest-Soil Mapper and Safe Upstream Error

**Files:**

- Create: `src/station-data/soil.mapper.ts`
- Create: `src/station-data/soil.mapper.spec.ts`
- Modify: `src/station-data/station-data.contracts.ts`
- Modify: `src/common/errors/app-error.ts`
- Modify: `src/common/errors/app-error.spec.ts`

**Interfaces:**

- Consumes: `WeatherLatestStation`, `AuthorizedStation`, approved soil fields.
- Produces:

```ts
export type SoilQuality = 'good' | 'stale' | 'unknown';
export type SoilFieldDto = Readonly<{
  field: SoilField;
  value: number;
  unit: string | null;
  observedAt: string;
  quality: SoilQuality;
  sensorId: string | null;
  depthCm: number | null;
}>;
export type LatestSoilDataDto = Readonly<{
  station: Pick<StationDto, 'id' | 'name' | 'code'>;
  measurement: 'soil';
  fields: readonly SoilFieldDto[];
  fetchedAt: string;
  isFromCache: boolean;
  isStale: boolean;
}>;
export type NormalizedLatestSoil = Readonly<{
  station: Pick<StationDto, 'id' | 'name' | 'code'>;
  fields: readonly Readonly<{ field: SoilField; value: number; observedAt: string }>[];
  fetchedAt: string;
}>;
export function mapLatestSoil(input: {
  station: AuthorizedStation;
  upstream: readonly WeatherLatestStation[];
  fields: readonly SoilField[];
  fetchedAt: Date;
}): NormalizedLatestSoil;
```

- [ ] **Step 1: Write mapper RED tests from the API Guide fixture**

Use NODE01 with all eight numeric fields and different `_fieldTs`. Assert exact
value preservation, per-field ISO timestamps and null metadata after DTO
projection. Add hostile cases: wrong station, duplicate station entry, missing
soil, string/boolean/null/NaN/infinity, missing field timestamp, invalid epoch,
unknown field and no valid requested field.

```ts
expect(result.fields.find(({ field }) => field === 'light')?.observedAt).toBe(
  new Date(1784882119021).toISOString(),
);
expect(result.fields.find(({ field }) => field === 'moisture')?.value).toBe(43);
```

Every response that cannot form at least one requested field must throw
`UPSTREAM_INVALID_RESPONSE` with status 502.

- [ ] **Step 2: Run mapper tests and confirm RED**

Run: `pnpm test src/station-data/soil.mapper.spec.ts src/common/errors/app-error.spec.ts`

Expected: FAIL because mapper and error code are absent.

- [ ] **Step 3: Implement allowlisted mapping**

Find exactly one matching `station.upstreamCode`; read only `latest.soil`; loop
the caller's already validated field allowlist. Accept only `typeof value ===
'number' && Number.isFinite(value)`. Accept only finite integer epoch values that
produce a valid Date. Omit an invalid individual field, but throw the new safe
error when the resulting array is empty. Sort output by the requested field
order. Never copy `ts`, `time`, `_fieldTs`, unknown fields or the upstream
envelope.

- [ ] **Step 4: Add DTO projection with injected request time**

Add:

```ts
export function toLatestSoilDto(
  value: NormalizedLatestSoil,
  now: Date,
  staleAfterMs: number,
  cache: { isFromCache: boolean; isStale: boolean },
): LatestSoilDataDto;
```

Derive each field's `quality` from `now - Date.parse(observedAt) > staleAfterMs`.
Top-level `isStale` is true when cache fallback is stale or any field is stale.
Set unit/sensor/depth to null at this final public projection.

- [ ] **Step 5: Run focused verification**

Run: `pnpm test src/station-data/soil.mapper.spec.ts src/common/errors/app-error.spec.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```powershell
git add src/station-data/station-data.contracts.ts src/station-data/soil.mapper.ts src/station-data/soil.mapper.spec.ts src/common/errors/app-error.ts src/common/errors/app-error.spec.ts
git commit -m "feat: normalize latest soil readings"
```

---

### Task 5: Validated Cache Configuration and Bounded Coalescing

**Files:**

- Create: `src/station-data/bounded-cache.ts`
- Create: `src/station-data/bounded-cache.spec.ts`
- Modify: `src/config/runtime-config.ts`
- Modify: `src/config/runtime-config.spec.ts`
- Modify: `test/helpers/runtime-config.ts`
- Modify: `.env.example`

**Interfaces:**

- Consumes: injected `now(): number`, safe `AppError` codes.
- Produces:

```ts
export type CacheResult<T> = Readonly<{
  value: T;
  isFromCache: boolean;
  isStale: boolean;
}>;
export class BoundedAsyncCache<T> {
  constructor(options: {
    ttlMs: number;
    staleIfErrorMs: number;
    maxEntries: number;
    now?: () => number;
    canServeStale?: (error: unknown) => boolean;
  });
  get(key: string, loader: () => Promise<T>): Promise<CacheResult<T>>;
  clear(): void;
}

export interface StationDataClock {
  now(): Date;
}
export const STATION_DATA_CLOCK: unique symbol;
export const LATEST_SOIL_CACHE: unique symbol;
export const HISTORY_SOIL_CACHE: unique symbol;
```

Runtime fields:

```ts
soilLatestCacheTtlMs: 30_000;
soilHistoryCacheTtlMs: 300_000;
soilStaleAfterMs: 900_000;
soilStaleIfErrorMs: 300_000;
soilCacheMaxEntries: 500;
```

- [ ] **Step 1: Write cache RED tests with a fake clock**

Cover miss, fresh hit, expiry reload, concurrent miss coalescing, failed loader
removal, stale fallback only inside grace, rejection after grace, no stale for an
unapproved error and LRU eviction at `maxEntries`. Assert loader call counts,
not elapsed wall time.

- [ ] **Step 2: Write runtime-config RED table**

Add all five environment variables to the complete valid fixture. Assert exact
normalized values and reject zero, negative, non-integer, excessive values,
`staleIfError > 3_600_000` and `maxEntries > 10_000`. Production and test use the
same numeric bounds.

- [ ] **Step 3: Run RED tests**

Run: `pnpm test src/station-data/bounded-cache.spec.ts src/config/runtime-config.spec.ts`

Expected: FAIL because cache and configuration fields are absent.

- [ ] **Step 4: Implement cache state machine**

Use one bounded `Map<string, Entry<T>>` and one bounded
`Map<string, Promise<T>>`. An entry stores `value`, `freshUntil`, `staleUntil`
and `lastAccess`. Fresh hits update LRU and return `isFromCache: true`. Expired
misses share one loader promise. On eligible loader failure, return the previous
entry only while `now <= staleUntil`. Always remove the in-flight promise in
`finally`; never store a rejected promise as a value.

Before admitting a new unique miss, evict expired/LRU completed entries. If the
in-flight registry already contains `maxEntries` distinct keys, fail closed with
`UPSTREAM_UNAVAILABLE` instead of creating an unbounded promise registry.

Eligible stale errors are exactly `UPSTREAM_TIMEOUT`, `UPSTREAM_UNAVAILABLE`,
`RATE_LIMITED` and `UPSTREAM_INVALID_RESPONSE` AppErrors.

- [ ] **Step 5: Implement validated environment mapping**

Add exact defaults from the spec to `.env.example`, Zod coercion/bounds to
`runtimeConfigSchema`, immutable camelCase fields to `RuntimeConfig`, the return
mapping and matching values in `makeTestRuntimeConfig`.

- [ ] **Step 6: Run focused verification**

Run: `pnpm test src/station-data/bounded-cache.spec.ts src/config/runtime-config.spec.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```powershell
git add src/station-data/bounded-cache.ts src/station-data/bounded-cache.spec.ts src/config/runtime-config.ts src/config/runtime-config.spec.ts test/helpers/runtime-config.ts .env.example
git commit -m "feat: bound soil response caching"
```

---

### Task 6: Latest Soil Browser API

**Files:**

- Create: `src/station-data/station-data.service.ts`
- Create: `src/station-data/soil-metadata.provider.ts`
- Create: `src/station-data/soil-metadata.provider.spec.ts`
- Create: `test/integration/station-data/latest.spec.ts`
- Modify: `src/station-data/station-data.contracts.ts`
- Modify: `src/station-data/browser.controller.ts`
- Modify: `src/station-data/station-data.module.ts`

**Interfaces:**

- Consumes: repository `getAuthorizedStation`, WeatherClientService, Tasks 4-5 mapper/cache.
- Produces:

```ts
export type LatestSoilQuery = Readonly<{ fields: readonly SoilField[] }>;
export function parseLatestSoilQuery(value: unknown): LatestSoilQuery;

export class StationDataService {
  getLatest(station: AuthorizedStation, query: LatestSoilQuery): Promise<LatestSoilDataDto>;
}

export type SoilFieldMetadata =
  | Readonly<{ field: SoilField; isConfirmed: false }>
  | Readonly<{ field: SoilField; isConfirmed: true; unit: string; revision: string }>;

export interface SoilMetadataProvider {
  getFieldMetadata(stationId: string, field: SoilField): Promise<SoilFieldMetadata>;
}

export const SOIL_METADATA_PROVIDER: unique symbol;
```

- [ ] **Step 1: Write latest HTTP RED tests with controlled upstream**

Start `startUpstreamServer` with the NODE01 API Guide fixture and set
`weatherApiBaseUrl: server.baseUrl`, matching the existing Weather-client tests.
Create Admin/Farmer/Client identities and registry scope. Assert:

```ts
const response = await app.inject({
  method: 'GET',
  url: `/api/v1/stations/${station.id}/data/latest?fields=moisture,temperature`,
  headers: { authorization: `Bearer ${farmerToken}` },
});
expect(response.statusCode).toBe(200);
expect(response.json().data).toMatchObject({
  measurement: 'soil',
  station: { id: station.id, code: 'NODE01' },
  isFromCache: false,
});
```

Assert Weather request path contains one database-resolved `station=NODE01`,
`type=soil` and only requested fields. Assert cross-scope/unknown is 404 before
Weather receives a request; Client Bearer is 403; duplicate/unknown/empty fields
are 400; no valid upstream field is `502 UPSTREAM_INVALID_RESPONSE`; second call
is a fresh cache hit and does not call Weather again.

- [ ] **Step 2: Run integration test and confirm RED**

Run: `pnpm test test/integration/station-data/latest.spec.ts`

Expected: FAIL because latest route/service are absent.

- [ ] **Step 3: Implement latest query parser and service**

The parser accepts optional comma-separated `fields`; absence means all eight;
trim is not silently applied inside a field; empty, duplicates and unknown names
are validation errors. Canonical cache key is:

```ts
const key = `latest:${station.upstreamCode}:${[...query.fields].sort().join(',')}`;
```

Loader calls:

```ts
weather.getLatest({ station: [station.upstreamCode], type: ['soil'], fields: [...query.fields] });
```

then `mapLatestSoil`. The service obtains one `now` per request, projects cache
metadata with `toLatestSoilDto` and never caches principals or authorization
results. Add `WeatherModule` to `StationDataModule.imports`, register the latest
cache with validated runtime values and inject the existing
`WeatherClientService` through its exported module provider.

- [ ] **Step 4: Lock the B-device metadata boundary**

Implement `UnconfirmedSoilMetadataProvider` for B-core. For every validated
station ID and approved field it returns `{ field, isConfirmed: false }`; it does
not infer unit from field name or upstream value. Register it under
`SOIL_METADATA_PROVIDER` and export the token/type from `StationDataModule`.
Unit test all eight fields and assert no confirmed unit/revision appears. This is
the exact internal interface consumed by the approved Phase C spec; B-device may
replace the provider without changing callers.

- [ ] **Step 5: Add Bearer latest route**

Controller sequence is fixed: parse UUID/query, obtain current principal, call
`repository.getAuthorizedStation`, return safe 404 when null, then call service.
Set `Cache-Control: no-store`; cached backend data must not become a shared browser
HTTP cache.

- [ ] **Step 6: Verify Checkpoint B latest slice**

Run:

```powershell
pnpm test test/integration/station-data/latest.spec.ts src/station-data/soil.mapper.spec.ts src/station-data/bounded-cache.spec.ts
pnpm test src/station-data/soil-metadata.provider.spec.ts
pnpm typecheck
pnpm build
```

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```powershell
git add src/station-data test/integration/station-data/latest.spec.ts
git commit -m "feat: expose authorized latest soil data"
```

---

### Task 7: Bounded History, Series Mapping and Continuation Cursor

**Files:**

- Create: `src/station-data/history.mapper.ts`
- Create: `src/station-data/history.mapper.spec.ts`
- Create: `test/integration/station-data/history.spec.ts`
- Modify: `src/station-data/station-data.contracts.ts`
- Modify: `src/station-data/cursor.ts`
- Modify: `src/integrations/weather/contracts.ts`
- Modify: `src/integrations/weather/contracts.spec.ts`
- Modify: `src/integrations/weather/weather-client.service.ts`
- Modify: `src/integrations/weather/weather-client.service.spec.ts`
- Modify: `src/station-data/station-data.service.ts`
- Modify: `src/station-data/browser.controller.ts`

**Interfaces:**

- Consumes: Weather history records, Task 1 history cursor, history cache.
- Produces:

```ts
export type SoilHistoryQuery = Readonly<{
  fields: readonly SoilField[];
  begin: string;
  end: string;
  interval: 'raw' | '5m' | '30m' | '1h' | '1d';
  aggregate?: 'mean' | 'min' | 'max' | 'first' | 'last';
  order: 'asc' | 'desc';
  limit: number;
  cursor?: string;
}>;
export type SoilHistoryDto = Readonly<{
  stationId: string;
  measurement: 'soil';
  series: readonly SoilHistorySeriesDto[];
  page: { nextCursor: string | null };
  fetchedAt: string;
  isFromCache: boolean;
  isStale: boolean;
}>;
export type SoilHistoryPointDto = Readonly<{
  observedAt: string;
  value: number;
  quality: SoilQuality;
}>;
export type SoilHistorySeriesDto = Readonly<{
  field: SoilField;
  unit: string | null;
  sensorId: string | null;
  depthCm: number | null;
  points: readonly SoilHistoryPointDto[];
}>;
export type HistoryMapInput = Readonly<{
  stationId: string;
  upstream: readonly WeatherHistoryStation[];
  stationCode: string;
  fields: readonly SoilField[];
  order: 'asc' | 'desc';
  limit: number;
  queryFingerprint: string;
  boundaryFingerprint?: string;
  boundaryOccurrence?: number;
  fetchedAt: Date;
}>;
export type NormalizedHistoryPage = Readonly<{
  stationId: string;
  series: readonly SoilHistorySeriesDto[];
  fetchedAt: string;
  nextCursor: string | null;
}>;
export function parseSoilHistoryQuery(value: unknown): SoilHistoryQuery;
export function mapHistoryPage(input: HistoryMapInput): NormalizedHistoryPage;
export function historyQueryFingerprint(input: {
  stationCode: string;
  query: Omit<SoilHistoryQuery, 'cursor'>;
}): string;

export class StationDataService {
  getHistory(station: AuthorizedStation, query: SoilHistoryQuery): Promise<SoilHistoryDto>;
}
```

- [ ] **Step 1: Write query and mapper RED tests**

Cover required UTC `begin/end`, begin <= end, raw maximum exactly seven days,
aggregate maximum exactly 90 days, default limit 100/max 500, default order asc,
approved intervals/aggregates, aggregate rejected for raw and required for
non-raw. History `fields` uses the same optional comma-separated unique allowlist
as latest and defaults to all eight fields. Use API Guide raw records where field
sets differ; assert independent series and no carry-forward:

```ts
expect(result.series.find((series) => series.field === 'light')?.points).toHaveLength(1);
expect(result.series.find((series) => series.field === 'moisture')?.points).toHaveLength(2);
```

Valid history points use `quality: 'good'` regardless of their age; historical
age is not latest-data staleness. Values remain exact and unit/sensor/depth null.

- [ ] **Step 2: Write cursor RED tests**

Assert query fingerprint is stable for identical canonical input and changes for
any station, fields, begin, end, interval, aggregate, order or limit difference.
Assert continuation drops records through the exact boundary fingerprint,
handles equal timestamps without duplicates and rejects malformed, mismatched or
missing boundary cursors with `400 VALIDATION_ERROR`.

- [ ] **Step 3: Correct upstream raw aggregate behavior**

Change `WeatherHistoryQuery.aggregate` to optional. Refine its schema so raw
rejects aggregate and non-raw requires it. Change WeatherClientService to add the
query parameter only when defined:

```ts
if (query.aggregate) search.set('aggregate', query.aggregate);
```

Update existing contract/service tests to assert raw paths omit `aggregate=` and
aggregated paths include it.

- [ ] **Step 4: Run RED suite**

Run:

```powershell
pnpm test src/station-data/history.mapper.spec.ts src/station-data/cursor.spec.ts
pnpm test src/integrations/weather/contracts.spec.ts src/integrations/weather/weather-client.service.spec.ts
pnpm test test/integration/station-data/history.spec.ts
```

Expected: station-data tests FAIL for absent history implementation; amended
Weather expectations FAIL until Step 3 production changes are complete, then
Weather tests PASS before continuing.

- [ ] **Step 5: Implement normalized page mapping**

Canonical record fingerprint is SHA-256 of sorted JSON containing `ts`, `time`
and only approved requested numeric fields. Query fingerprint is SHA-256 of
sorted canonical query JSON excluding cursor and including resolved station code.
For continuation, require the boundary fingerprint and positive
`boundaryOccurrence` in the inclusive upstream page, drop through that exact
occurrence, then take `limit + 1` records. Ascending continuation
replaces upstream `begin` with `boundaryTime`; descending continuation replaces
`end`. Request at most `min(5000, limit * 2 + 1)` source records. If the boundary
cannot be found, return `400 VALIDATION_ERROR` because the opaque continuation is
no longer valid.

Map at most `limit` records to per-field series; omit empty series; throw
`UPSTREAM_INVALID_RESPONSE` when no requested valid point remains. Cursor the
last returned source record only when one additional record exists.

- [ ] **Step 6: Implement history service/cache/route**

Call Weather with exactly one station, `type: ['soil']`, approved fields,
inclusive continuation boundary, an upstream limit no greater than 5000 and
the approved interval/aggregate. Cache key includes station code and every
canonical query field including cursor. Use history TTL 5 minutes and the same
5-minute stale grace. History top-level `isStale` is true only for stale fallback;
do not rewrite point quality on a normal cache hit. Register a second
`BoundedAsyncCache<NormalizedHistoryPage>` under `HISTORY_SOIL_CACHE`; never share
entries or TTL state with `LATEST_SOIL_CACHE`.

Add browser route
`GET /stations/:stationId/data/history` with authorization before Weather.

- [ ] **Step 7: Run focused history verification**

Run:

```powershell
pnpm test src/station-data/history.mapper.spec.ts src/station-data/cursor.spec.ts
pnpm test src/integrations/weather/contracts.spec.ts src/integrations/weather/weather-client.service.spec.ts
pnpm test test/integration/station-data/history.spec.ts
pnpm typecheck
pnpm build
```

Expected: PASS.

- [ ] **Step 8: Commit Task 7**

```powershell
git add src/station-data src/integrations/weather test/integration/station-data/history.spec.ts
git commit -m "feat: expose bounded soil history"
```

---

### Task 8: Client Developer Routes and Per-Key Rate Limit

**Files:**

- Create: `src/station-data/client.controller.ts`
- Create: `src/station-data/client-rate-limit.guard.ts`
- Create: `src/station-data/client-rate-limit.guard.spec.ts`
- Create: `test/integration/station-data/client.spec.ts`
- Modify: `src/api-keys/api-key.service.ts`
- Modify: `src/api-keys/api-key.guard.ts`
- Modify: `src/api-keys/api-key.module.ts`
- Modify: `src/station-data/station.repository.ts`
- Modify: `src/station-data/hierarchy.service.ts`
- Modify: `src/station-data/station-data.contracts.ts`
- Modify: `src/station-data/station-data.module.ts`

**Interfaces:**

- Consumes: existing API-key hashing/current-owner validation, shared data service.
- Produces:

```ts
export type ApiKeyPrincipal = Readonly<{
  apiKeyId: string;
  ownerUserId: string;
  requestsPerMinute: number;
}>;

export class ApiKeyService {
  authenticateCredential(rawKey: string): Promise<ApiKeyPrincipal>;
  authenticate(rawKey: string, stationId: string): Promise<ApiKeyPrincipal & { stationId: string }>;
}

export type ApiKeyRequest = FastifyRequest & { apiKeyPrincipal?: ApiKeyPrincipal };

export class StationRepository {
  listClientStations(
    principal: ApiKeyPrincipal,
    query: HierarchyQuery,
  ): Promise<CursorPage<StationDto>>;
  getClientStationByCode(
    principal: ApiKeyPrincipal,
    code: string,
  ): Promise<AuthorizedStation | null>;
}

export class HierarchyService {
  listClientStations(
    principal: ApiKeyPrincipal,
    query: HierarchyQuery,
  ): Promise<CursorPage<StationDto>>;
  requireClientStationByCode(principal: ApiKeyPrincipal, code: string): Promise<AuthorizedStation>;
}

export type RateLimitDecision = Readonly<{
  limit: number;
  remaining: number;
  resetEpochSeconds: number;
}>;

export class ClientRateLimitStore {
  consume(principal: ApiKeyPrincipal): RateLimitDecision;
}
```

- [ ] **Step 1: Write credential-only authentication RED tests**

Extend API-key authentication tests so a valid active key can authenticate before
a station is selected, while malformed/wrong hash/expired/revoked/disabled owner
all retain identical `401 INVALID_API_KEY`. Preserve the existing
station-specific `authenticate` tests and behavior.

- [ ] **Step 2: Write limiter RED tests with injected clock**

Instantiate the limiter store directly. For a key limit of 2/minute, assert
remaining sequence 1, 0, then `429 RATE_LIMITED`; exact reset is the next window
epoch seconds; a second key is isolated; advancing 60 seconds resets; more than
the configured bounded key capacity evicts expired/LRU state.

- [ ] **Step 3: Write Client HTTP RED tests**

Create one Client Developer with two account grants and a key scoped to one.
Assert:

```ts
GET /api/v1/client/stations
GET /api/v1/client/data/latest?station=NODE01&fields=moisture,ph
GET /api/v1/client/data/history?station=NODE01&...
```

return only the intersection, use the shared DTOs and include exact
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers after
successful credential authentication. Unknown/out-of-scope station codes,
removed grants/scopes, disabled owner, revoked/expired key use
`401 INVALID_API_KEY`; exhaustion uses 429. Assert Client endpoints reject Bearer
without API key and browser routes reject API key without Bearer.

- [ ] **Step 4: Run Client RED suite**

Run:

```powershell
pnpm test test/integration/api-keys/authentication.spec.ts
pnpm test src/station-data/client-rate-limit.guard.spec.ts
pnpm test test/integration/station-data/client.spec.ts
```

Expected: FAIL for missing credential-only auth, limiter and routes.

- [ ] **Step 5: Split credential authentication from station authorization**

`authenticateCredential` performs constant-time hash comparison and current key,
expiry, revocation, owner role/status checks, then updates `lastUsedAt`. It never
returns key hash or scope arrays. Existing `authenticate(rawKey, stationId)` calls
the shared credential validation and then checks current account grant and key
scope, preserving its public behavior.

Change `ApiKeyGuard` to require only one string `X-API-Key`, attach the bounded
principal and never parse route/query station. Station-code authorization belongs
to `StationRepository.getClientStationByCode`, whose single query requires:

```ts
{
  upstreamCode: code,
  clientGrants: { some: { userId: principal.ownerUserId } },
  apiKeyScopes: { some: { apiKeyId: principal.apiKeyId } },
}
```

Null becomes the unified `INVALID_API_KEY`, not 404.

- [ ] **Step 6: Implement dynamic per-key limiter**

Use a bounded process-local fixed-window Map keyed by `apiKeyId`. The guard runs
after `ApiKeyGuard`, reads current `requestsPerMinute`, increments atomically in
the JavaScript event loop and sets all three standard headers on authenticated
responses, including 429. Invalid-key responses do not invent limit metadata.
Cap stored keys at 10,000 and evict expired windows before LRU.

- [ ] **Step 7: Implement three Client controllers**

Apply `@ApiSecurity('apiKey')` and
`@UseGuards(ApiKeyGuard, ClientRateLimitGuard)`. Parse station code with exact
`^[A-Za-z0-9_-]{1,64}$`; resolve it through the scoped repository before calling
the shared latest/history service. Client station list uses cursor kind
`client-station` and returns the same `StationDto` shape. Add `ApiKeyModule` to
`StationDataModule.imports`; register `ClientRateLimitGuard` in providers and the
Client controller in controllers.

- [ ] **Step 8: Run focused Client verification**

Run:

```powershell
pnpm test test/integration/api-keys/authentication.spec.ts test/integration/api-keys/lifecycle.spec.ts
pnpm test src/station-data/client-rate-limit.guard.spec.ts test/integration/station-data/client.spec.ts
pnpm typecheck
pnpm build
```

Expected: PASS with existing API-key lifecycle behavior unchanged.

- [ ] **Step 9: Commit Task 8**

```powershell
git add src/api-keys src/station-data test/integration/api-keys test/integration/station-data/client.spec.ts
git commit -m "feat: expose scoped client station data"
```

---

### Task 9: OpenAPI, Operator Documentation and B-core Completion Gate

**Files:**

- Create: `test/integration/station-data/openapi.spec.ts`
- Create: `docs/checkpoints/2026-09-03-phase-b-core.md`
- Modify: `README.md`
- Modify: `tasks/todo.md`

**Interfaces:**

- Consumes: every Phase B route/schema/security contract.
- Produces: verified `/docs-json`, manual test commands and completion evidence.

- [ ] **Step 1: Write OpenAPI RED assertions**

Assert exact path presence for four hierarchy routes, browser latest/history and
three Client routes. Assert Bearer security on browser operations, API-key
security on Client operations, UUID path formats, query enum/limit bounds,
strict response fields and absence of database/internal names:

```ts
const serialized = JSON.stringify(document.paths);
expect(serialized).toContain('UPSTREAM_INVALID_RESPONSE');
expect(serialized).not.toMatch(/upstreamCode|passwordHash|tokenHash|keyHash|WEATHER_API_KEY/);
```

Assert latest/history schemas include nullable unit/sensor/depth and cache flags.

- [ ] **Step 2: Run OpenAPI test and confirm RED**

Run: `pnpm test test/integration/station-data/openapi.spec.ts`

Expected: FAIL until every new controller carries explicit Swagger response and
query schema metadata.

- [ ] **Step 3: Complete controller OpenAPI metadata**

Add explicit success and normalized error schemas to each operation; document
400/401/403/404/429/502/504 where applicable. Do not expose upstream response
schemas or secrets. Keep `/docs` and `/docs-json` development/test only.

- [ ] **Step 4: Update operator and frontend handoff documentation**

README must include:

- demo seed command and refusal boundaries;
- browser Bearer routes and 30-second latest polling guidance;
- Client `X-API-Key` routes and rate-limit headers;
- exact history bounds and examples for raw versus aggregate;
- null device metadata meaning and B-device gate;
- PowerShell manual checks using local IDs/codes without real secrets;
- explicit statement that measurements are proxied/cached, not persisted.

- [ ] **Step 5: Run the complete B-core verification gate**

Run in this order and record exit code/output summary:

```powershell
pnpm test
pnpm test:coverage
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm audit --prod
pnpm ignored-builds
pnpm db:status
git diff --check
git status --short
```

Also inspect staged content for credential-like values. Any reachable high or
critical advisory, failing migration, test, lint warning, secret or dirty
unexplained file blocks completion.

- [ ] **Step 6: Write completion evidence and update tracker**

Create `docs/checkpoints/2026-09-03-phase-b-core.md` containing:

- commit range and local branch;
- commands and exact pass/fail counts;
- Admin/Farmer/Client scope evidence;
- latest/history/cache/cursor/rate-limit evidence;
- known boundary: B-device still required for full Phase B verification;
- “not pushed or merged”.

Mark SD-3, SD-4, SD-5 and Checkpoint B-core complete only when all gate commands
pass. Keep B-device explicitly open.

- [ ] **Step 7: Commit Task 9**

```powershell
git add src/station-data test/integration/station-data/openapi.spec.ts README.md tasks/todo.md docs/checkpoints/2026-09-03-phase-b-core.md
git commit -m "docs: verify station data b-core"
```

## Plan Self-Review Matrix

| Spec requirement                                | Owning task                       |
| ----------------------------------------------- | --------------------------------- |
| Opaque bounded hierarchy cursor                 | Task 1                            |
| Admin/Farmer hierarchy and safe denials         | Task 2                            |
| Explicit idempotent `/iot_dev` seed             | Task 3                            |
| Eight-field latest mapping and per-field time   | Task 4                            |
| Runtime TTL/LRU/coalescing/stale-if-error       | Task 5                            |
| Browser latest endpoint and 30-second cache     | Task 6                            |
| Raw/aggregate bounds and history continuation   | Task 7                            |
| Client station intersection and dynamic rate    | Task 8                            |
| OpenAPI, manual handoff and quality gate        | Task 9                            |
| No measurement persistence or speculative units | Global constraints and Tasks 4, 9 |
| B-device remains a separate acceptance gate     | Tasks 4, 9                        |

## Execution Order

Execute Tasks 1-3, stop at Checkpoint B1 and review. Then execute Tasks 4-6 and
verify Checkpoint B2 against the approved sample JSON and the frontend adapter.
This verification must cover all eight soil fields, per-field timestamps, nullable
unit/sensor/depth metadata, dynamic station discovery, and unavailable/stale UI
states. Execute Task 7, review history pagination, then Task 8. Task 9 is the only B-core completion gate. Do not start any Phase C production
task from this plan.
