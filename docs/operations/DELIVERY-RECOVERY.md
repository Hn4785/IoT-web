# Delivery, recovery and frontend release gate

Updated: 2026-09-23

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
- the retained device-capability screen does not offer a hardware write: alert
  thresholds are managed in Alert Center, while calibration or intervention is
  performed directly at the device.

Latest/history is `live-verified` as of 2026-09-28 because the issued API reads
directly from operating observation stations, values are updating, and the
provider confirmed all CENTER/NODE data is real sensor data and the final
acceptance input. This status confirms data provenance; it does not close the
separate registry, browser-role or production checkpoints. Never record the
credential in evidence.

## 5. Production decisions still requiring an owner

- selected single-instance ingress, TLS, trusted proxy hops and limiter policy;
- private metrics transport (shared aggregation only for future multi-instance use);
- encrypted off-machine backup destination, key custodian and restore owner;
  RPO 24h, RTO 4h and 7 daily/4 weekly copies were accepted on 2026-10-05;
- Super Admin recovery and credential rotation; MFA/SSO was excluded from this
  delivery by the owner/team on 2026-10-05, not implemented or certified;
- staging URL/credentials and complete browser-role evidence.

These are release blockers, not missing application code to guess locally.

## 6. Raspberry Pi staging network

- Keep Ethernet/Windows ICS as the recovery path while changing Wi-Fi.
- Store the `VJU Student` PSK only in NetworkManager with mode `600`; never put
  it in Git, compose files, screenshots or issue reports.
- Activate Wi-Fi, then verify address, default route, DNS, container health and
  the public tunnel before removing the Ethernet fallback.
- A successful Wi-Fi association does not prove Internet access: campus captive
  portal or IP policy must be checked separately. Do not weaken firewall, TLS or
  application authentication to bypass campus filtering.
- If Wi-Fi fails, return to the ICS address, inspect `nmcli`/journal evidence and
  restore service before changing application configuration.
