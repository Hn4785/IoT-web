# F-data local progress — not final acceptance

Scope: approved station-data section 16; local `iot_test` only. No Pi DB change,
Git push, receiving-team deployment or frontend F7 change.

Implemented and independently checked:

- Additive reading/snapshot/coverage/checkpoint schema; source-consistent identities.
- Real latest/raw readings, idempotent overlap, newer-fetch corrections and preserved snapshots.
- Durable latest/history fallback after new service instances during fixture provider outage.
- Raw batch ingestion (5,000 records), explicit empty windows and conservative field coverage.
- Local query-bound stored cursors, complete timestamp groups and full UTC-bucket aggregation.
- Non-UTC PostgreSQL-session regressions: explicit UTC binding/projection avoids adapter offset loss.
- CI job/image-smoke configuration parity, reproduced missing configuration before the fix.

Root verification on 2026-10-05: `pnpm verify` passed (format/typecheck/lint/build),
76/76 test files and 455/455 tests passed sequentially in 100.97s. Focused red/green
cases preceded each behavioral change. Secret/diff checks passed; new staged files
are scanned again before commit. Antigravity CI output was independently reviewed,
with strict-type and report-metric corrections; no automatic merge.

These tests use validated deterministic provider fixtures, not live provider recovery.
Fresh coverage, dependency audit, full packaging/backup/restore and large-scale capacity
evidence have not been claimed for this slice.

Still open: F4 background collection/lease/checkpoint recovery, remaining F5 bounded
catch-up traversal, F6 retention/capacity/health, current-role/grant/key denial regressions,
OpenAPI parity and final F-data acceptance. D-production remains team-owned/open.
Formal report, operating manual and deployment guide are separate deliverables.
