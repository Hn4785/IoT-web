# Soil Source Admin Checkpoint Design

Date: 2026-09-28

Status: Approved by product owner; recorded for the next implementation session

Modules: `station-data`, `identity-access`, `alert-config`

## Purpose

Complete the Admin checkpoint around real soil API sources without adding
remote device control. The checkpoint admits only sources that provide soil
measurements, shares selected observation stations rather than an entire
credential, sends station alerts to authorized viewers, and makes account and
source removal recoverable and auditable.

This design extends the existing data-source and alert designs. It does not
change the confirmed product boundary: calibration and physical intervention
happen onsite, while the web application monitors data and configures alert
thresholds only.

## Product decisions

- One managed source still owns one API URL and one upstream `X-API-Key`.
- The upstream key remains owner-only. A shared account never receives or
  reveals it.
- `CENTER` may be observed during discovery but is not a soil station, is not
  counted in the soil inventory, cannot be shared and cannot receive a soil
  alert rule.
- Grants are scoped to selected soil stations. `All soil stations` is a UI
  convenience that expands to the current eligible station IDs.
- A rule belongs to one station and is configured once by the source owner.
  Authorized viewers receive its lifecycle notifications; they do not create a
  conflicting private copy of the rule.
- Source and account deletion are recoverable administrative removals. History
  and security audit evidence are retained.
- Client Developer platform API keys remain separate from managed upstream
  source sharing.

## Soil-only source admission

Creating or testing a source validates more than the `/stations` response. The
backend uses the submitted credential to request the fixed, allowlisted
`/stations` and `/data/latest` paths, with `type=soil` and a bounded station
selection. Both responses remain untrusted and must pass strict schemas,
timeouts, response-size limits, redirect rejection and the origin allowlist.

The connection is accepted only when at least one discovered station has a
valid `latest.soil` object containing at least one supported numeric soil
measurement. Codes with no soil payload, including `CENTER`, are excluded from
the imported station set. If no eligible soil station remains, creation fails
with a safe `NOT_SOIL_SOURCE` error and stores neither source nor credential.

Supported soil fields remain the existing contract:

```text
temperature, moisture, ec, ph, nitrogen, phosphorus, potassium, light
```

The Add API Source dialog contains only explicit fields: optional source name,
API URL, `X-API-Key`, Farm and Plot. `Paste connection details` and
`Fill Fields` are removed. The frontend proposes an editable source label from
safe connection results, for example `Quan Trac Gia Lai — 6 soil stations`.
This label is the owner's personal note; pasted chat text and upstream keys are
never used as display text or persisted as notes.

Farm and Plot are local organizational resources and are never fabricated from
station codes. Each field is a searchable select-or-create control:

- Farm lists authorized existing Farms and offers `Create new farm`.
- Plot lists only Plots inside the selected Farm and offers `Create new plot`.
- If exactly one authorized option exists, it is preselected; multiple options
  require an explicit selection.
- New names are trimmed, whitespace-normalized and compared
  case-insensitively inside their scope. The database continues to identify
  resources by server-generated IDs and prevents duplicate Farm names and
  duplicate Plot names within one Farm.

External soil validation runs before persistence. Creation of any new Farm,
new Plot, source, encrypted credential and imported soil stations then occurs
in one database transaction. A rejected or interrupted connection leaves no
orphan Farm, Plot or source record.

The Admin dashboard consumes these dynamic names without special demo values.
Its summary labels are `Farms`, `Plots`, `Soil Stations` and `Users`. Soil
station totals and Farm distribution exclude `CENTER` and every non-soil
station. Farm filtering continues to use stable Farm IDs. Empty states use
plain English such as `No farms connected yet`; the dashboard never displays
`N/A`. Unsupported operational-health panels stay hidden until a real backend
contract exists.

## Station-scoped sharing

`Manage Access` selects one active Farmer and either all eligible soil stations
or a non-empty subset. Persistence records the account-to-source relationship
and the exact station IDs. Authorization for hierarchy, station detail,
latest/history, alerts and notifications intersects the current station grant.

- The owner always sees every active soil station in the source.
- A grantee sees only explicitly shared stations and only the containing
  hierarchy needed to reach them.
- Revoking one station closes access to that station immediately without
  changing other station grants.
- Revoking the account removes all grants for that source.
- Admin oversight does not increase `visibleAccountCount` and never exposes the
  upstream key.
- A credential independently entered and owned by a Farmer is not revocable by
  another Admin.

`Visible Accounts` counts distinct owners and active grantees, not the number
of station-scope rows.

## Alert rules and notification recipients

Rules remain station-scoped, soil-only and owner-managed. The UI asks for:

```text
Station -> Measurement -> Above | Below | Outside range -> Threshold(s)
        -> Warning | Critical -> Enabled
```

The frontend never asks a user to type `unit` or `metadataRevision`. Backend
station metadata supplies both values and rejects creation when confirmed
metadata is unavailable or changes concurrently. The evaluator continues to
require two distinct breach samples and two recovery samples.

The station metadata response also supplies `canManageRules`. It is `true`
only for the source owner (and for Admin on the immutable system source), so
Admin oversight and shared Farmer views never render rule mutation controls
that the backend would reject.

The source owner and active accounts currently granted the rule's station are
notification recipients. Losing the station grant immediately removes the
account from future notification fanout; historical notifications already
delivered remain audit evidence. Shared accounts may view the applicable rules
and alerts but cannot edit the owner's rule.

Rules generate alerts, in-app notifications and reportable lifecycle data only.
They never publish a command or calibration payload to `CENTER` or `NODE`.

## Source removal

The API Sources table adds a chart icon to `View Data` and an owner-only
`Remove Source` action with a destructive icon and confirmation dialog.
Removal is a transactional soft removal rather than a cascading hard delete:

- mark the source inactive and hide it from active source lists;
- revoke active source/station grants;
- make the encrypted upstream credential unusable and non-revealable;
- disable its active rules and deterministically resolve open alerts with an
  auditable source-removal reason;
- retain station, alert, notification and security-audit history.

Retrying removal is idempotent. Non-owners, including an overseeing Admin,
cannot remove a Farmer-owned source.

## User Management

The table retains separate actions for Edit Role, Enable/Disable, credential
recovery, authority transfer where allowed, and Delete Account.

The Edit User dialog has one mutable field: `Role`. It displays read-only lists
of managed API sources and soil stations currently shared with the account.
Display name, email, account status, Farm memberships and legacy station grants
are not edited in this dialog. Managed source access is changed only through
`API Sources -> Manage Access`, preventing two competing authorization screens.

Only the current Super Admin may request account deletion. The operation must
reject self-deletion, deletion of the current Super Admin and any transition
that would violate the existing authority invariant. The confirmation dialog
shows the target display name and email.

Account deletion follows the existing retention model:

- disable login immediately and revoke sessions and platform API keys;
- revoke managed-source and station access;
- preserve security audit and historical alert attribution;
- anonymize personal data through the approved retention workflow rather than
  hard-deleting referenced rows.

## Contract direction

Exact DTOs are finalized in the implementation plan, but routes follow these
resource boundaries:

```text
PUT    /api/v1/data-sources/:sourceId/grants/:userId/stations
DELETE /api/v1/data-sources/:sourceId/grants/:userId/stations/:stationId
DELETE /api/v1/data-sources/:sourceId/grants/:userId
DELETE /api/v1/data-sources/:sourceId
GET    /api/v1/stations/:stationId/field-metadata
DELETE /api/v1/users/:userId
```

All mutations use the existing authentication, authorization, success/error
envelopes, audit events and strict validation conventions. Destructive and
grant mutations must be idempotent or carry an explicit optimistic revision.

## Delivery sequence

1. Add soil-only connection validation and import only eligible NODE stations.
2. Add station-scoped data-source grants and enforce them on every read path.
3. Route alert visibility and notification recipients through station grants.
4. Expose confirmed field metadata and enable the owner-only rule form.
5. Add recoverable source removal and UI actions/icons.
6. Simplify User Management and add protected account deletion.
7. Update Admin frontend, then run the complete Admin browser checkpoint before
   starting Farmer cleanup.

Settings remains last for Phase B, after this Admin checkpoint is stable.

## Verification gate

- A weather-only, water-only, malformed or zero-soil source stores nothing.
- A failed source connection creates no orphan Farm or Plot.
- Select-or-create reuses matching normalized names and rejects duplicates in
  concurrent requests.
- `CENTER` is not counted, shared or offered in soil-rule selectors.
- An accepted source with six soil NODEs displays `6`, not `7`.
- A grantee can read only selected station data, rules, alerts and future
  notifications; all cross-station attempts fail closed.
- Owners alone reveal credentials, manage grants, edit rules and remove sources.
- Grant and removal tests cover revocation races and transaction rollback.
- Account deletion rejects self/current-Super-Admin targets, revokes access and
  preserves audit history.
- User Management contains one role editor and read-only shared-access details;
  it does not duplicate Manage Access.
- Frontend tests cover icons, confirmation dialogs, English copy, keyboard
  access, select-or-create behavior, responsive layouts, the absence of the
  paste helper and the absence of `N/A`.
- Backend passes focused integration tests plus full test, format, typecheck,
  lint, build, migration-status and secret-scan gates.
- No new code or documentation contains an upstream credential.
