# F-data — local checkpoint complete

> Historical record: counts, pending steps and deployment holds describe this
> checkpoint/plan's dated scope. Current completion and release applicability
> are in [the task index](../../tasks/todo.md); do not rerun old seed or rollout steps.

Date: 2026-10-05. The owner resumed work through F-data, superseding the earlier
F1 hold. F2-F6 and Checkpoint F-data are complete for the approved local contract
in station-data section 16. This is fixture acceptance, not a production claim.

No Pi database change, remote push, receiving-team deployment or frontend F7 work.
Formal reports, operating manuals and deployment guides remain separate.

## Verified behavior

- Validated latest/raw readings persist by source/station/field/observation time;
  duplicate identities do not duplicate rows. Raw history and independent latest
  snapshots remain separate. Newer observations cannot be rolled back by backfill.
- Owner-approved migration 13 adds internal `lastFetchedAt` to both reading tables.
  Identical newer responses preserve original capture time/origin/revision while
  advancing the generation fence. Delayed latest/history corrections are rejected.
  Existing fences are initialized from recorded `fetchedAt`; lost older capture
  times cannot be reconstructed. Public DTOs do not expose the new column.
- Application close/recreation during controlled provider outage reads durable
  latest/history with original times and explicit stored/stale metadata.
  Current account/key/grant/source authorization still applies; duplicate NODE
  codes across sources, recreated station identities, revoked access and removed
  sources cannot reuse another reading or cursor.
- Provider errors never relabel cached upstream aggregates as captured local raw.
  Upstream/stored cursor chains cannot switch origin silently. Complete timestamp
  groups, query-bound pagination, honest empty/partial coverage and UTC-bucket
  mean/min/max/first/last are covered by regressions.
- Browser-independent collector: bounded concurrency/fair batches, persistent
  retries/backoff, renewable generation-fenced leases, safe shutdown and source
  removal. Full 5,000-row pages prove only their committed prefix and resume
  inclusively after a new collector instance. Saturated timestamp groups stop
  without skipping samples or claiming coverage.
- Database failures do not mark a source Connected, including canonical reads,
  coverage, collector history writes and final checkpoint writes. Failed checkpoint
  saves and heartbeats emit finite private database-error signals.
- 90-day retention clips expired reads/coverage, preserves snapshots, and leaves
  actual credential/audit/alert/lifecycle/notification rows unchanged.
  Concurrent cap-boundary writers cannot overshoot or advance rejected coverage.
  Injected partial write/purge failures roll back in real PostgreSQL transactions
  and succeed on retry; this is not a physical full-disk test.

## Fresh root verification

- `pnpm test:coverage`: exit 0; all 88 active test files passed, including existing
  identity, alerts, notification, backup/restore and delivery regressions.
- Coverage: statements 88.82% (2910/3276), branches 79.27% (1618/2041),
  functions 94.01% (675/718), lines 91.45% (2751/3008).
- `pnpm verify`: format, typecheck, lint and build passed.
- `pnpm audit --prod`: no known vulnerabilities.
- `pnpm security:secrets`: passed for 274 tracked/non-ignored source files.
- `pnpm db:status` against guarded local `iot_test`: 13 migrations, up to date.
- `release:check` passed against a temporary loopback app using the compiled
  backend and test configuration: health/readiness/OpenAPI contract. App closed.
- `git diff --check`: passed.

Behavioral RED failures preceded generation/cache/identity/status/checkpoint fixes.
Final review also found the collector's premature Connected update; both injected
write-failure regressions failed before the fix and the 15-test collector boundary
suite then passed. A retention boundary fixture was made independent of the current
minute so an incomplete-hour assertion stays deterministic.

The OpenAPI change was reviewed and verified. Browser/client latest/history
schemas now agree, and
existing route/auth/query/cursor metadata remains intact. Independent read-only
reviews checked storage fencing/migration, runtime failure paths and measurement
target safety; their findings were reproduced/addressed, not accepted on trust.

## Measured local fixture envelope

Opt-in helper: `test/helpers/measure-soil-storage.ts`.
Set `RUN_F_DATA_MEASUREMENT=1`, then run
`pnpm exec tsx test/helpers/measure-soil-storage.ts` only when no DB tests run.
It resets disposable local `iot_test`; never use it with valuable data.
Protocol/host/database/port/query-override guards and matching Docker-port checks
run before any client/mutation. Each profile resets raw table allocation.

Profile: 2 stations, 8 fields, one observation per 120 seconds. Post-migration
measurements are synthetic fixture rows, not provider collection/load acceptance.

| Days |  Raw rows | Table bytes | Index bytes | WAL delta bytes | Fixture dump bytes |
| ---- | --------: | ----------: | ----------: | --------------: | -----------------: |
| 1    |    11,520 |   1,433,600 |   1,572,864 |       4,425,192 |            116,724 |
| 7    |    80,640 |   9,887,744 |  11,067,392 |      31,153,472 |            336,280 |
| 90   | 1,036,800 | 126,820,352 | 142,843,904 |     401,076,968 |          3,373,637 |

At 90 days, raw table plus indexes occupied 269,664,256 bytes (~257 MiB).
Warm three-sample median/max: raw query 74.3/76.2 ms, cursor continuation
81.1/84.0 ms, hourly aggregate 131.0/135.6 ms, eight-field latest ingestion
81.2/83.0 ms. Ingestion repetitions include idempotent writes. Empty retention
scan 4.0/4.7 ms is not purge throughput. Bulk insertion took 34.7 seconds once.
Station-count EXPLAIN used a parallel sequential scan (~42 ms); no unapproved
index change was made.

These are not p95, concurrent load or Pi benchmarks. WAL can include background
activity. Custom dumps include the whole fixture DB, and repeated synthetic
values compress strongly; do not infer real backup size from them.
After verification the Docker PG snapshot was 167.2 MiB / 7.652 GiB; the data
filesystem E had 239,004,008,448 bytes free. Windows free RAM snapshot was
3,825,800 KiB / 16,564,728 KiB. These are headroom snapshots, not peak memory tests.
No physical disk-exhaustion or hardware power-loss injection was performed.

The 2-million-per-station / 10-million-global limits remain protective ceilings.
20 stations x 8 fields x 120 seconds x 90 days require 10,368,000 rows, exceeding
the default global ceiling; that profile is not certified for complete retention.

## Remaining boundaries

F7-F10/F-product, portable packaging/ARM64, actual Pi/server capacity, live-provider
recovery and receiving-team staging/production acceptance remain open. Formal
manuals/reports are not silently included. Prior D-local evidence remains in
[D checkpoint](2026-10-05-d-local.md); it is not rebranded as D-production.
