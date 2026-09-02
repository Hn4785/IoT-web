# Alert and In-App Notification Design

Date: 2026-09-02
Status: Approved for planning after station-data B-core locks its internal interfaces
Module: `alert-config`
Depends on: verified `station-data` B-core for implementation and B-device field
metadata for production activation

## 1. Objective

Phase C-core detects sustained soil-threshold breaches without requiring the
frontend to remain open. It gives authorized Admin and Farmer users a durable,
auditable alert lifecycle and an in-application notification inbox.

The design deliberately does not invent a hardware configuration schema or
pretend to deliver configuration to a device. Device configuration becomes a
separate C-device gate after the hardware team supplies a versioned contract.

Phase C production code must not begin until station-data B-core is implemented
and verified. C-core can then be implemented and tested with explicit fake field
metadata, but real rules cannot be activated until B-device confirms their units
and metadata revisions. This document can be approved before those dependencies
are ready.

## 2. Approved capability split

| Capability id             | Responsibility                                                   | Depends on                  |
| ------------------------- | ---------------------------------------------------------------- | --------------------------- |
| `alert-rules`             | Scoped threshold-rule management with confirmed-unit gating      | registry and field metadata |
| `alert-lifecycle`         | Scheduled evaluation, opening, acknowledgement and resolution    | `alert-rules`, latest soil  |
| `in-app-notifications`    | Durable user inbox for alert lifecycle events                    | `alert-lifecycle`           |
| `device-config-candidate` | Capability status only; no draft, publish or device transmission | approved hardware contract  |

Build order:

```text
station-data B-core
  -> implement/test alert-rules with explicit fake metadata
  -> alert-lifecycle
  -> in-app-notifications
  -> Checkpoint C-core

station-data B-device confirmed field metadata
  -> permit real rule activation

hardware configuration schema
  -> device configuration design review
  -> C-device implementation and verification
```

## 3. Scope

### C-core

- Soil threshold rules for the eight fields approved by station-data.
- Unit and metadata-revision binding that blocks unconfirmed or changed fields.
- Background evaluation every 60 seconds.
- Two distinct observations outside a rule before opening an alert.
- Two distinct observations back inside the rule before automatic resolution.
- Durable evaluation progress across application restarts.
- `OPEN`, `ACKNOWLEDGED` and `RESOLVED` alert states.
- In-app notifications for open, acknowledge and resolve transitions.
- Cursor-paginated browser APIs and OpenAPI contracts.
- Admin global scope and Farmer farm-membership scope.
- A device-configuration capability response that reports the feature as
  unavailable pending the hardware contract.

### Deferred

- Email, SMS, mobile push and every external notification provider.
- Contact-channel preferences, retries and provider delivery status.
- Device configuration payloads, drafts, publishing, rollback, transport and
  device acknowledgement.
- MQTT/HTTPS device ingestion.
- Measurement persistence and a time-series alert stream.
- Sensor-offline alerts, missing-data alerts and derived/agronomic rules.
- Multi-level escalation policies and on-call routing.
- User-defined rule expressions, scripts or arbitrary JSON conditions.
- Distributed scheduling beyond one active evaluator lease.

## 4. Roles and authorization

| Actor            | Rules                                     | Alerts and notifications                     | Device configuration             |
| ---------------- | ----------------------------------------- | -------------------------------------------- | -------------------------------- |
| Admin            | Manage rules for every registered station | View and act across the current registry     | View unavailable capability only |
| Farmer           | Manage rules in currently assigned farms  | View and act within currently assigned farms | View unavailable capability only |
| Client Developer | No access                                 | No access                                    | No access                        |

Every request re-evaluates current account status, role and resource scope from
PostgreSQL. A notification row naming a user is not sufficient authorization:
the referenced alert must also remain in that user's current station scope.

Unknown and out-of-scope IDs use the same `404 NOT_FOUND` response. Menu hiding
in the frontend is never an authorization boundary.

## 5. Architecture and data flow

```text
                         PostgreSQL evaluator lease
                                     |
60-second scheduler -----------------+
        |
        v
enabled rules in bounded batches
        |
        v
StationDataService.getLatestSoil(station, field)
        |
        +-- unavailable / missing / stale --> record safe evaluation result;
        |                                     keep counters unchanged
        v
new field observedAt?
        |
        +-- no --> no counter change
        v
pure AlertEvaluator decision
        |
        v
transaction: lock state -> update counters -> transition alert
        |
        v
unique lifecycle event -> unique per-recipient in-app notification
```

The evaluator consumes the internal normalized station-data service rather than
calling Weather directly. This preserves the Phase B validation, cache and
authorization-independent data boundary. The scheduler uses registry IDs and
never accepts a caller-controlled upstream host or path.

Phase C consumes an additive station-data internal boundary:

```ts
type SoilFieldMetadata =
  | { field: SoilAlertField; isConfirmed: false }
  | { field: SoilAlertField; isConfirmed: true; unit: string; revision: string };
```

The opaque revision changes whenever unit or value-comparison semantics change.
Unrelated display metadata does not invalidate rules. The real metadata source
belongs to B-device; until then production returns `isConfirmed: false`, while
C-core tests inject explicit confirmed fixtures.

External I/O happens before the short database transaction. The transaction
then compares `observedAt` again while holding the evaluation-state lock, so two
workers that fetched the same sample cannot count it twice.

## 6. Alert-rule contract

### Routes

All routes use the existing `/api/v1` prefix and Bearer authentication.

```text
GET   /stations/:stationId/alert-rules?limit=50&cursor=...
POST  /stations/:stationId/alert-rules
GET   /alert-rules/:ruleId
PATCH /alert-rules/:ruleId
```

There is no physical-delete route. A rule that has produced evidence is retained
and can be disabled.

### Types

```ts
type SoilAlertField =
  'temperature' | 'moisture' | 'ec' | 'ph' | 'nitrogen' | 'phosphorus' | 'potassium' | 'light';

type AlertCondition =
  | { operator: 'ABOVE'; threshold: number }
  | { operator: 'BELOW'; threshold: number }
  | { operator: 'OUTSIDE_RANGE'; lowerThreshold: number; upperThreshold: number };

type AlertRuleDto = {
  id: string;
  stationId: string;
  field: SoilAlertField;
  unit: string;
  metadataRevision: string;
  condition: AlertCondition;
  severity: 'WARNING' | 'CRITICAL';
  requiredBreachSamples: 2;
  requiredRecoverySamples: 2;
  isEnabled: boolean;
  evaluationStatus: 'READY' | 'DISABLED' | 'BLOCKED_METADATA';
  revision: number;
  createdAt: string;
  updatedAt: string;
};
```

Create input contains `field`, `unit`, `expectedMetadataRevision`, `condition`,
`severity` and optional `isEnabled` defaulting to true.
`requiredBreachSamples`, `requiredRecoverySamples`, `metadataRevision` and
`evaluationStatus` are server-owned response fields.

Condition values must be finite JSON numbers. `OUTSIDE_RANGE` requires
`lowerThreshold < upperThreshold`. The backend does not impose speculative
physical sensor ranges until B-device validation supplies them.

Creating or enabling a rule requires station-data to report a confirmed,
non-null unit and metadata revision for that station field. Input `unit` and
`expectedMetadataRevision` must exactly match the current server metadata. An
unconfirmed field returns `409 FIELD_METADATA_UNCONFIRMED`; a stale client
revision or unit returns `409 FIELD_METADATA_CHANGED`. Threshold numbers are
always interpreted in the unit stored on the rule.

Fake B-core tests may provide explicit test metadata, but development fixtures
must be visibly marked non-production and cannot make a real station confirmed.

At most one enabled rule exists for a `(stationId, field)` pair. Concurrent
enable/create operations are enforced by the database and normalize to
`409 ACTIVE_RULE_EXISTS`.

PATCH accepts only `condition`, `severity`, `unit`,
`expectedMetadataRevision`, `isEnabled` and `expectedRevision`; `stationId` and
`field` are immutable. A revision mismatch returns `409 VERSION_CONFLICT`.
Condition, severity or metadata binding cannot be changed while an unresolved
alert exists. Disabling a rule atomically resolves its unresolved alert with
reason `RULE_DISABLED`; it never deletes alert or evaluation evidence. A
disabled rule may then be rebound to current confirmed metadata, edited and
re-enabled.

PATCH does not accept an idempotency key. Its optimistic revision ensures at
most one mutation for a revision; after a network result is uncertain, the
caller must GET the rule and reconcile its current revision before retrying.

POST requires an `Idempotency-Key`. The server claims the key atomically with a
request fingerprint, retains the successful result for seven days, rejects an
in-flight duplicate with `409 REQUEST_IN_PROGRESS`, and rejects reuse with a
different payload using `409 IDEMPOTENCY_KEY_REUSED`.

## 7. Evaluation semantics

The scheduler attempts a named PostgreSQL-backed lease every 60 seconds. Only
the current lease holder enumerates rules. Rules are read in deterministic,
bounded batches; the initial batch size is 50. Rules in a batch are grouped by
station, and one latest call requests the unique fields needed for that station.
A failure on one station is isolated and does not stop the rest of the batch.
The scheduler persists a round-robin continuation and stops before its lease
deadline, so a large registry cannot permanently starve rules that sort later.

For each rule:

1. Request exactly its station and field from station-data latest.
2. Load the current confirmed field metadata. When the unit or metadata revision
   no longer matches the rule, mark it `BLOCKED_METADATA`, leave counters
   unchanged and resolve any unresolved alert with reason `METADATA_CHANGED`.
3. Reject the sample from rule evaluation when the field is absent, its value is
   invalid, its timestamp is invalid, its field quality is `stale`, or the
   latest response is a stale-if-error cache response.
4. Compare the field `observedAt` with the durable last processed timestamp.
5. Ignore an equal or older timestamp. Cached calls never manufacture a second
   observation.
6. Evaluate the condition using the numeric value unchanged from station-data.
7. On breach, increment consecutive breach count and clear recovery count.
8. On normal, increment consecutive recovery count and clear breach count.
9. Apply a transition only after the second distinct qualifying observation.

No epsilon, unit conversion or guessed calibration is applied. Exact equality
is normal for `ABOVE` and `BELOW`; it is inside the range for `OUTSIDE_RANGE`.

The evaluator stores only the minimum operational snapshot: last processed
observation timestamp and value, last evaluation time, safe result code,
consecutive breach count and consecutive recovery count. It does not become a
measurement history store.

## 8. Alert lifecycle

```text
                         acknowledge
OPEN --------------------------------------------> ACKNOWLEDGED
  |                                                     |
  | two normal samples or permitted manual resolution   | same
  +---------------------------> RESOLVED <---------------+
```

Only one unresolved alert may exist for a rule. A database uniqueness mechanism
is the final duplicate guard. Further breached observations update the alert's
`latestValue`, `latestObservedAt` and `updatedAt`; they do not create another
alert.

```ts
type AlertDto = {
  id: string;
  ruleId: string;
  station: { id: string; code: string; name: string };
  field: SoilAlertField;
  unit: string;
  metadataRevision: string;
  condition: AlertCondition;
  severity: 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  openedValue: number;
  openedObservedAt: string;
  latestValue: number;
  latestObservedAt: string;
  openedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionReason: 'RECOVERED' | 'MANUAL' | 'RULE_DISABLED' | 'METADATA_CHANGED' | null;
  revision: number;
};
```

Routes:

```text
GET  /alerts?stationId=&status=&severity=&limit=50&cursor=...
GET  /alerts/:alertId
POST /alerts/:alertId/acknowledgements
POST /alerts/:alertId/resolutions
```

List limits default to 50 and are bounded to 100. Cursors are opaque and bind to
the original filters and current sort contract (`updatedAt desc`, then `id`
descending). Malformed or mismatched cursors return `400 VALIDATION_ERROR`.

Acknowledge accepts an optional plain-text `note` of at most 500 characters.
It changes `OPEN` to `ACKNOWLEDGED`; acknowledging an already acknowledged or
resolved alert returns the current representation without another event.

Manual resolution accepts an optional plain-text `note` of at most 500
characters. It is allowed only after the latest distinct observation evaluates
normal. A still-breached or unknown condition returns
`409 ALERT_STILL_ACTIVE`. Automatic recovery does not require prior
acknowledgement.

Both action routes require `Idempotency-Key` and use the same atomic claim,
fingerprint and seven-day retention contract as rule creation.

Every real transition writes one immutable lifecycle event with event type,
actor when present, safe note, timestamp and request ID. Scheduler events use no
fake human actor. Domain evidence in this module is separate from the broader
operations audit-query API deferred to Phase D.

## 9. In-app notifications

One notification is generated for each eligible recipient and each immutable
`OPENED`, `ACKNOWLEDGED` or `RESOLVED` lifecycle event. Eligible recipients are:

- every active Admin account; and
- active Farmer accounts with a current membership in the alert's farm.

Client Developer accounts never receive Phase C notifications. A uniqueness
constraint on `(lifecycleEventId, recipientUserId)` makes delivery idempotent.

```ts
type InAppNotificationDto = {
  id: string;
  alertId: string;
  eventType: 'OPENED' | 'ACKNOWLEDGED' | 'RESOLVED';
  station: { id: string; code: string; name: string };
  field: SoilAlertField;
  severity: 'WARNING' | 'CRITICAL';
  alertStatus: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};
```

Routes:

```text
GET   /notifications?isRead=&limit=50&cursor=...
PATCH /notifications/:notificationId
```

PATCH accepts only `{ "isRead": boolean }` and is naturally idempotent. Marking
read stores server time; marking unread clears `readAt`. The list response is a
cursor page plus `unreadCount` computed for the caller's current authorized
notification scope.

Notifications contain a safe snapshot for display but access still requires
both recipient ownership and current alert scope. Removing a farm membership
immediately hides related notifications from that Farmer. Retained rows remain
available for authorized operational retention and audit processing.

There are no channel-preference, retry, provider or contact-address models in
C-core.

## 10. Device-configuration boundary

C-core exposes only:

```text
GET /device-configurations/capability
```

for Admin and Farmer browser principals. It returns:

```ts
type DeviceConfigurationCapabilityDto = {
  status: 'NOT_AVAILABLE';
  reasonCode: 'DEVICE_CONTRACT_PENDING';
};
```

The endpoint lets the frontend disable the configuration page honestly. C-core
does not create configuration tables, empty versions, arbitrary JSON payloads
or publish endpoints.

C-device requires a new approved design covering the hardware schema version,
allowed fields and units, compatibility rules, transport, desired versus
reported state, publish authorization, rollback, acknowledgement, timeout and
failure behavior. That work may add capability states without changing the
meaning of `NOT_AVAILABLE`.

## 11. Persistence model and concurrency invariants

The implementation plan may choose exact Prisma names, but the schema must
enforce these concepts:

| Record              | Required invariant                                                   |
| ------------------- | -------------------------------------------------------------------- |
| Alert rule          | One enabled row per station/field; immutable unit/revision snapshot  |
| Evaluation state    | Exactly one durable state row per rule                               |
| Alert               | At most one unresolved occurrence per rule                           |
| Lifecycle event     | Immutable and uniquely tied to a real transition                     |
| In-app notification | Unique per lifecycle event and recipient                             |
| Idempotency record  | Unique key within operation scope; request fingerprint cannot change |
| Evaluator lease     | At most one unexpired holder for the named alert evaluator           |

Thresholds and observed values use one consistent database numeric type. All
timestamps are UTC `timestamptz` and all public timestamps are ISO 8601.

The active-rule and unresolved-alert invariants must be backed by database
constraints or an equivalent atomic key, not only by service-layer checks.
State transition, lifecycle event and notification creation occur in one
transaction. A transaction retry must not generate duplicate events.

### Retention and privacy

- Unresolved alerts and their lifecycle evidence are never age-purged.
- Resolved alerts and lifecycle events are retained for 365 days after
  resolution, then removed by bounded maintenance.
- In-app notifications are retained for 180 days, then removed whether read or
  unread; the underlying alert remains subject to its own retention.
- Idempotency records are removed after their approved seven-day retry window.
- Rule and evaluation state remain while their station/rule exists; deletion
  behavior must preserve any still-retained alert evidence.
- Notes are optional operational text, not a place for contact details or other
  personal data. User anonymization preserves stable evidence links while public
  actor display follows the existing `Deleted user` identity contract.

The existing explicit retention command may be extended for C-core. Production
scheduling and backup expiry remain Phase D responsibilities, but the C-core
deletion behavior must be integration-tested before acceptance.

## 12. Errors and HTTP behavior

All responses retain the existing success and normalized error envelopes.

| Condition                                             | HTTP/code                        |
| ----------------------------------------------------- | -------------------------------- |
| Invalid body, filter, note, cursor or idempotency key | `400 VALIDATION_ERROR`           |
| Missing or invalid authentication                     | `401 UNAUTHENTICATED`            |
| Authenticated role is not allowed in Phase C          | `403 FORBIDDEN`                  |
| Unknown or out-of-scope resource                      | `404 NOT_FOUND`                  |
| Station field has no confirmed unit/revision          | `409 FIELD_METADATA_UNCONFIRMED` |
| Submitted or stored metadata no longer matches        | `409 FIELD_METADATA_CHANGED`     |
| Enabled rule already exists for station/field         | `409 ACTIVE_RULE_EXISTS`         |
| Optimistic revision mismatch                          | `409 VERSION_CONFLICT`           |
| Rule mutation conflicts with unresolved alert         | `409 ACTIVE_ALERT_EXISTS`        |
| Manual resolution while breached or unknown           | `409 ALERT_STILL_ACTIVE`         |
| Same idempotency key with another payload             | `409 IDEMPOTENCY_KEY_REUSED`     |
| Duplicate request is still executing                  | `409 REQUEST_IN_PROGRESS`        |
| Unexpected internal failure                           | `500 INTERNAL_ERROR`             |

Station-data failures occur inside the scheduler, not the browser request. They
are recorded as bounded safe result codes and observable logs with request/run
correlation, while counters remain unchanged. Raw upstream bodies and stack
traces never enter public responses or database notes.

## 13. Threat model

### Trust boundaries and assets

- Browser input crosses the HTTP validation boundary.
- Current identity and membership state crosses the authorization boundary.
- Latest soil crosses the already validated station-data boundary.
- Scheduler execution crosses a time/concurrency boundary without a human
  principal.
- Alert state, notes and notification visibility are business and privacy
  assets.

### Abuse cases and controls

| Abuse case                                        | Control                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| Farmer guesses another farm's IDs                 | Current scope check and safe 404                                           |
| Duplicate scheduler workers open duplicate alerts | Timestamp dedupe, row lock, transaction and unique unresolved-alert key    |
| Cached sample counts twice                        | Field `observedAt` must advance                                            |
| Unit changes silently reinterpret a threshold     | Bind confirmed unit/revision; block and resolve on mismatch                |
| Crafted threshold uses NaN/infinity               | Boundary schema accepts finite JSON numbers only                           |
| Note carries stored XSS                           | Plain text, length cap, DTO output and frontend escaping                   |
| Retry duplicates a transition                     | Atomic idempotency claim plus unique lifecycle event                       |
| Former member reads retained notification         | Recipient ownership plus current resource-scope check                      |
| Scheduler overloads Weather or PostgreSQL         | One lease holder, 60-second cadence, bounded batches and isolated failures |
| Client Developer reaches browser alert APIs       | Role denial before resource lookup                                         |

Rate-limit changes are not introduced silently. Existing authenticated global
limits remain, and any Phase C-specific limit must be approved in the
implementation plan before code changes.

## 14. Runtime settings

The implementation adds validated, bounded environment settings:

```env
ALERT_EVALUATION_INTERVAL_MS=60000
ALERT_EVALUATION_BATCH_SIZE=50
ALERT_EVALUATOR_LEASE_MS=55000
ALERT_IDEMPOTENCY_RETENTION_HOURS=168
```

Production refuses unsafe values. The lease must be shorter than the interval;
batch size and interval bounds prevent accidental unbounded load. Tests use an
injected clock and invoke the evaluator directly instead of sleeping.

## 15. Project structure and style

Expected ownership:

```text
src/alert-config/              contracts, controllers, rules and lifecycle
src/alert-config/evaluation/   pure decision logic and scheduled orchestration
src/notifications/             in-app notification contract and persistence
prisma/schema.prisma           durable Phase C state and invariants
test/                          HTTP/database integration fixtures where needed
docs/superpowers/specs/        approved design
```

Contracts use Zod at HTTP and environment boundaries. Internal decisions use
typed values and explicit discriminated unions:

```ts
type EvaluationDecision =
  | { type: 'NO_NEW_SAMPLE' }
  | { type: 'UNUSABLE_SAMPLE'; reason: 'MISSING' | 'STALE' | 'INVALID' }
  | { type: 'TRACK_BREACH'; consecutiveCount: number }
  | { type: 'OPEN_ALERT'; value: number; observedAt: string }
  | { type: 'TRACK_RECOVERY'; consecutiveCount: number }
  | { type: 'RESOLVE_ALERT'; value: number; observedAt: string };
```

The pure evaluator does not perform HTTP, database writes, logging or clock
reads. Controllers do not contain authorization or state-machine business
logic. Database records are never returned directly.

## 16. Commands

```powershell
# Development
pnpm dev

# Focused tests during implementation
pnpm test src/alert-config
pnpm test src/notifications

# Full verification
pnpm test
pnpm test:coverage
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm audit --prod
pnpm db:status
```

No test command may target the development database. Migration verification
uses the existing isolated `iot_test` safety boundary.

## 17. Testing strategy

### Pure evaluator

- First distinct breach tracks one; second opens.
- Exact repeated or older timestamps never advance counters.
- First distinct normal sample tracks recovery; second resolves.
- Equality is normal according to the approved operator semantics.
- Invalid, missing and stale samples leave counters unchanged.
- Confirmed metadata permits evaluation; missing or changed metadata blocks it.
- Rule disable and metadata change yield deterministic resolution decisions.

### Database and concurrency

- Restart/re-instantiation preserves evaluation progress.
- Concurrent rule enables produce one enabled rule.
- Concurrent evaluators processing one sample create one alert.
- One transition creates one lifecycle event and one notification per recipient.
- Transaction retries do not duplicate evidence.
- Idempotency claims reject changed payloads and replay successful results.
- Revision conflicts never overwrite a newer rule.

### HTTP and authorization

- Admin operates across the registry.
- Farmer operates only within current memberships.
- Client Developer receives no Phase C access.
- Unknown and cross-scope IDs are indistinguishable.
- Lists are deterministic, bounded and cursor-safe.
- Notes and unexpected fields are rejected or normalized by the contract.
- Removing membership closes alert and notification access immediately.
- OpenAPI contains exact schemas, security and response codes.

### Scheduler and failure isolation

- Only the lease holder evaluates.
- Batch boundaries are deterministic.
- One station-data failure does not abort other rules.
- Stale-if-error data cannot open or recover an alert.
- A metadata change blocks the rule and resolves its open alert exactly once.
- Tests use fake station-data, an injected clock and no real Weather service.

## 18. Boundaries

### Always

- Start every behavior with a failing test and keep commits atomic.
- Validate HTTP, environment and station-data boundaries.
- Recheck current authorization before every protected read or mutation.
- Bind every threshold to a confirmed unit and metadata revision.
- Use database-enforced uniqueness for duplicate-sensitive state.
- Preserve normalized envelopes, UTC timestamps and request correlation.
- Keep Phase C-core independently testable with fake station-data.

### Ask first

- Change a role permission, auth flow, CORS rule or rate limit.
- Add a dependency or external provider.
- Change the one-rule-per-station-field invariant or sample counts.
- Add measurement persistence or new alert fields/operators.
- Introduce any device-configuration payload or publish endpoint.

### Never

- Begin Phase C implementation before station-data B-core verification.
- Count the same observation twice.
- Treat missing/stale data as a threshold breach or recovery.
- Compare a threshold when unit metadata is absent or has changed.
- Return or log credentials, tokens, upstream bodies or internal errors.
- Trust frontend scope checks.
- Store arbitrary scripts, expressions or device JSON as an alert rule.
- Claim device configuration is published or acknowledged without a device
  contract and transport evidence.

## 19. Delivery checkpoints

1. **AC-1:** approve this written design.
2. **AC-2:** implement scoped, version-safe alert rules.
3. **AC-3a:** implement durable evaluation and duplicate-safe opening.
4. **AC-3b:** implement acknowledgement and deterministic resolution.
5. **Checkpoint C1:** review state transitions, sample deduplication,
   concurrency and idempotency evidence.
6. **AC-4:** implement in-app notification inbox and current-scope visibility.
7. **Checkpoint C-core:** frontend replaces alert and notification mocks.
8. **C-device design gate:** hardware schema and transport are approved before
   any configuration implementation.

## 20. Success criteria

C-core is complete only when:

- two new breached samples open exactly one alert without an open frontend;
- unconfirmed or changed unit metadata prevents real threshold evaluation;
- two new normal samples resolve that alert deterministically;
- acknowledge and manual resolution obey their state and idempotency contracts;
- Admin and Farmer scopes work from current database state and Client Developer
  is denied;
- each lifecycle event creates at most one visible notification per eligible
  recipient;
- restarts, concurrent workers, cache hits and retries do not duplicate counts,
  alerts, events or notifications;
- device configuration is reported unavailable and no fake publish capability
  exists;
- focused tests, full tests, coverage, formatting, lint, typecheck, build,
  dependency audit, migration checks and secret review pass;
- the frontend can replace only its alert and in-app notification mock data.

C-core implementation may reach this checkpoint with explicit fake metadata.
Production activation of real rules additionally requires B-device evidence for
the station field's unit and metadata revision.

## 21. Closed and future questions

No open decision blocks C-core specification review. The following are
explicitly future C-device or provider decisions rather than unspecified work:

- official hardware configuration schema and schema-version negotiation;
- device transport, desired/reported state and acknowledgement timeout;
- approved sensor units, physical ranges and field-specific stale thresholds;
- Email/SMS/Push providers, contact verification and delivery preferences;
- production-scale event ingestion replacing Weather polling.
