# Data Source Access Design

Date: 2026-09-28

Status: Approved by product owner for implementation

Module: `station-data` extension
Depends on: `integration-core`, `identity-access`, `station-data`

## Purpose

Allow an Admin or Farmer to connect a real observation API using its base URL
and upstream `X-API-Key`, discover the real `CENTER`/`NODE` stations, and share
read access without exposing the upstream credential. Admins can monitor every
connected source. Client Developer credentials remain the existing platform
API keys and are outside this source-sharing workflow.

## Product language and UI boundary

The UI remains English and keeps the incumbent layout. The primary labels are
`API Sources`, `Add API Source`, `Paste connection details`, `Test Connection`,
`Visible Accounts`, `Manage Access`, `Revoke Access`, `Reveal Key`, and
`Copy Key`.

The browser may parse text copied from chat, JSON, or curl, but sends only the
extracted base URL and key to the backend. The complete pasted message is never
sent, persisted, or logged. Direct integrations with chat providers are out of
scope.

`N/A` is forbidden in these screens. Use `No data`, `No stations found`,
`Not supported`, or `Connection failed` according to the actual state.

## Ownership and authorization

- Only active `ADMIN` and `FARMER` browser principals may create a source.
- The creator is the immutable source owner.
- An Admin may list every source and read its station measurements for
  operational monitoring.
- A Farmer may list and read sources they own or that have an active explicit
  grant.
- Only the owner may add or remove source grants.
- An Admin may revoke a Farmer grant only when that Admin owns the source. An
  Admin cannot revoke ownership of a Farmer-created source.
- Only the owner may reveal or copy the stored upstream key, after confirming
  the current password. A non-owner Admin can never reveal it.
- `CLIENT_DEVELOPER` cannot create, receive, list, reveal, or manage upstream
  sources through browser routes. Existing client integration keys remain
  separate.
- `visibleAccountCount` counts the owner and explicit active grantees. Implicit
  Admin oversight is not counted.

## Secret handling and outbound safety

- Store upstream keys only as AES-256-GCM ciphertext with a per-record random
  nonce and authentication tag. The encryption key comes from validated runtime
  configuration and is never stored in PostgreSQL.
- Never include the upstream key, ciphertext, nonce, tag, pasted source text, or
  upstream response body in logs, audit metadata, errors, DTOs, URLs, or OpenAPI
  examples.
- List/detail DTOs expose only `keyPreview`, containing at most the last four
  characters.
- Reveal returns plaintext once to the owner after password confirmation and
  emits an audit event. The frontend keeps it only in component memory, clears
  it when the dialog closes, and automatically hides it after 30 seconds.
- Source origins must be HTTPS and must match an exact origin configured in
  `DATA_SOURCE_ALLOWED_ORIGINS`. Requests cannot select paths outside the fixed
  `/health`, `/stations`, `/data/latest`, and `/data/history` allowlist.
- Redirects are rejected. Existing timeout, response-size, schema validation,
  cache, and normalized upstream errors remain mandatory.

## Persistence

`DataSource` owns a source name, approved origin, encrypted credential,
owner, connection status, timestamps, and discovered stations. `DataSourceGrant`
joins one source to one active Farmer. `Station` belongs to one source and its
upstream code is unique within that source rather than globally.

Existing environment-configured stations are attached to one immutable system
source during migration. That system source has no revealable database secret
and continues using the validated runtime Weather credential until an owner
explicitly creates a managed source.

Deleting sources is deferred. The first release supports create, test, list,
detail, reveal, grant, and revoke only so station/alert history cannot be
orphaned accidentally.

## Browser contract

All routes use `/api/v1`, Bearer authentication, the existing success envelope,
and normalized errors.

```text
GET    /data-sources?limit=50&cursor=...
POST   /data-sources
GET    /data-sources/:sourceId
POST   /data-sources/:sourceId/test
POST   /data-sources/:sourceId/reveal
PUT    /data-sources/:sourceId/grants/:userId
DELETE /data-sources/:sourceId/grants/:userId
GET    /data-sources/:sourceId/grants?limit=50&cursor=...
```

Create input:

```ts
type CreateDataSourceInput = {
  name: string;
  baseUrl: string;
  xApiKey: string;
  plotId: string;
};
```

Creation validates the origin, calls the real upstream `/stations`, requires at
least one valid station code, and atomically stores the source plus discovered
stations. A failed connection stores nothing.

Safe list item:

```ts
type DataSourceDto = {
  id: string;
  name: string;
  owner: { id: string; displayName: string; role: 'ADMIN' | 'FARMER' };
  baseUrl: string;
  keyPreview: string | null;
  stationCount: number;
  visibleAccountCount: number;
  connectionStatus: 'CONNECTED' | 'FAILED';
  lastCheckedAt: string;
  canManageAccess: boolean;
  canRevealKey: boolean;
  createdAt: string;
  updatedAt: string;
};
```

Reveal input is `{ currentPassword: string }`; output is
`{ xApiKey: string; expiresInSeconds: 30 }`. Invalid credentials use the same
safe authentication error wording and are rate limited by the existing browser
authentication boundary.

## Monitoring integration

Stations discovered for a source enter the existing Farm -> Plot -> Station
registry under the selected plot. Existing hierarchy/latest/history DTOs remain
unchanged. Station-data resolves the source internally and calls the correct
credential without exposing source IDs or credentials to measurement DTOs.

Admin monitoring reuses the same latest/history presentation as Farmer. This is
shared frontend code, not a duplicated data implementation.

## Verification

- Creation succeeds only for an allowlisted HTTPS origin and a valid key whose
  `/stations` response passes the existing schema.
- Invalid text, origin, key, redirect, timeout, oversized body, malformed JSON,
  empty stations, duplicate source station code, and transaction failure store
  neither source nor credential.
- Owner, grantee, non-grantee, Admin oversight, and Client Developer negatives
  are exercised through real HTTP integration tests.
- Removing a grant closes Farmer hierarchy/latest/history access immediately.
- A non-owner, including Admin, cannot reveal the key.
- Reveal requires the current password, returns plaintext only in the response,
  and writes secret-free audit evidence.
- Existing platform Client API-key behavior remains unchanged.
- Frontend tests cover paste parsing without sending the original message,
  owner-only actions, `Visible Accounts`, truthful empty/error copy, responsive
  layout, and absence of `N/A` on changed Admin/Farmer surfaces.

## Delivery order

1. Backend source registry, encrypted secret boundary, and migration.
2. Backend create/test/list/reveal/grant/revoke routes and authorization tests.
3. Route existing station reads through the resolved source credential.
4. Admin `API Sources` and shared monitoring UI.
5. Farmer create/owned/shared source UI.
6. Client Developer cleanup without joining source sharing.
7. Minimal account Settings and the final Phase B browser matrix.
