# Identity and Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build PostgreSQL-backed accounts, secure rotating sessions, the three-role/Super Admin policy, resource-scope authorization, and scoped Client Developer API keys.

**Architecture:** The existing NestJS/Fastify modular monolith gains one Prisma/PostgreSQL boundary and focused identity, auth, authorization, API-key and security-audit modules. Current authority is loaded from durable state on every protected request; public DTOs and policies remain independent of Prisma records.

**Tech Stack:** Node.js 24.19, TypeScript 6, pnpm 11, NestJS 12, Fastify 5, PostgreSQL 17, Prisma 7.10, Zod 4, Argon2 0.45, JOSE 6, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-09-02-identity-access-design.md`

## Global Constraints

- Runtime is `>=24.19.0 <25`; package manager is exactly `pnpm@11.19.0`.
- PostgreSQL runs in Docker; local durable files bind to `E:/IoT-data/postgres`.
- Development and test databases are `iot_dev` and `iot_test`; tests never clear development data.
- API prefix is `/api/v1`; existing success/error envelopes remain unchanged.
- Business roles are exactly `ADMIN`, `FARMER`, and `CLIENT_DEVELOPER`; exactly one active Admin holds `SUPER_ADMIN`.
- Access JWT lifetime is 15 minutes; refresh-session lifetime is seven days.
- Password minimum is 12 characters; five failed logins lock authentication for 15 minutes.
- Client API-key default expiry is 90 days and default limit is 60 requests/minute.
- Never store plaintext passwords, refresh tokens or API keys; never log database URLs or credential-bearing headers.
- No station observation endpoint is introduced by this plan.
- Every production behavior is preceded by a test observed failing for the expected reason.
- Every task ends with focused tests, the existing suite, typecheck/build where relevant, secret review and an atomic local commit. Do not push or merge.

## File map

```text
compose.yaml                              local PostgreSQL service and health check
docker/postgres/init-test-db.sql          creates isolated iot_test on first initialization
prisma.config.ts                          Prisma CLI schema/migration configuration
prisma/schema.prisma                      durable identity and authorization model
prisma/migrations/                        reviewed forward migrations
src/generated/prisma/                     generated client; regenerated from schema
src/config/runtime-config.ts              validated DB/auth/CORS secret configuration
src/database/database.module.ts           Prisma composition
src/database/prisma.service.ts            lifecycle-owned Prisma client
src/identity/                              users, administrator policy, Super Admin transfer
src/auth/                                  password, JWT, refresh sessions, login/logout
src/authorization/                         current principal, role and resource policies
src/api-keys/                              account grants and client-key lifecycle
src/security-audit/                        append-only Phase A evidence
src/app/app.module.ts                      root module composition
src/app/create-app.ts                      cookie/CORS/no-store HTTP setup
test/helpers/database.ts                   iot_test migration/reset boundary
test/helpers/identity-app.ts               real HTTP app with isolated database
test/integration/identity/                 provisioning and authority contracts
test/integration/auth/                     browser-session contracts
test/integration/api-keys/                 client credential contracts
```

---

### Task 1: Reproducible PostgreSQL and Prisma Boundary

**Files:**

- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `.gitignore`
- Modify: `.env.example`
- Modify: `src/config/runtime-config.ts`
- Modify: `src/config/runtime-config.spec.ts`
- Create: `compose.yaml`
- Create: `docker/postgres/init-test-db.sql`
- Create: `prisma.config.ts`
- Create: `prisma/schema.prisma`

**Interfaces:**

- Consumes: local `POSTGRES_*`, `DATABASE_URL`, `TEST_DATABASE_URL`, auth secrets and frontend origin.
- Produces: validated `RuntimeConfig.databaseUrl`, `testDatabaseUrl`, `frontendOrigin`, `jwtSecret`, `credentialPepper`; `pnpm db:*` commands.

- [ ] **Step 1: RED — specify identity runtime validation**

Add to `src/config/runtime-config.spec.ts` a complete valid identity environment and assertions:

```ts
const identityEnv = {
  DATABASE_URL: 'postgresql://iot_app:local@localhost:5432/iot_dev?schema=public',
  TEST_DATABASE_URL: 'postgresql://iot_app:local@localhost:5432/iot_test?schema=public',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  JWT_SECRET: 'j'.repeat(32),
  CREDENTIAL_PEPPER: 'p'.repeat(32),
};

expect(parseRuntimeConfig({ ...validEnv, ...identityEnv })).toMatchObject({
  databaseUrl: identityEnv.DATABASE_URL,
  testDatabaseUrl: identityEnv.TEST_DATABASE_URL,
  frontendOrigin: identityEnv.FRONTEND_ORIGIN,
});

it.each([
  ['same database', { TEST_DATABASE_URL: identityEnv.DATABASE_URL }],
  ['short JWT secret', { JWT_SECRET: 'short' }],
  ['shared secrets', { CREDENTIAL_PEPPER: 'j'.repeat(32) }],
  ['wildcard origin', { FRONTEND_ORIGIN: '*' }],
])('rejects unsafe identity config: %s', (_name, override) => {
  expect(() => parseRuntimeConfig({ ...validEnv, ...identityEnv, ...override })).toThrow();
});
```

- [ ] **Step 2: Verify RED and add the minimum validated fields**

Run: `pnpm test src/config/runtime-config.spec.ts`

Expected: FAIL because identity variables are absent from `RuntimeConfig`.

Extend the Zod schema with URL validation, 32-character minimum secrets, exact-origin validation and a refinement that database URLs and secret values differ. Map the fields into the frozen runtime object, then rerun the focused test and expect PASS.

- [ ] **Step 3: Add pinned dependencies and fail-closed build permissions**

Use these exact versions:

```powershell
pnpm add @fastify/cookie@11.1.2 @fastify/cors@11.3.0 @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 argon2@0.45.1 jose@6.2.10 pg@8.23.0
pnpm add -D prisma@7.10.0 @types/pg@8.23.1 dotenv@17.4.2 tsx@4.23.13
```

Add scripts:

```json
{
  "db:generate": "prisma generate",
  "db:migrate:dev": "prisma migrate dev",
  "db:migrate:deploy": "prisma migrate deploy",
  "db:status": "prisma migrate status",
  "db:bootstrap-super-admin": "tsx src/identity/bootstrap-super-admin.ts",
  "prebuild": "pnpm db:generate"
}
```

Allow install scripts only for `argon2`, `prisma`, and `@prisma/engines`; retain the explicit Scarf denial. Run `pnpm ignored-builds` and stop if any other package requests execution.

- [ ] **Step 4: Define local PostgreSQL without committing secrets**

Create this local service and initialization file:

```yaml
# compose.yaml
services:
  postgres:
    image: postgres:17.6-alpine3.22
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - '127.0.0.1:5432:5432'
    volumes:
      - ${POSTGRES_DATA_DIR}:/var/lib/postgresql/data
      - ./docker/postgres/init-test-db.sql:/docker-entrypoint-initdb.d/10-test-db.sql:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB']
      interval: 5s
      timeout: 3s
      retries: 20
```

```sql
-- docker/postgres/init-test-db.sql
CREATE DATABASE iot_test;
```

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

```ts
// prisma.config.ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

Add placeholder variable names to `.env.example`, ignore `src/generated/prisma/`, and do not ignore any migration file. `prebuild` regenerates the client in every clean build. Validate with:

```powershell
docker compose config --quiet
pnpm exec prisma validate
```

Expected: Compose and the empty Prisma generator/datasource schema validate without displaying secret values.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm test src/config/runtime-config.spec.ts
pnpm typecheck
pnpm audit
git diff --check
git add package.json pnpm-lock.yaml pnpm-workspace.yaml .gitignore .env.example compose.yaml docker prisma.config.ts prisma/schema.prisma src/config
git commit -m "chore: establish PostgreSQL identity boundary"
```

---

### Task 2: Identity Schema, Migration, and Database Lifecycle

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*/migration.sql`
- Create: `src/database/prisma.service.ts`
- Create: `src/database/database.module.ts`
- Create: `test/helpers/database.ts`
- Create: `test/integration/identity/schema.spec.ts`
- Modify: `src/app/app.module.ts`

**Interfaces:**

- Produces: `PrismaService`; `prepareTestDatabase(): Promise<void>`; the exact models/enums approved by the spec.

- [ ] **Step 1: RED — prove the clean schema invariants**

Create an integration test that calls `prepareTestDatabase()`, inserts one Admin and one `SystemAuthority(SUPER_ADMIN)`, then asserts a second authority row and duplicate normalized email fail. Add a concurrent transaction case proving only one authority holder remains.

```ts
await prepareTestDatabase();
const first = await prisma.user.create({ data: adminFixture('root@example.test') });
await prisma.systemAuthority.create({
  data: { authority: 'SUPER_ADMIN', holderUserId: first.id },
});
await expect(prisma.user.create({ data: adminFixture('ROOT@example.test') })).rejects.toThrow();
await expect(
  prisma.systemAuthority.create({
    data: { authority: 'SUPER_ADMIN', holderUserId: first.id },
  }),
).rejects.toThrow();
```

Run: `pnpm test test/integration/identity/schema.spec.ts`

Expected: FAIL because the helper and generated Prisma client do not exist.

- [ ] **Step 2: Create the exact relational schema**

Define enums `UserRole`, `UserStatus`, `SystemAuthorityKey`, and `AuditResult`, then define these model fields and constraints exactly:

```text
User: id UUID PK; normalized email unique; displayName; passwordHash; role; status;
      failedLoginCount; lockedUntil; password/deletion/anonymization timestamps.
SystemAuthority: authority PK; holderUserId unique FK(User, RESTRICT).
Session: id UUID PK; userId FK; tokenHash unique; familyId UUID; expiresAt; lastUsedAt;
         revokedAt; replacedBySessionId; revokeReason; bounded userAgent/ipAddress.
Farm: id UUID PK; name; timestamps.
Plot: id UUID PK; farmId FK(CASCADE); name; unique(farmId,name).
Station: id UUID PK; plotId FK(RESTRICT); upstreamCode unique; name; timestamps.
FarmMembership: userId/farmId composite PK with cascading FKs.
ClientStationGrant: userId/stationId composite PK with cascading FKs.
ApiKey: id UUID PK; ownerUserId FK; name; prefix; keyHash unique; expiresAt;
        requestsPerMinute default 60; lastUsedAt; revokedAt; createdAt.
ApiKeyStationScope: apiKeyId/stationId composite PK with cascading FKs.
SecurityAuditEvent: id UUID PK; actorUserId nullable; action; targetType; targetId;
                    result; requestId; sanitized Json metadata; createdAt indexed.
```

Use `@db.Timestamptz(3)`, bounded `VarChar` fields and explicit indexes for session family/user, account status/role, memberships, grants, key owner/expiry and audit target/time.

- [ ] **Step 3: Start Docker, migrate both databases, and implement lifecycle ownership**

Create `E:\IoT-data\postgres` only after resolving it to the requested E-drive path. Start Docker Desktop if required, then:

```powershell
docker compose up -d postgres
docker compose ps
pnpm db:generate
pnpm db:migrate:dev --name identity_foundation
$env:DATABASE_URL=$env:TEST_DATABASE_URL
pnpm db:migrate:deploy
```

`PrismaService` extends the generated client using `PrismaPg({ connectionString: config.databaseUrl })`, connects on module init and disconnects on destroy. `DatabaseModule` exports it and `AppModule` imports the module.

- [ ] **Step 4: GREEN — run schema tests against only `iot_test`**

`prepareTestDatabase()` must refuse any URL whose database pathname is not exactly `/iot_test`, run `prisma migrate reset --force --skip-seed` against that URL, and never print the URL. Run the focused test; expect all uniqueness and singleton tests PASS.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm test test/integration/identity/schema.spec.ts
pnpm test
pnpm typecheck
pnpm build
git add prisma src/database src/app/app.module.ts test/helpers/database.ts test/integration/identity/schema.spec.ts
git commit -m "feat: persist identity authorization state"
```

---

### Task 3: Credential Primitives and Initial Super Admin

**Files:**

- Create: `src/auth/password.service.ts`
- Create: `src/auth/password.service.spec.ts`
- Create: `src/auth/token-hash.service.ts`
- Create: `src/auth/token-hash.service.spec.ts`
- Create: `src/identity/bootstrap-super-admin.ts`
- Create: `test/integration/identity/bootstrap.spec.ts`

**Interfaces:**

- Produces: `PasswordService.hash/verify`; `TokenHashService.hash`; one-time `bootstrapSuperAdmin(input, password): Promise<UserId>`.

- [ ] **Step 1: RED — specify credential storage behavior**

Tests assert a 12-character password hashes to an Argon2id encoded string, verifies successfully, rejects 11 characters, and never includes the plaintext. Token tests assert deterministic keyed SHA-256 hashes differ when the pepper differs.

```ts
const encoded = await passwords.hash('twelve-chars');
expect(encoded).toMatch(/^\$argon2id\$/);
expect(encoded).not.toContain('twelve-chars');
await expect(passwords.verify(encoded, 'twelve-chars')).resolves.toBe(true);
await expect(passwords.hash('eleven-char')).rejects.toMatchObject({
  code: 'VALIDATION_ERROR',
});
expect(new TokenHashService('a'.repeat(32)).hash('token')).not.toBe(
  new TokenHashService('b'.repeat(32)).hash('token'),
);
```

Run focused specs and expect missing-module failures.

- [ ] **Step 2: GREEN — implement bounded primitives**

Implement:

```ts
export interface PasswordService {
  hash(password: string): Promise<string>;
  verify(encodedHash: string, password: string): Promise<boolean>;
}

export interface TokenHashService {
  hash(token: string): string;
}
```

Use Argon2id with explicit memory/time/parallelism parameters and `createHmac('sha256', credentialPepper)` for refresh/API keys. Reject password/token inputs outside explicit length bounds before expensive work.

- [ ] **Step 3: RED/GREEN — bootstrap exactly one Super Admin**

The integration test starts from an empty `iot_test`, bootstraps one Admin, verifies `status=ACTIVE` and the authority row, then asserts a second call fails with stable `CONFLICT` and stores neither supplied plaintext nor command arguments.

Implement an interactive CLI that accepts `--email`, prompts for password twice without echo, and passes the value only in memory. The service transaction requires zero users and zero authority rows before inserting both records.

- [ ] **Step 4: Verify bootstrap without displaying a secret**

Run the bootstrap integration test, inspect `SecurityAuditEvent` for `SUPER_ADMIN_BOOTSTRAPPED`, and query the safe user columns through Prisma. Do not invoke the interactive command in automated tests.

- [ ] **Step 5: Commit**

```powershell
pnpm test src/auth/password.service.spec.ts src/auth/token-hash.service.spec.ts test/integration/identity/bootstrap.spec.ts
pnpm typecheck
git add src/auth src/identity/bootstrap-super-admin.ts test/integration/identity/bootstrap.spec.ts
git commit -m "feat: bootstrap the initial Super Admin"
```

---

### Task 4: Administrator User Provisioning

**Files:**

- Create: `src/identity/identity.contracts.ts`
- Create: `src/identity/identity.repository.ts`
- Create: `src/identity/identity.service.ts`
- Create: `src/identity/identity.controller.ts`
- Create: `src/identity/identity.module.ts`
- Create: `src/security-audit/security-audit.service.ts`
- Create: `src/security-audit/security-audit.module.ts`
- Create: `test/integration/identity/users.spec.ts`
- Modify: `src/common/errors/app-error.ts`
- Modify: `src/app/app.module.ts`

**Interfaces:**

- Produces: safe `UserDto`; strict `POST/GET/PATCH /api/v1/admin/users`; password-reset contract; atomic role/status mutation.

- [ ] **Step 1: RED — specify provisioning authority and one-time secret**

Through real HTTP, assert Super Admin can create Admin/Farmer/Client Developer, a normal Admin can create only Farmer/Client Developer, email normalization is unique, unknown fields fail, and the response has `Cache-Control: no-store`, one `temporaryPassword`, and no hash.

```ts
const response = await app.inject({
  method: 'POST',
  url: '/api/v1/admin/users',
  headers: bearer(superAdminToken),
  payload: { email: 'farmer@example.test', displayName: 'Farmer A', role: 'FARMER' },
});
expect(response.statusCode).toBe(201);
expect(response.headers['cache-control']).toBe('no-store');
expect(response.json().data).toMatchObject({
  user: { role: 'FARMER', status: 'PENDING_PASSWORD_CHANGE' },
  temporaryPassword: expect.any(String),
});
expect(response.body).not.toContain('passwordHash');
```

- [ ] **Step 2: GREEN — implement strict contracts and safe DTO mapping**

Define Zod inputs with bounded `email`, `displayName` and role. Define:

```ts
export type UserDto = Readonly<{
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'FARMER' | 'CLIENT_DEVELOPER';
  status: 'ACTIVE' | 'DISABLED' | 'PENDING_PASSWORD_CHANGE';
  isSuperAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}>;
```

Generate a high-entropy 20-character temporary password, hash it, persist the pending-change flag, record sanitized audit evidence, return plaintext once, then drop the in-memory reference.

- [ ] **Step 3: RED/GREEN — enforce mutation matrix and revocation transaction**

Add tests proving normal Admin cannot mutate Admin/self, only Super Admin can change business roles, the authority holder cannot be disabled/demoted, and role/status changes revoke sessions/API keys plus remove incompatible grants in the same transaction.

Add password reset with the same authority matrix and no-store one-time response.

- [ ] **Step 4: Checkpoint A1 evidence**

Run migration from clean DB, all identity HTTP tests, secret scan and review the user DTO/OpenAPI. Confirm no login route exists yet and DBeaver shows only hashes in credential columns.

- [ ] **Step 5: Commit**

```powershell
pnpm test test/integration/identity
pnpm test
pnpm lint
pnpm typecheck
git add src/identity src/security-audit src/common/errors src/app/app.module.ts test/integration/identity
git commit -m "feat: provision users within administrator authority"
```

---

### Task 5: Login, Forced Password Change, and Current Identity

**Files:**

- Create: `src/auth/auth.contracts.ts`
- Create: `src/auth/jwt.service.ts`
- Create: `src/auth/auth.service.ts`
- Create: `src/auth/auth.controller.ts`
- Create: `src/auth/auth.module.ts`
- Create: `src/authorization/current-principal.ts`
- Create: `src/authorization/access-token.guard.ts`
- Create: `test/integration/auth/login.spec.ts`
- Modify: `src/app/app.module.ts`

**Interfaces:**

- Produces: `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password`; `CurrentPrincipal { userId, sessionId, role, isSuperAdmin }`.

- [ ] **Step 1: RED — specify login without account enumeration**

HTTP tests cover success, wrong password, unknown email, disabled account, five failures/15-minute lockout, and uniform `INVALID_CREDENTIALS` bodies. Success returns a 15-minute access token, safe user DTO and an HttpOnly refresh cookie; no token/hash appears in logs.

```ts
const login = await app.inject({
  method: 'POST',
  url: '/api/v1/auth/login',
  payload: { email: 'farmer@example.test', password: validPassword },
});
expect(login.statusCode).toBe(200);
expect(login.json().data).toMatchObject({ accessToken: expect.any(String), expiresIn: 900 });
expect(login.headers['set-cookie']).toContain('HttpOnly');

const invalidCredential = 'invalid-test-value';
for (const email of ['missing@example.test', 'farmer@example.test']) {
  const denied = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: invalidCredential },
  });
  expect(denied.json().error.code).toBe('INVALID_CREDENTIALS');
}
```

- [ ] **Step 2: GREEN — implement session creation and JWT signing**

Use JOSE `SignJWT`/`jwtVerify` with issuer `iot-api`, audience `iot-web`, `sub`, `sessionId`, 15-minute expiry and the validated signing secret. Generate a 32-byte opaque refresh token, store only its hash with seven-day expiry, and set the cookie under `/api/v1/auth`.

- [ ] **Step 3: RED/GREEN — resolve authority from database per request**

Tests prove a disabled user or revoked session cannot use an unexpired JWT and changing role changes the next request's principal. The guard verifies JWT cryptography, then loads current user/session/authority; it never authorizes from a JWT role claim.

- [ ] **Step 4: RED/GREEN — force first password change**

A pending-change user may call only `/auth/me`, `/auth/change-password`, refresh and logout. Password change verifies the temporary password, writes a new Argon2id hash, changes status from `PENDING_PASSWORD_CHANGE` to `ACTIVE`, revokes other sessions and records audit evidence.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm test test/integration/auth/login.spec.ts
pnpm test
pnpm typecheck
git add src/auth src/authorization src/app/app.module.ts test/integration/auth/login.spec.ts
git commit -m "feat: authenticate database-backed users"
```

---

### Task 6: Refresh Rotation, Logout, and Session Reuse Detection

**Files:**

- Create: `src/auth/session.repository.ts`
- Create: `src/auth/session.service.ts`
- Create: `test/integration/auth/sessions.spec.ts`
- Modify: `src/auth/auth.controller.ts`
- Modify: `src/auth/auth.service.ts`
- Modify: `src/app/create-app.ts`

**Interfaces:**

- Produces: `POST /auth/refresh`, `POST /auth/logout`; single-use conditional rotation and family revocation.

- [ ] **Step 1: RED — specify cookie, Origin and rotation behavior**

Tests assert missing/wrong Origin fails, valid refresh replaces both access/refresh tokens, old token becomes unusable, production cookies are Secure/HttpOnly/SameSite Strict, and auth responses use `Cache-Control: no-store`.

```ts
const [first, second] = await Promise.all([
  refresh(app, originalCookie, allowedOrigin),
  refresh(app, originalCookie, allowedOrigin),
]);
expect([first.statusCode, second.statusCode].sort()).toEqual([200, 401]);
expect(first.headers['cache-control']).toBe('no-store');
```

- [ ] **Step 2: GREEN — register cookie/CORS and rotate conditionally**

Register `@fastify/cookie` and exact-origin `@fastify/cors` in `createApp`. Rotation uses one transaction with a conditional update `revokedAt=null AND expiresAt>now`; insert the replacement with the same `familyId` and link `replacedBySessionId`.

- [ ] **Step 3: RED/GREEN — detect replay and concurrency**

Run two concurrent refresh requests with the same cookie: exactly one succeeds. Reusing a replaced token revokes every active session in that family, returns `SESSION_REUSED`, and creates no new access token.

- [ ] **Step 4: RED/GREEN — logout is idempotent and safe**

Logout revokes the current session, clears the refresh cookie with matching attributes and returns success even if already revoked. An unrelated session remains valid; logout-all remains an internal service operation used by role/password changes.

- [ ] **Step 5: Checkpoint A2 and commit**

```powershell
pnpm test test/integration/auth
pnpm test
pnpm lint
pnpm typecheck
git add src/auth src/app/create-app.ts test/integration/auth
git commit -m "feat: rotate and revoke browser sessions"
```

Review cookie headers, replay evidence, logs and staged secrets before proceeding.

---

### Task 7: Super Admin Transfer and Resource-Scope Policies

**Files:**

- Create: `src/authorization/authorization.policy.ts`
- Create: `src/authorization/authorization.policy.spec.ts`
- Create: `src/authorization/scope.repository.ts`
- Create: `src/authorization/scope.service.ts`
- Create: `src/authorization/authorization.module.ts`
- Create: `test/integration/identity/super-admin.spec.ts`
- Create: `test/integration/identity/scopes.spec.ts`
- Modify: `src/identity/identity.controller.ts`
- Modify: `src/identity/identity.service.ts`

**Interfaces:**

- Produces: atomic Super Admin transfer; Farmer farm membership and Client station-grant admin APIs; `canReadStation(principal, stationId): Promise<boolean>`.

- [ ] **Step 1: RED — specify atomic authority transfer**

Tests require current-password recheck, active Admin successor, session revocation for both actors, audit evidence and exactly one holder under concurrent transfer attempts. The holder cannot transfer to itself, Farmer or Client Developer.

```ts
const result = await transferSuperAdmin({
  actorId: currentHolder.id,
  successorUserId: successor.id,
  currentPassword,
  requestId: 'transfer-test',
});
expect(result.holderUserId).toBe(successor.id);
expect(await prisma.systemAuthority.count()).toBe(1);
expect(await activeSessionCount(currentHolder.id)).toBe(0);
```

- [ ] **Step 2: GREEN — transfer with serialized durable state**

Lock/read the singleton authority inside a serializable Prisma transaction, verify the actor still holds it, verify password and successor, update the holder, revoke affected sessions, append audit, then commit.

- [ ] **Step 3: RED/GREEN — administer grants with role invariants**

Real HTTP tests cover idempotent `PUT/DELETE` farm memberships for Farmer targets and station grants for Client Developer targets. Reject incompatible target roles and revoke/remove stale grants during role changes.

- [ ] **Step 4: RED/GREEN — centralize scope decisions**

Table-driven tests prove Admin reads managed resources, Farmer inherits farm to plot/station, moving a station changes access immediately, Client Developer browser principals cannot read business data, and nonexistent/cross-scope resources both return the same non-leaking denial.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm test src/authorization test/integration/identity/super-admin.spec.ts test/integration/identity/scopes.spec.ts
pnpm test
pnpm typecheck
git add src/authorization src/identity test/integration/identity
git commit -m "feat: enforce authority and resource scope"
```

---

### Task 8: Client Developer API-Key Lifecycle

**Files:**

- Create: `src/api-keys/api-key.contracts.ts`
- Create: `src/api-keys/api-key.service.ts`
- Create: `src/api-keys/api-key.controller.ts`
- Create: `src/api-keys/api-key.guard.ts`
- Create: `src/api-keys/api-key.module.ts`
- Create: `test/integration/api-keys/lifecycle.spec.ts`
- Create: `test/integration/api-keys/authentication.spec.ts`
- Modify: `src/app/app.module.ts`

**Interfaces:**

- Produces: list/create/rotate/revoke endpoints; internal `ApiKeyPrincipal`; exact station-scope authentication for Phase B.

- [ ] **Step 1: RED — specify one-time key creation**

Tests prove only Client Developer can create a key, the response shows plaintext once with no-store headers, storage contains only keyed hash/prefix, expiry defaults to 90 days, rate is 60/minute, and requested stations must be a subset of current `ClientStationGrant` rows.

```ts
const created = await app.inject({
  method: 'POST',
  url: '/api/v1/developer/api-keys',
  headers: bearer(clientDeveloperToken),
  payload: { name: 'dashboard', stationIds: [grantedStation.id] },
});
expect(created.statusCode).toBe(201);
expect(created.headers['cache-control']).toBe('no-store');
expect(created.json().data.key).toMatch(/^iot_live_[A-Za-z0-9_-]+$/);
expect(await prisma.apiKey.findFirstOrThrow()).not.toHaveProperty('key');
```

- [ ] **Step 2: GREEN — create bounded opaque credentials**

Generate 32 random bytes and encode `iot_live_<prefix>_<secret>`. Persist only prefix plus `TokenHashService.hash(fullKey)`. Return `ApiKeyDto` without hash and a separate `key` field only from creation/rotation responses.

- [ ] **Step 3: RED/GREEN — rotate, revoke and retain safe metadata**

Rotation creates the replacement and revokes the old key atomically. Revocation is idempotent. Owner/Admin permissions follow the spec; owner status/role changes and removed account grants immediately invalidate matching keys/scopes.

- [ ] **Step 4: RED/GREEN — authenticate with fixed cost and scope**

The guard parses only the accepted key format, finds by prefix, verifies keyed hash with timing-safe comparison, checks owner/status/role/expiry/revocation and returns an `ApiKeyPrincipal`. Wrong, expired, revoked and cross-station keys share a safe denial; rate limiting keys on the API-key ID, never the plaintext.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm test test/integration/api-keys
pnpm test
pnpm lint
pnpm typecheck
git add src/api-keys src/app/app.module.ts test/integration/api-keys
git commit -m "feat: manage scoped client API keys"
```

---

### Task 9: OpenAPI, Retention, and Security Evidence

**Files:**

- Create: `src/identity/retention.service.ts`
- Create: `src/identity/retention.command.ts`
- Create: `test/integration/identity/retention.spec.ts`
- Create: `test/integration/identity/openapi.spec.ts`
- Modify: identity/auth/API-key controllers with explicit Swagger DTOs
- Modify: `README.md`
- Modify: `docs/security/integration-core-threat-model.md`

**Interfaces:**

- Produces: reviewed Phase A OpenAPI; explicit maintenance command for 30/90/365-day policies; updated threat evidence.

- [ ] **Step 1: RED — specify retention boundaries with an injected clock**

Tests create records immediately before/after each cutoff and assert only expired/revoked sessions older than 30 days, anonymization requests older than 90 days and API-key evidence older than 90 days are purged/anonymized. Audit events younger than 365 days remain; Super Admin is never anonymized.

```ts
const result = await retention.run(new Date('2026-09-02T00:00:00.000Z'));
expect(result).toEqual({ sessionsPurged: 1, usersAnonymized: 1, apiKeysPurged: 1 });
expect(await prisma.user.findUniqueOrThrow({ where: { id: superAdmin.id } })).toMatchObject({
  anonymizedAt: null,
});
```

- [ ] **Step 2: GREEN — implement an explicit maintenance transaction**

`RetentionService.run(now)` returns counts by category, performs bounded batches, replaces personal fields with non-reversible anonymous values, preserves audit-linked user IDs, and records one sanitized maintenance audit event. The CLI requires an explicit confirmation flag and never runs at app startup.

- [ ] **Step 3: RED/GREEN — lock the public contract**

OpenAPI tests assert the exact Phase A path set, bearer/cookie/API-key security schemes, stable safe DTOs/error codes and absence of hashes, database URLs, JWT secret, pepper and example credentials. Production still returns normalized 404 for docs.

- [ ] **Step 4: Update operator evidence**

Document Docker startup, ignored local env creation, migrations, bootstrap, DBeaver host/port/database names, test database safety, retention command and credential rotation. Extend the threat model for browser/session, database, administrator and client-key trust boundaries.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm test test/integration/identity/retention.spec.ts test/integration/identity/openapi.spec.ts
pnpm format:check
pnpm test
git add src/identity test/integration/identity README.md docs/security
git commit -m "docs: publish identity operations contract"
```

---

### Task 10: Phase A Completion Gate

**Files:**

- Modify only for evidenced defects: files owned by Tasks 1-9.
- Modify after all gates pass: `docs/superpowers/specs/2026-09-02-identity-access-design.md`
- Modify: `tasks/todo.md`

**Interfaces:**

- Produces: verified `identity-access` foundation ready for `station-data`; no push/merge.

- [ ] **Step 1: Rebuild from clean durable boundaries**

Stop/remove only the project container, keep `E:/IoT-data/postgres`, restart it, run development migration status, reset/migrate only `iot_test`, generate Prisma client and build. Confirm `iot_dev` data survived the container recreation.

- [ ] **Step 2: Run full quality and security gates**

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:coverage
pnpm audit
pnpm ignored-builds
git diff --check
```

Expected: all exit 0; no unexpected build script or reachable high/critical advisory.

- [ ] **Step 3: Run adversarial mutation review**

Confirm a named test fails for each mutation: JWT role trusted without DB lookup; refresh conditional removed; same token refreshes twice; normal Admin mutates Admin; two Super Admin holders; Farmer crosses farm; API key chooses an ungranted station; disabled owner key works; raw Prisma error/hash/token reaches HTTP/log; test helper points to `iot_dev`.

- [ ] **Step 4: Manual local acceptance with DBeaver**

Verify `localhost:5432`, `iot_dev`, migration table and expected identity tables; confirm credential columns contain hashes only. Exercise bootstrap, provision Farmer/Client Developer, login/change password, refresh/logout, transfer Super Admin and API-key lifecycle through real HTTP without placing secrets in shell history.

- [ ] **Step 5: Mark verified and commit evidence**

Change spec status to `Implemented and verified`, check IA-1 through IA-7 and checkpoints A1/A2/A in `tasks/todo.md`, then:

```powershell
git add docs/superpowers/specs/2026-09-02-identity-access-design.md tasks/todo.md
git commit -m "docs: record identity-access verification"
git status --short --branch
```

Expected: clean `codex/integration-core`; branch remains local until the user separately requests integration or push.
