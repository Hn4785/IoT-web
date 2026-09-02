# Design Spec: `identity-access`

Date: 2026-09-02
Status: Implemented and verified
Initiative: IoT Soil Monitoring Backend
Depends on: `integration-core`

## Objective

`identity-access` introduces durable accounts, secure browser sessions, the
approved three-role authorization model, farm/plot/station scope enforcement,
and Client Developer API-key lifecycle management.

It makes authentication and authorization reusable by later modules. It does
not expose station observations, history, alerts or IoT configuration.

## Approved product decisions

- PostgreSQL runs locally through Docker Compose and Prisma owns migrations.
- Local durable database files live under `E:/IoT-data/postgres` and never enter
  Git.
- Accounts are provisioned by administrators; public registration is disabled.
- Browser access uses a short-lived access JWT plus a rotating refresh token in
  an HttpOnly cookie.
- Passwords require at least 12 characters and are hashed with Argon2id.
- Five consecutive login failures lock authentication for 15 minutes.
- Administrators issue one-time temporary passwords; the user must change the
  password on first login. Email-based recovery is deferred.
- There are exactly three business roles: `ADMIN`, `FARMER`, and
  `CLIENT_DEVELOPER`.
- Exactly one `ADMIN` holds the separate `SUPER_ADMIN` system authority.
- Farmers inherit read scope from assigned farms to their plots and stations.
- Client Developers have no business UI and access only explicitly granted
  stations through API keys.
- Client API keys expire after 90 days by default and have a default limit of 60
  requests per minute per key.
- Active refresh sessions last at most seven days; access JWTs last 15 minutes.
- Revoked session evidence is retained for 30 days, security audit evidence for
  at least 365 days, and revoked API-key metadata for 90 days.

## Success criteria

- A clean PostgreSQL database can be migrated reproducibly and inspected using
  DBeaver.
- One initial Super Admin can be bootstrapped without storing a plaintext secret
  in source, shell history or migration data.
- Administrators can provision accounts within their authority; no registration
  endpoint exists.
- Login, forced first password change, refresh rotation, logout and revocation
  have stable HTTP contracts and safe failures.
- A reused refresh token revokes its full session family.
- Role, account-status and authority changes invalidate affected sessions and
  API keys immediately.
- Only the Super Admin can promote to or demote from `ADMIN`, mutate another
  Admin, or transfer the `SUPER_ADMIN` authority.
- A Farmer cannot read a farm, plot or station outside assigned farm scope.
- A Client Developer API key cannot read an unassigned station or mutate
  business resources.
- Secrets, hashes, Prisma errors and account-existence signals never reach logs
  or public errors.
- Every production behavior is introduced through a verified red-green-refactor
  cycle.

## Scope

### Included

- Docker Compose PostgreSQL development/test services.
- Prisma client, schema and forward migrations.
- User lifecycle, role and account status.
- Single-Super-Admin authority and atomic transfer.
- Password hashing, temporary-password flow and login lockout.
- Access JWT and refresh-session lifecycle.
- Role and resource-scope guards.
- Minimal farm/plot/station ownership registry needed for authorization.
- Client Developer API-key creation, rotation, revocation and station grants.
- Minimum append-only security audit evidence for Phase A actions.
- OpenAPI contracts and real-HTTP integration tests.

### Excluded

- Public registration, email invitations and email password recovery.
- Public station/latest/history endpoints and sensor observations.
- Alert rules, notification delivery and IoT configuration.
- Full audit-search UI, monitoring, deployment, backup and restore automation.
- External identity providers, social login, MFA and SSO.

## Architecture

```text
Browser request
    |
    |-- Authorization: Bearer <short-lived JWT>
    |-- HttpOnly refresh cookie on refresh/logout only
    v
NestJS + Fastify
    |-- AuthModule ---------------- password and session lifecycle
    |-- IdentityModule ------------ users, roles and Super Admin transfer
    |-- AuthorizationModule ------- current role and resource scope
    |-- ApiKeyModule -------------- client credential lifecycle
    |-- SecurityAuditModule ------- append-only Phase A evidence
    `-- DatabaseModule ------------ Prisma boundary
                                      |
                                      v
                                  PostgreSQL
```

Database records remain private. Controllers return dedicated DTOs through the
existing success/error envelopes. Later modules depend on typed identity and
authorization interfaces rather than importing Prisma repositories directly.

### DatabaseModule

- Own one application-scoped Prisma client and explicit repository boundaries.
- Validate `DATABASE_URL` at startup without including credentials in errors.
- Never run migrations as an application-start side effect.
- Map known persistence conflicts to typed application errors and hide raw
  Prisma messages from callers.
- Support a clean `iot_dev` database and an isolated `iot_test` database.

### IdentityModule

- Provision, list and update safe user records.
- Enforce administrator authority rules before mutations.
- Coordinate role/status changes with session and API-key revocation.
- Transfer the singleton Super Admin authority atomically.
- Expose safe identity DTOs and current-user lookups to other modules.

### AuthModule

- Hash and verify passwords with Argon2id.
- Enforce temporary-password change, login failure tracking and lockout.
- Issue short-lived access JWTs and rotating opaque refresh tokens.
- Detect refresh-token reuse by session family.
- Revoke a session, all user sessions, or a complete token family.

### AuthorizationModule

- Load the current user, role, account status and session on every protected
  request; JWT claims are never the source of current authorization truth.
- Apply role requirements and farm/plot/station scope through centralized typed
  policies.
- Return a non-leaking denial for both nonexistent and unauthorized resources
  where revealing existence would disclose another tenant's data.

### ApiKeyModule

- Generate high-entropy opaque keys and show each new secret exactly once.
- Store only a keyed hash plus a non-secret prefix for identification.
- Restrict keys to Client Developer owners and explicit station grants.
- Enforce expiry, revocation and per-key rate-limit identity.
- Revoke all keys immediately when the owner is disabled or changes role.

### SecurityAuditModule

- Append security evidence for authentication failures, lockouts, password
  changes, session reuse, user provisioning, role/status changes, credential
  revocation and Super Admin transfer.
- Record actor, action, target, result, UTC time, request ID and sanitized
  metadata.
- Provide no public update or deletion contract.
- Remain a narrow Phase A boundary; generalized business audit querying belongs
  to `operations`.

## Local PostgreSQL and DBeaver contract

Docker Compose declares PostgreSQL but receives the host bind-mount path from an
ignored local environment value:

```text
POSTGRES_DATA_DIR=E:/IoT-data/postgres
POSTGRES_DB=iot_dev
POSTGRES_TEST_DB=iot_test
POSTGRES_USER=<local value>
POSTGRES_PASSWORD=<local secret>
```

The committed `.env.example` contains placeholders only. The runtime directory,
database passwords and connection URLs are ignored by Git.

Development PostgreSQL is exposed on `localhost:5432` for the backend and
DBeaver. Test PostgreSQL uses a separate database and must not truncate or mutate
development data. Docker health checks gate migration and test commands.

## Data model

All identifiers use UUIDs. Timestamps are stored in UTC. Public timestamps are
ISO 8601 strings.

### `User`

- `id`
- `email` with a normalized unique constraint
- `displayName`
- `passwordHash`
- `role`: `ADMIN | FARMER | CLIENT_DEVELOPER`
- `status`: `ACTIVE | DISABLED | PENDING_PASSWORD_CHANGE`
- failed-login count and lock expiry
- password-changed, deletion-requested, anonymized, created and updated times

Password hashes and lockout internals never appear in a public DTO.

### `SystemAuthority`

- singleton authority key `SUPER_ADMIN`
- `holderUserId`, which must reference an active `ADMIN`
- created and updated times

The service serializes authority transfer in one database transaction. It first
validates the successor, records evidence, assigns the successor, then removes
the former holder's authority. No endpoint can delete, disable, anonymize or
demote the holder before a successful transfer.

### `Session`

- `id`, `userId`, opaque token hash and non-secret token identifier
- `familyId` for rotation/reuse detection
- expiry, last-used, revoked and replacement metadata
- bounded user-agent/IP evidence for security review

Refresh-token plaintext exists only during issuance. Expired/revoked session
evidence is purged after 30 days.

### Authorization registry

- `Farm`: identity and ownership root only.
- `Plot`: belongs to one farm.
- `Station`: belongs to one plot and has a unique upstream station identifier.
- `FarmMembership`: unique user/farm assignment for Farmers.

Phase A does not return this registry as station-data DTOs. A Farmer's authorized
station set is derived through `FarmMembership -> Farm -> Plot -> Station`.
Moving a station to another plot changes effective authorization immediately.

### `ClientStationGrant`, `ApiKey` and `ApiKeyStationScope`

`ClientStationGrant` records the maximum station set that an Admin assigns to a
Client Developer. `ApiKey` stores owner, name, prefix, keyed hash, expiry,
rate-limit, last-used, revoked and created metadata. The key station-scope join
may select only a subset of the owner's current grants. A key without station
scope has no data access. Removing an account-level grant removes every matching
key scope in the same transaction.

Expired or revoked key metadata is retained for 90 days. Plaintext API keys are
never retained.

### `SecurityAuditEvent`

Stores immutable actor, action, target, result, request ID, UTC timestamp and
sanitized JSON metadata. Secret-like field names are rejected or redacted before
persistence. Phase A retention is at least 365 days.

## Role and authority rules

| Actor            | Allowed account operations                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| Super Admin      | All Admin operations; create/mutate Admins; change any business role; transfer Super Admin authority  |
| Admin            | Create/list/update/disable/reset Farmer and Client Developer accounts; assign Farmer farm memberships |
| Farmer           | Read own safe profile and later read resources inherited from assigned farms                          |
| Client Developer | Read own safe profile; manage own API keys and their grants only within stations assigned by an Admin |

An Admin cannot mutate an Admin account, including itself, unless it is the Super
Admin. No account can grant itself a higher role or broader station scope.

Role changes remove incompatible memberships and keys, revoke all active
sessions, and require a new login. Repeating a change to the already-current role
is an idempotent no-op and does not create unnecessary credential churn.

## Authentication and credential policy

### Bootstrap

A one-time interactive backend command creates the first Super Admin only when
no users and no authority record exist. It accepts an email, prompts for the
initial password without echo, and commits the user plus authority atomically.
The password is never accepted as a command argument, environment value,
migration literal or log field. Subsequent bootstrap attempts fail safely.

### Passwords

- Minimum length is 12 Unicode characters with a bounded maximum input size.
- Argon2id parameters are explicit, reviewed and stored in the encoded hash.
- Newly provisioned/reset accounts receive a server-generated temporary secret
  returned once with `Cache-Control: no-store`.
- A pending-password-change account can access only current-profile,
  change-password, refresh and logout flows.
- Five consecutive invalid logins lock authentication for 15 minutes.
- Success clears the failure counter; errors do not reveal whether an account
  exists, is disabled or is locked.

### Browser session

- Access JWT lifetime: 15 minutes.
- Refresh-session absolute lifetime: seven days.
- Access JWT contains only issuer/audience/time claims, `sub` and `sessionId`.
- The refresh token is opaque, high entropy and rotated after every valid use.
- Production refresh cookie is `HttpOnly`, `Secure`, `SameSite=Strict`, scoped to
  refresh/logout paths as narrowly as the framework permits.
- Refresh/logout validate the configured frontend `Origin` in addition to cookie
  policy.
- A reused replaced token revokes the full family and records an audit event.
- Password, role, status and Super Admin changes revoke affected sessions.

Signing keys, token-hash peppers and password/database secrets are validated at
startup and never share values. Production refuses weak/missing secrets or an
unapproved frontend origin.

### Client API keys

- Default lifetime: 90 days.
- Default per-key rate: 60 requests per minute.
- Initial permission set is read-only stations/latest/history for explicitly
  granted stations; actual data routes arrive in `station-data`.
- Creation/rotation returns the plaintext key exactly once with no-store headers.
- Rotation and revocation invalidate the previous key immediately.
- Owner disablement, deletion or role change revokes every owned key.

## Public HTTP contracts

All request bodies reject unknown properties. Identifiers and bounded strings are
schema validated. Responses use the `integration-core` envelopes.

| Method | Path                                                      | Authentication and authority                 |
| ------ | --------------------------------------------------------- | -------------------------------------------- |
| POST   | `/api/v1/auth/login`                                      | Public, dedicated rate limit                 |
| POST   | `/api/v1/auth/refresh`                                    | Refresh cookie plus allowed Origin           |
| POST   | `/api/v1/auth/logout`                                     | Current access or refresh session            |
| GET    | `/api/v1/auth/me`                                         | Authenticated                                |
| POST   | `/api/v1/auth/change-password`                            | Authenticated, including forced-change state |
| POST   | `/api/v1/admin/users`                                     | Admin; only Super Admin may create an Admin  |
| GET    | `/api/v1/admin/users`                                     | Admin, bounded pagination/filtering          |
| PATCH  | `/api/v1/admin/users/{userId}`                            | Authority matrix above                       |
| POST   | `/api/v1/admin/users/{userId}/reset-password`             | Authority matrix above                       |
| PUT    | `/api/v1/admin/users/{userId}/farm-memberships/{farmId}`  | Admin for Farmer targets                     |
| DELETE | `/api/v1/admin/users/{userId}/farm-memberships/{farmId}`  | Admin for Farmer targets                     |
| PUT    | `/api/v1/admin/users/{userId}/station-grants/{stationId}` | Admin for Client Developer targets           |
| DELETE | `/api/v1/admin/users/{userId}/station-grants/{stationId}` | Admin for Client Developer targets           |
| POST   | `/api/v1/admin/super-admin/transfer`                      | Super Admin plus current-password recheck    |
| GET    | `/api/v1/developer/api-keys`                              | Client Developer owner                       |
| POST   | `/api/v1/developer/api-keys`                              | Client Developer owner                       |
| POST   | `/api/v1/developer/api-keys/{apiKeyId}/rotate`            | Owner                                        |
| POST   | `/api/v1/developer/api-keys/{apiKeyId}/revoke`            | Owner or authorized Admin                    |

The safe user DTO contains identifier, email, display name, role, status,
`isSuperAdmin`, assigned farm identifiers where authorized, and timestamps. It
never contains password/session/API-key hashes or lockout implementation data.

Login returns an access token, expiry seconds and the safe current-user DTO. The
refresh token is set only as a cookie. User creation/reset and API-key
creation/rotation have dedicated one-time-secret response DTOs and no-store
headers.

## Error contract

The existing normalized error envelope remains unchanged. Phase A introduces
stable codes including:

- `INVALID_CREDENTIALS`
- `ACCOUNT_DISABLED`
- `PASSWORD_CHANGE_REQUIRED`
- `SESSION_EXPIRED`
- `SESSION_REUSED`
- `FORBIDDEN`
- `SCOPE_DENIED`
- `CONFLICT`
- `RATE_LIMITED`

Login uses `INVALID_CREDENTIALS` for unknown email, wrong password, lockout and
other existence-sensitive failures. Database constraint details, hashes, stack
traces and raw exception messages never cross the HTTP boundary.

## Consistency and failure handling

- Super Admin transfer is serializable and atomic.
- User role/status mutation, incompatible grant cleanup, credential revocation
  and required security evidence succeed together or roll back together.
- Refresh rotation uses a conditional update so two concurrent refreshes cannot
  both succeed.
- User/API-key uniqueness conflicts return a stable safe conflict response.
- Audit persistence required by a security mutation is part of that transaction;
  a failed audit write aborts the mutation.
- Database unavailability maps to a safe service-unavailable response and
  structured redacted diagnostics.

## Security controls

- Strict schemas and body-size bounds at every HTTP boundary.
- Dedicated rate limits for login, refresh, password reset, Super Admin transfer
  and API-key authentication.
- Exact configured CORS origins with credentials; no wildcard origin.
- No-store response headers for authentication and one-time-secret routes.
- Constant-behavior credential checks where practical and uniform public login
  errors.
- Centralized authorization policies; controllers do not hand-roll scope logic.
- Parameterized Prisma operations only; no caller-controlled raw SQL.
- Structured log redaction for authorization, cookie, password, token, API-key
  and database connection fields.
- No secrets in URLs, command arguments, committed Compose files or OpenAPI
  examples.

## Test-driven development strategy

Every behavior follows red-green-refactor. Production code is added only after a
focused behavioral test fails for the expected missing behavior.

### Test layers

- Migration tests create `iot_test` from a clean database and exercise required
  constraints.
- Unit tests cover password/token primitives, policy decisions, expiry and state
  transitions.
- Repository integration tests use real PostgreSQL rather than mocked Prisma.
- Real-HTTP NestJS/Fastify tests cover every public endpoint and envelope.
- OpenAPI contract tests prevent DTO, status-code and cookie drift.

### Required adversarial cases

- Farmer attempts access across farm boundaries.
- Admin attempts to mutate an Admin or self-promote.
- Concurrent Super Admin transfer attempts preserve one holder.
- Concurrent refresh attempts allow only one rotation.
- A replaced refresh token revokes its family when reused.
- A role/status change invalidates an otherwise unexpired access JWT.
- API keys fail closed when wrong-scope, expired, revoked or owner-disabled.
- Oversized/extra/malformed bodies and identifiers are rejected safely.
- Database failures reveal no query, schema, hash, token or connection secret.
- Logs and OpenAPI contain no real credential material.

### Completion gate

- Clean migration and DBeaver connectivity are demonstrated.
- All pre-existing integration-core tests remain green.
- Phase A focused and full tests pass.
- Format, lint, typecheck, build and coverage pass.
- Dependency audit, ignored-build-script review, secret scan and staged-diff
  review pass.
- No public station-data route exists before its module spec is approved.

## Retention and deletion

- Active refresh sessions expire after seven days.
- Expired/revoked session evidence is purged after 30 days.
- Disabled accounts remain non-authenticating.
- An account requested for deletion is anonymized after 90 days while its stable
  identifier remains for audit linkage.
- Security audit events remain for at least 365 days.
- Expired/revoked API-key hashes and metadata are purged after 90 days.
- Super Admin cannot be deleted or anonymized until authority transfer succeeds.

Physical purge scheduling can initially be an explicit maintenance command;
production scheduling and backup interaction belong to `operations`.

## Intended project structure

```text
prisma/
  schema.prisma
  migrations/
src/
  database/
  identity/
  auth/
  authorization/
  api-keys/
  security-audit/
test/
  integration/identity/
  integration/auth/
  integration/api-keys/
docs/
  superpowers/specs/
```

Exact task-level files and commit boundaries belong to the implementation plan.

## Boundaries

### Always

- Resolve current authority from durable state on protected requests.
- Hash every stored credential and redact secret-bearing fields.
- Use transactions for security mutations with related revocation/audit effects.
- Deny access when identity, session, role or scope state is ambiguous.
- Keep public DTOs independent of Prisma models.
- Observe a failing behavioral test before production behavior.

### Ask first

- Change token placement, lifetime, cookie policy or password policy.
- Add a fourth business role or a second simultaneous Super Admin.
- Let an Admin mutate another Admin.
- Broaden Client Developer permissions beyond approved read-only station access.
- Add public registration, email delivery, SSO or MFA.
- Change database schema outside the approved implementation-plan increment.

### Never

- Store plaintext passwords, refresh tokens or API keys.
- Trust role or resource scope supplied by the frontend.
- Return credential/account-existence details in public errors.
- Put secrets in Git, Docker Compose literals, migrations, URLs or logs.
- Allow a user to grant itself a role, farm membership or station scope.
- Make station observations public during Phase A.

## Open questions

None block planning. Dependency versions, exact Prisma migration names and
task-level file boundaries will be selected and pinned in the reviewed
implementation plan without changing these public/security decisions.
