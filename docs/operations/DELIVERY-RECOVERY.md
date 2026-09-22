# Delivery, recovery and frontend release gate

Updated: 2026-09-20

This is the canonical Phase D operator checklist. It prepares a local release
candidate; it does not replace staging, live-device or production infrastructure
approval.

## 1. Immutable verification

Use Node `24.17.x` and pnpm `11.19.0`:

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm test:coverage
pnpm audit --prod --audit-level=high
pnpm security:secrets
pnpm db:status
git diff --check
```

`pnpm verify` runs format, typecheck, lint and production build. CI repeats these
checks against isolated PostgreSQL databases, then builds and smoke-tests the
non-root production image. CI and local scripts never run `down -v`, overwrite a
database or print credentials.

## 2. Container smoke test

Build the exact supported Node runtime:

```powershell
docker build --pull -t iot-api:local .
```

Provide runtime values through the deployment secret store or `--env-file`; do
not bake `.env` into the image. A successful smoke test must show:

- `/api/v1/health` returns `healthy` without probing dependencies;
- `/api/v1/readiness` returns `ready` only while PostgreSQL is reachable;
- the container user is `node`; and
- the production image does not expose `/docs` or `/docs-json`.

## 3. Backup and restore rehearsal

The local rehearsal creates a new database whose name starts with
`iot_restore_`. It refuses an existing or primary database and deliberately
leaves both the restored database and backup artifact for review.

```powershell
.\scripts\operations\backup-restore-rehearsal.ps1 `
  -RestoreDatabase iot_restore_<timestamp>
```

Acceptance evidence:

1. `pg_dump` succeeds and the ignored artifact exists under
   `artifacts/backup-rehearsal/`.
2. `pg_restore --exit-on-error` succeeds into the new database.
3. At least one completed Prisma migration exists in the restore.
4. The production image starts against that restore and `/api/v1/readiness`
   reports `ready`.

Do not call this a production backup until the owner approves RPO/RTO,
off-machine destination, encryption key, retention and restore responsibility.
Rollback is forward-fix first: do not reverse a deployed migration unless its
explicit down procedure and data-loss impact were reviewed.

## 4. Frontend contract handoff

Run the backend in `development` or `test`, then:

```powershell
$env:RELEASE_BASE_URL = 'http://127.0.0.1:3000'
pnpm release:check
```

The check requires healthy liveness, ready PostgreSQL and the OpenAPI paths used
by frontend Phase A–C. Production deliberately has no Swagger endpoint, so an
image-only smoke uses:

```powershell
pnpm release:check -- --skip-openapi
```

Before accepting frontend integration, test these flows in a browser:

- login, forced password change, refresh single-flight and logout;
- Super Admin user management, authority transfer and audit list;
- Farmer-scoped farm/plot/station latest and history views;
- Client Developer key create/copy/use/rotate/revoke with station scope;
- alert-rule validation, open/acknowledge/resolve and in-app notifications; and
- device configuration reports `DEVICE_CONTRACT_PENDING` instead of pretending
  a hardware write succeeded.

Latest/history data remains `sample-verified`. The release cannot become
`live-verified` until CENTER plus at least one NODE are tested against the real
provider.

## 5. Production decisions still requiring an owner

- ingress, TLS termination, trusted proxy hops and multi-instance rate limiter;
- private metrics transport and aggregation;
- RPO/RTO, encrypted off-machine backup and retention;
- MFA/SSO and Super Admin recovery policy;
- staging URL/credentials and live CENTER/NODE access.

These are release blockers, not missing application code to guess locally.
