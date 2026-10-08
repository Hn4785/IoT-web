# F-product local progress — 2026-10-05

> Historical record: counts, pending steps and deployment holds describe this
> checkpoint/plan's dated scope. Current completion and release applicability
> are in [the task index](../../tasks/todo.md); do not rerun old seed or rollout steps.

Owner scope: F7-F10 and local F-product, no GitHub push or Pi change until the
owner's F publishing gate. No fixture/sample database is delivery data.
Canonical issue status: [backend issue ledger](../reviews/2026-09-04-backend-follow-up.md).

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

## F7/F9 frontend — complete locally (`d405a64`)

- Latest, history and alerts fail independently; transient failures retain only
  the same station's valid current-session result, with its original timestamp.
- Route/request generations fence late responses. Successful empty results,
  mismatched station responses and observed 401/403/404 remove retained readings.
- Account/session/role/environment changes remount the private workspace; source
  and grant revalidation refresh Farm/Plot/Station even when parent IDs are unchanged.
  Old pagination cannot repopulate revoked stations or a different parent.
- StrictMode setup/cleanup does not leave the hierarchy permanently loading.
- Refresh retains an authorized station's private fallback during hierarchy loading,
  but cannot display it after a confirmed empty/denied scope.

## F8 frontend — complete locally (`3959bb5`)

- History identity includes actual begin/end, station, fields, interval, aggregate,
  order, limit and cursor. Changing any query cannot display a different query's
  retained result. Per-station generations reject out-of-order responses.
- Analysis loads/retries each station independently; failure of B does not remove A.
  Refresh with B revoked and A temporarily unavailable retains only exact-query A
  as Last known/Stale, removes B and reports unknown rather than complete coverage.
- Report Apply revalidates hierarchy and data. A same-query transient error keeps
  the original successful result; changed metric, empty or denied responses clear it.
- Provenance distinguishes upstream/cache/stored/browser-retained data; coverage
  distinguishes complete/partial/unknown and truncation. Fetch timestamps remain
  original. Chart gaps do not become invented CSV rows or statistics samples.
- CSV includes exact query and per-station origin/coverage/fetch metadata; formula
  and quoting boundaries are tested. Real measurement zero remains valid.

Verification:

- Behavioral RED/GREEN regressions cover retained station/scope/hierarchy behavior
  and 13 exact-query history cases. Independent review found a station-list shrink
  issue; its new failing regression, minimal fix and browser repro now pass.
- Fresh full frontend `npm test`: 218/218 passed, zero failed/skipped; `npm run lint`
  and `npm run build` passed (including TypeScript), `git diff --check` passed.
- Final read-only review: no remaining scoped actionable F7/F8/F9 findings;
  focused retention/scope probes 37/37 passed.
- Backend production audit rerun: no known vulnerabilities; `pnpm verify` passed.
  Security commit `6f5a9e2` remains required for the eventual combined publication.

## Checkpoint F-product-local — complete within approved scope

The browser harness imports the actual router/layout/pages/hooks with StrictMode.
Its adapters use isolated in-memory fixtures, not provider/database/Pi requests,
database seeds or delivery data. The role controls are not real authentication E2E.

| Role / pages exercised                     | Online | Stored | Empty | Denied | Additional evidence                                                                                                |
| ------------------------------------------ | ------ | ------ | ----- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| Admin / Station Detail                     | Pass   | Pass   | Pass  | Pass   | Stored is stale; denied removes readings                                                                           |
| Super Admin / Station Detail               | Pass   | Pass   | Pass  | Pass   | A-to-B route with delayed metadata; latest denial is visible independently                                         |
| Farmer / Dashboard, Soil, Analysis, Report | Pass   | Pass   | Pass  | Pass   | Independent failures, same-query retention, original timestamps, scope shrink, changed query and per-station retry |
| Client Developer / API Explorer            | Pass   | Pass   | Pass  | Pass   | Stored DTO remains stale; empty fields and forbidden response replace prior data                                   |

All role data states above passed on local pages. This is not the complete role/page
E2E matrix, live-provider recovery, target deployment or performance certification.
Native CSV download could not be confirmed with the browser adapter; CSV content
unit verification is not claimed as successful end-to-end download.

## Status reconciliation and delivery boundary

- F0-local and F7–F10/F-product-local are verified in the task index.
- FE-1/FE-3/FE-4 are implementation-complete. FE-2/FE-5/FE-6/QA-1 and broad browser
  acceptance remain under F16, not silently closed by these scoped checks.
- F11 onwards and D-production/F1-target remain open; receiving-team server,
  infrastructure, backup destination/owners and target acceptance are not invented.
- Local commits only. No GitHub push, Pi update, fixture/sample/test DB delivery,
  schema change or provider coverage claim in this slice.
