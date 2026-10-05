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
- Browser-independent bounded collector, renewable generation-fenced lease, fair
  station batches, isolated failures/backoff, safe shutdown and source-removal fences.
- Inclusive raw-page traversal, conservative full-page prefix coverage and bounded
  catch-up; no skipped saturated timestamp group.
- Bounded 90-day raw retention, independent snapshots and serialized storage caps;
  no early deletion or false coverage when capacity blocks new raw rows.
- Current source-grant/API-key/role/revocation negatives for stored HTTP reads.

Root verification on 2026-10-05: `pnpm verify` passed (format/typecheck/lint/build),
83/83 test files and 493/493 tests passed with coverage sequentially in 133.20s.
Coverage: 88.35% statements, 77.92% branches, 93.15% functions, 90.97% lines.
Two additional collector tests then passed in the focused 10/10 boundary suite
(11.80s); no claim of a full 495-test run at this point. Focused red/green cases
preceded behavioral fixes, including a reproduced write/retention deadlock.
Secret scan passed for 265 files; diff check passed. Antigravity raw traversal was
independently reviewed and verified after two correction rounds; no automatic merge.

These tests use validated deterministic provider fixtures, not live provider recovery.
Fresh production dependency audit failed with 14 advisories (7 high, 7 moderate).
Current full packaging/backup/restore and large-scale capacity evidence are not claimed.

Owner priority update: stop expanding/closing F after F1 for now and complete D.
Preserve the code above as verified local progress. F2-F6 and final F-data acceptance
remain unchecked; OpenAPI parity, measured deployment capacity and live recovery
still need their own evidence. D-production remains team-owned/open.
Formal report, operating manual and deployment guide are separate deliverables.
