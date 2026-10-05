# F-product local progress — 2026-10-05

Owner scope: F7-F10 and local F-product, no GitHub push or Pi change until the
owner's F publishing gate. No fixture/sample database is delivery data.
Canonical issue status: [backend issue ledger](../reviews/2026-09-04-backend-follow-up.md).
External tracking: only Google Sheet `Test`, tab `Trung`, STT 40-47; no new Pi issues.

## F10 backend — complete locally

- PostgreSQL regression reproduces canonical raw-history snapshot 00:04 being
  relabeled fresh upstream after a latest response at 00:03. The canonical value
  remains monotonic but now carries stored/stale if not confirmed by latest.
- Evaluator rejects stored samples even if the supplied age/quality flags appear
  fresh; they do not advance breach/recovery state or generate lifecycle transitions.
- Four deterministic positive-path races reproduce a rule revision/unit/metadata
  or READY-status change during latest fetch. Checked bindings are now revalidated
  inside the locked evaluation transaction before any counter/event write.
- Same-observation corrections and repeated/restarted evaluators cannot create a
  second observation; fresh breach/recovery emits one OPENED and one RESOLVED event.
- Existing C1 lease/overlap and durable notification delivery/scope regressions pass.

Verification (local test database host `localhost`, database `iot_test` only):

- RED: durable-latest provenance assertion and five fresh-binding behavior tests
  failed on original production code; the existing dedup/recovery case passed.
- GREEN: focused durable-latest, fresh-binding, checkpoint-c1 and notification-delivery:
  4 files / 24 tests passed.
- Full backend: `pnpm exec vitest run --pool=threads --maxWorkers=1`:
  89 files / 557 tests passed, exit 0.
- `pnpm verify`: format, typecheck, lint, Prisma generation and build passed, exit 0.
- Read-only independent review/probes found no actionable scoped regression.
- No schema/migration, authentication, authorization, public contract or dependency
  changes in this slice. No external provider, Pi, GitHub or server validation claimed.

## Remaining local acceptance

- F7 exact-station latest and independent endpoints: under implementation/review.
- F8 exact-query history and per-station failure isolation: under implementation.
- F9 account/session/environment/scope purging: not yet verified.
- F-product role/browser online/stored/empty/denied matrix: remains open.
- FE-2/FE-5/FE-6/QA-1 broad browser acceptance remains under F16, not silently
  closed by unit tests or earlier owner B/C acceptance.
