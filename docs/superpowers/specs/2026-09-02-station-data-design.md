# Station Data Design

Date: 2026-09-02
Status: Approved for implementation planning
Module: `station-data`
Depends on: `integration-core`, `identity-access`

## 1. Purpose

Phase B exposes authorized farm, plot, station and soil-measurement data to the
browser frontend and Client Developers. It translates the existing Weather API
into stable business DTOs without exposing upstream envelopes, credentials or
database records.

This phase uses the Weather API on demand with bounded in-process caching. It
does not ingest or persist measurement time series. Device metadata and units
that have not been confirmed by the hardware team remain explicitly unknown.

## 2. Approved delivery split

### B-core

B-core can be implemented and verified without a physical device:

- authorized farm, plot and station hierarchy;
- soil latest and history contracts;
- Weather API mapping, validation and safe error normalization;
- bounded caching, request coalescing and stale-if-error behavior;
- browser Bearer-token and Client API-key authorization;
- per-key rate limiting and response headers;
- deterministic fake-upstream tests;
- an explicit, idempotent development seed for `NODE01` and `NODE02`.

### B-device validation

Phase B is not fully accepted until the hardware/device team supplies and a real
station confirms:

- official units and conversion rules, especially soil EC;
- technical ranges for each sensor field;
- sensor identifiers, models and installation depths;
- actual send intervals and field-specific stale thresholds;
- station-code mapping against the Weather API;
- at least one end-to-end live-station result.

B-core may ship to local integration before this gate, but unverified metadata
must remain `null` and values must not be converted speculatively.

### Current upstream integration status

The upstream API is temporarily unavailable while the device installation is in
progress. Until access is restored, backend and frontend integration work uses
the response JSON documented in the approved API Guide as its sample contract.
Evidence produced from that sample is labeled `sample-verified`, not live-device
evidence.

The planned installation contains one station named `CENTER` and six node
stations named `NODE01` through `NODE06`. The six node stations are confirmed to
return the same JSON structure, although their values may differ. This topology
is a current deployment fixture and must not be hardcoded as the permanent
application registry. Behavior or soil-field availability for `CENTER` remains
unverified until its real response is available. The existing NODE01/NODE02
development seed remains intentionally minimal and deterministic.

## 3. Scope

### In scope

- Measurement type `soil` only.
- Soil fields: `temperature`, `moisture`, `ec`, `ph`, `nitrogen`,
  `phosphorus`, `potassium` and `light`.
- Browser hierarchy, latest and history APIs.
- Client Developer station, latest and history APIs.
- Polling-friendly contracts; the frontend polls latest every 30 seconds.
- Cursor pagination for hierarchy and history.
- Development-only station registry seed.

### Deferred

- `weather` and `water` measurement types.
- WebSocket or SSE delivery.
- MQTT/HTTPS device ingestion and device authentication.
- Measurement persistence, time-series database, aggregation jobs and raw-data
  retention.
- Device/sensor/profile configuration and field-specific stale thresholds.
- Alerts, reports and CSV/Excel export.
- Redis/distributed cache and distributed rate-limit state.

The public DTOs use a measurement discriminator and field objects so adding
`weather` or `water` can be additive in a later approved contract.

## 4. Data ownership and architecture

PostgreSQL owns business metadata and authorization:

```text
Farm -> Plot -> Station(upstreamCode)
  |                         |
  +-> FarmMembership       +-> ClientStationGrant -> ApiKeyStationScope
```

The Weather API owns measurement values. No upstream measurement envelope is
stored in PostgreSQL during B-core.

```text
Browser request (Bearer)             Client request (X-API-Key)
          |                                      |
AccessTokenGuard + ScopeService       ApiKeyGuard + per-key limiter
          |                                      |
          +------------ StationDataService ------+
                              |
                 authorization already resolved
                              |
          cache -> WeatherClient -> SoilDataMapper -> public DTO
```

Browser and Client controllers are separate trust boundaries. They share the
same query, mapping and DTO services after authorization succeeds. A Client
Developer browser principal cannot read station measurements with a Bearer
token.

## 5. Authorization

| Caller                             | Credential          | Effective station scope                                   |
| ---------------------------------- | ------------------- | --------------------------------------------------------- |
| Admin                              | Bearer access token | Every station in the current registry                     |
| Farmer                             | Bearer access token | Stations inherited from current farm memberships          |
| Client Developer browser principal | Bearer access token | No station-data access                                    |
| Client Developer integration       | `X-API-Key`         | Intersection of active account grant and active key scope |

Every page and every data request re-evaluates current database state. Disabling
an account, changing its role, removing a membership/grant, expiring/revoking a
key or removing a key scope takes effect immediately.

An unknown and an unauthorized hierarchy resource both return the same safe
`404 NOT_FOUND` response. API-key failure uses the existing unified
`401 INVALID_API_KEY` response and does not disclose which check failed.

## 6. Browser REST contract

All routes use the existing `/api/v1` prefix, success envelope and normalized
error envelope.

### Hierarchy

```text
GET /farms?limit=50&cursor=...
GET /farms/:farmId/plots?limit=50&cursor=...
GET /plots/:plotId/stations?limit=50&cursor=...
GET /stations/:stationId
```

Hierarchy limits default to 50 and are bounded to 100. Cursors are opaque to
callers. Lists contain only resources in the caller's current scope.

```ts
type FarmDto = {
  id: string;
  name: string;
};

type PlotDto = {
  id: string;
  farmId: string;
  name: string;
};

type StationDto = {
  id: string;
  farmId: string;
  plotId: string;
  name: string;
  code: string;
};

type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};
```

Hierarchy queries never call the Weather API.

### Latest soil data

```text
GET /stations/:stationId/data/latest?fields=moisture,temperature,ph
```

`fields` is optional, unique, comma-separated and limited to the eight approved
soil fields. Unknown, duplicate or empty field values produce
`400 VALIDATION_ERROR`.

```ts
type SoilQuality = 'good' | 'stale' | 'unknown';

type SoilFieldDto = {
  field:
    'temperature' | 'moisture' | 'ec' | 'ph' | 'nitrogen' | 'phosphorus' | 'potassium' | 'light';
  value: number;
  unit: string | null;
  observedAt: string;
  quality: SoilQuality;
  sensorId: string | null;
  depthCm: number | null;
};

type LatestSoilDataDto = {
  station: Pick<StationDto, 'id' | 'name' | 'code'>;
  measurement: 'soil';
  fields: SoilFieldDto[];
  fetchedAt: string;
  isFromCache: boolean;
  isStale: boolean;
};
```

Each field uses its own upstream `_fieldTs` value. `fetchedAt` is server time,
not sensor time. A field is `stale` when its `observedAt` is older than the
configured stale threshold. A valid, timely numeric value is `good`. `unknown`
is reserved for later device-validated sources that explicitly report unknown
quality; successfully mapped B-core Weather values are `good` or `stale`.

### Soil history

```text
GET /stations/:stationId/data/history
    ?fields=moisture,temperature
    &begin=2026-09-01T00:00:00Z
    &end=2026-09-02T00:00:00Z
    &interval=raw
    &order=asc
    &limit=100
    &cursor=...
```

Every request requires `begin` and `end`. A continuation request repeats the
original filters and adds its cursor. The cursor binds to the station and those
filters; changing a bound filter while continuing returns
`400 VALIDATION_ERROR`.

```ts
type SoilHistoryPointDto = {
  observedAt: string;
  value: number;
  quality: SoilQuality;
};

type SoilHistorySeriesDto = {
  field: SoilFieldDto['field'];
  unit: string | null;
  sensorId: string | null;
  depthCm: number | null;
  points: SoilHistoryPointDto[];
};

type SoilHistoryDto = {
  stationId: string;
  measurement: 'soil';
  series: SoilHistorySeriesDto[];
  page: { nextCursor: string | null };
  fetchedAt: string;
  isFromCache: boolean;
  isStale: boolean;
};
```

Series output prevents clients from assuming an upstream raw record contains
every field. Long data gaps remain gaps; the backend does not synthesize points
or carry values forward.

## 7. Client Developer REST contract

Client endpoints require `X-API-Key` and use a dedicated controller:

```text
GET /api/v1/client/stations?limit=50&cursor=...
GET /api/v1/client/data/latest?station=NODE01&fields=moisture,ph
GET /api/v1/client/data/history?station=NODE01&...
```

One data request addresses exactly one station. Station is the public station
code and is resolved to the current registry before the existing API-key scope
check. Client data responses use the same DTOs as browser data responses.

Every successfully API-key-authenticated non-health Client response, including a
per-key `429`, includes:

```text
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
```

The limiter uses the key's current `requestsPerMinute` value and keys state by
API-key ID. B-core rate-limit state is process-local. Multi-instance enforcement
is deferred to a shared store in the operations phase.

## 8. History bounds

| Setting                  | Contract                              |
| ------------------------ | ------------------------------------- |
| Stations per request     | Exactly one                           |
| Raw maximum range        | 7 days                                |
| Aggregated maximum range | 90 days                               |
| Default limit            | 100 upstream records                  |
| Maximum limit            | 500 upstream records                  |
| Order                    | `asc` or `desc`                       |
| Intervals                | `raw`, `5m`, `30m`, `1h`, `1d`        |
| Aggregates               | `mean`, `min`, `max`, `first`, `last` |

`aggregate` is rejected with `interval=raw` and is required when `interval` is
not `raw`. `sum`, `count` and `1w` remain closed because their meaning has not
been approved for the soil fields.

History pagination uses an opaque base64url cursor containing the last upstream
timestamp, a deterministic boundary-record fingerprint and a query fingerprint.
The continuation includes the boundary, drops records through the fingerprint
and returns the next bounded page. Authorization and all bounds are rechecked;
cursor contents never confer access. A malformed or mismatched cursor is a
validation error.

## 9. Upstream validation and mapping

The existing Weather client continues to own the configured base URL, API key,
timeout and upstream envelope validation. Request input can select only a
database-resolved `Station.upstreamCode`; it cannot control the upstream host or
path.

The station-data mapper requests only `type=soil` and the approved fields. It:

1. finds the exact requested station in the upstream response;
2. accepts only finite numeric values;
3. requires a valid per-field timestamp for latest and a valid record timestamp
   for history;
4. preserves the numeric value without conversion;
5. sets `unit`, `sensorId` and `depthCm` to `null` until device validation;
6. derives only freshness-based `good`/`stale` quality;
7. omits invalid individual fields and fails if no valid requested field remains;
8. never forwards unknown upstream fields or the upstream envelope.

An upstream response that passes the generic Weather envelope but cannot produce
a valid station-data DTO returns `502 UPSTREAM_INVALID_RESPONSE`. This new safe
error code is distinct from transport availability and never includes parsing
details.

## 10. Cache and request coalescing

The new validated runtime settings are:

```env
SOIL_LATEST_CACHE_TTL_MS=30000
SOIL_HISTORY_CACHE_TTL_MS=300000
SOIL_STALE_AFTER_MS=900000
SOIL_STALE_IF_ERROR_MS=300000
SOIL_CACHE_MAX_ENTRIES=500
```

Cache entries contain normalized station-data results only. They never contain
credentials, principals or authorization decisions. Authorization runs before
every cache lookup, so sharing a station/query cache entry between authorized
callers cannot broaden access.

Cache keys include station code and every data-shaping filter. The cache is
bounded and evicts least-recently-used entries. Concurrent misses for the same
key share one in-flight Weather request. A failed in-flight request is removed
and is not cached as a successful result.

When Weather fails after normal expiry, a previously successful entry may be
served for at most `SOIL_STALE_IF_ERROR_MS` beyond expiry. The response sets
`isFromCache: true` and `isStale: true`. For latest, `isStale` is also true when
any returned field is stale. For history, top-level `isStale` describes only a
stale-if-error cache response; historical point quality is not rewritten merely
because the response came from cache. After the grace period the normalized
upstream error is returned.

## 11. Development seed

An explicit command creates a deterministic demo hierarchy in `iot_dev`:

```text
Farm Demo
└── Plot Demo
    ├── Station NODE01 (upstreamCode NODE01)
    └── Station NODE02 (upstreamCode NODE02)
```

Proposed operator command:

```powershell
pnpm db:seed-station-demo -- --confirm-demo-seed
```

The command:

- refuses every database whose URL path is not exactly `/iot_dev`;
- refuses production;
- requires the exact confirmation flag;
- uses stable natural keys/upserts and is idempotent;
- never truncates, deletes or replaces existing records;
- does not create users, memberships, grants or API keys;
- records only non-secret completion information.

Tests create their own registry in `iot_test` and do not call this command.

## 12. Error contract

| Condition                                         | HTTP/code                       |
| ------------------------------------------------- | ------------------------------- |
| Invalid query, field, range or cursor             | `400 VALIDATION_ERROR`          |
| Missing/invalid browser authentication            | `401 UNAUTHENTICATED`           |
| Invalid, expired, revoked or out-of-scope API key | `401 INVALID_API_KEY`           |
| Unknown or unauthorized hierarchy resource        | `404 NOT_FOUND`                 |
| Client key limit exhausted                        | `429 RATE_LIMITED`              |
| Weather transport timeout                         | `504 UPSTREAM_TIMEOUT`          |
| Weather unavailable and no usable cache           | `502 UPSTREAM_UNAVAILABLE`      |
| Weather response cannot form a valid DTO          | `502 UPSTREAM_INVALID_RESPONSE` |

The existing normalized error envelope remains unchanged. Logs contain request
IDs and safe error codes, not upstream bodies, credentials or raw exceptions.

## 13. Performance and operational boundaries

- Hierarchy lists are database-paginated and never load an unbounded scope.
- Data requests address one station and at most eight fields.
- History accepts at most 500 upstream records per call.
- Cache and in-flight registries are bounded.
- The 30-second frontend polling recommendation aligns with latest cache TTL.
- The SRS targets for 10,000 devices, 2,000 messages/second and two-second
  sensor-to-screen latency are not claimed by this proxy-only B-core. They require
  the future ingestion/time-series architecture and load benchmarks.

## 14. Verification strategy

### Hierarchy and browser scope

- Admin receives the full registry.
- Farmer receives only currently assigned farms and descendants.
- Cross-farm ID manipulation returns the same 404 as an unknown resource.
- Client Developer Bearer principals cannot use browser station-data routes.
- Pagination is bounded, deterministic and does not broaden scope.

### Latest and history mapping

- Latest uses each field's `_fieldTs` rather than the measurement-wide time.
- Raw records with different field sets produce independent chart series.
- Non-number, non-finite, missing-time and unknown fields never reach DTOs.
- Empty valid output becomes `UPSTREAM_INVALID_RESPONSE`.
- Values are preserved exactly and unverified metadata remains `null`.
- Raw/aggregate ranges, intervals, aggregates, order, limit and cursor binding are
  covered at each boundary.
- Cursor continuation has neither duplicate nor missing deterministic fixture
  records, including equal timestamp boundaries.

### Cache and failures

- Fresh cache hits do not call Weather twice.
- Concurrent misses coalesce to one upstream request.
- TTL and stale grace use an injected clock.
- Stale fallback is clearly marked and stops at the configured boundary.
- Timeout, 429, malformed JSON, hostile envelope and invalid DTO data produce
  stable safe errors.

### Client Developer

- Current key, current owner, current grant and key scope are all required.
- Removing any layer closes access immediately.
- Per-key rate state is isolated; limit, remaining and reset headers are exact.
- Rejected requests do not reveal whether station, account, grant or key failed.

### Seed and completion gates

- Seed refuses production, `iot_test` and every non-`iot_dev` target.
- Repeated seed runs create no duplicates and delete nothing.
- OpenAPI contains the exact approved paths, schemas, security schemes and no
  credential material.
- Focused tests, full tests, coverage, format, lint, typecheck, build, dependency
  audit, migration checks and secret scan pass before Checkpoint B.

## 15. Delivery order and checkpoints

1. **SD-1:** approve this station-data design.
2. **SD-2:** hierarchy/list contract and demo registry seed.
3. **Checkpoint B1:** authorization and hierarchy review.
4. **SD-3:** latest soil data, mapping, cache and polling contract.
5. **Checkpoint B2:** latest DTO and frontend adapter are verified against the
   approved sample JSON, including all eight fields, per-field timestamps, nullable
   device metadata and unavailable/stale states.
6. **SD-4:** bounded soil history and cursor pagination.
7. **SD-5:** Client API-key data routes and per-key rate limiting.
8. **Checkpoint B-core:** frontend can replace farm/plot/station/soil mocks against
   fake and approved Weather data.
9. **Checkpoint B-device:** hardware metadata and one real station validate the
   unresolved physical-data assumptions.

No Phase C alert/configuration implementation begins before B-core is verified.
Phase B is labeled fully verified only after B-device validation.

## 16. F-data amendment — approved for local implementation

Date: 2026-10-05. The owner approved this detailed contract, including 90-day real
raw history plus a separate last-known snapshot. Sections 1/3/4/10 above describe
the accepted B baseline; this amendment supersedes their persistence deferral.
B/C acceptance is not reopened. No Pi database migration,
push, deployment, frontend F7 work, MFA, SMS or device writes are included here.

### Storage and transactional boundaries

- Add `SoilReading`, `SoilLatestReading`, `SoilHistoryCoverage` and
  `SoilCollectionCheckpoint` to the existing PostgreSQL/Prisma schema.
- Reading identity is `(dataSourceId, stationId, field, observedAt)`. A composite
  station/source foreign key prevents cross-source records. Store finite validated
  double-precision values without unit conversion or fixed-decimal rounding.
- Store original fetch time, ingestion origin (`latest`/`rawHistory`), and a
  revision. Latest uses each field's `_fieldTs`; raw history uses record `ts`.
  Never substitute fetch time for missing observation time.
- Repeated identity/value is idempotent. Changed value at the same timestamp is
  a correction: only a newer fetch generation may win. Serialize/fence writes
  to prevent late responses replacing a newer correction.
- Latest is one row per source/station/field, independent of retained raw rows.
  Older backfill cannot roll it backwards; a newer accepted same-time correction
  may replace its value. Metadata remains revision-aware and unknown when unverified.
- Recheck source activity and collection lease inside every write transaction.
  Removed sources cannot gain new rows through an in-flight response. Reads must
  resolve current account/key/grant/source/station authorization first, including
  Client Developer access. A cursor or stored row never grants access.

### Additive response contract

Keep existing routes, request bounds, envelopes and required DTO fields. Add
`dataOrigin: 'upstream' | 'stored'` to latest/history. For history add:

```ts
type SoilHistoryCoverageDto = {
  status: 'complete' | 'partial' | 'unknown';
  fields: Array<{
    field: SoilField;
    ranges: Array<{ begin: string; end: string }>;
  }>;
};
```

Ranges are bounded to the requested interval and proven completed raw windows,
not inferred from earliest/latest sample or row count. Truncation, invalid fields,
retention, incomplete pages and collection gaps cannot be labeled complete.
Valid exhausted empty windows can prove coverage; malformed responses cannot.

On eligible provider failure, authorized latest may fall back to durable snapshots
after process restart, beyond the old memory-cache grace. Preserve observation time
and original successful fetch time; set `dataOrigin: 'stored'`, `isFromCache: true`
and `isStale: true`. Database reads never mark a source connected. No stored result
means the existing safe upstream error, not fabricated zeroes or measurements.

History can serve only captured local raw readings during outage, with honest
coverage. A local cursor binds source/station/query/order/limit/read origin and an
immutable timestamp keyset, paginating complete timestamp groups. Aggregate complete
UTC buckets before pagination using raw values (`mean/min/max/first/last`), never
upstream aggregates as raw or averages of averages. Upstream and local cursor
chains cannot silently switch origin; require a new query without cursor if needed.
Local aggregation returns only whole UTC buckets contained within the requested
interval; incomplete boundary fragments are withheld, not published as full buckets.

### Collection, backfill and capacity

- Reuse the existing source resolver, validated upstream client and independent
  database lease pattern. No new dependencies or browser requirement.
- Proposed initial collector interval: 120 seconds; at most 2 concurrent station
  requests, 20 stations per tick, 10 raw pages per station/window. Every call keeps
  the configured upstream timeout. Backoff is bounded from 120 seconds to 15 minutes;
  a failure must not starve other active stations. Skip unverified CENTER soil data.
- Fetch latest plus bounded raw catch-up windows (at most 24h per window and 7-day
  raw request bound). Persist overlap/resume checkpoints; advance proven coverage
  only for committed, exhausted ranges. A full ascending page proves the prefix
  ending 1ms before its final timestamp; resume inclusively at that timestamp and
  never claim the unexhausted tail. Stop at an unexhaustible saturated
  timestamp rather than skip samples. Catch up at most the retained 90-day horizon.
- Proposed initial configurable ceilings: 2 million raw field readings per station,
  10 million globally. These are protective limits, not a measured Pi capacity claim.
  At capacity stop new raw collection and expose a finite storage-limit signal;
  preserve existing history/snapshots rather than silently shorten retention.
- Prune readings older than 90 days by observedAt in bounded batches; trim coverage
  and keep latest snapshots. Do not delete audit, lifecycle or notification data.
  Collector shutdown is bounded and commit fencing survives lease expiry/restart.
- Local reads clip expired raw rows/coverage even while bounded physical pruning
  catches up. Capacity/retention use a consistent global-lock-first order. Each
  collector acquisition uses a fresh holder generation; expiry is checked against
  database wall-clock time after lock waits and again before commit.
- Expose only finite collection states/counters through existing private operations
  instrumentation; no credentials, upstream bodies or unbounded metric labels.
- Stored fallback, old backfill and same-time corrections cannot be replayed as new
  alert breach/recovery samples. Regress current freshness/deduplication protections.

### Verification and acceptance

Follow the existing TDD, format, typecheck, lint, build, coverage, dependency/secret
and migration gates. Database tests/migrations target isolated `iot_test` only.
Test deduplication/correction races, older backfill, source consistency/removal,
restart/outage latest/history, empty/partial coverage, cursor origin/binding,
aggregation across pages, current role/grant/key denial, collection progress/backoff/
lease fencing, retention preserving snapshots, capacity stops and alert regressions.

F-data closes only after fresh evidence for those scenarios. A real provider outage
may require deterministic validated fixtures for recovery tests; label that evidence
fixture-verified, not live recovery. Production host/domain, encrypted off-machine
backup destination/owners and actual staging evidence remain separate D gates.
