# Active backend context

Updated: 2026-09-20

This file is the short entry point for the next work session. Do not copy status
from specs, completed plans or checkpoints into this file.

## Sources of truth

- Current task state: [`tasks/todo.md`](todo.md)
- Long-term dependency order and acceptance criteria:
  [`docs/roadmaps/2026-09-02-backend-completion-roadmap.md`](../docs/roadmaps/2026-09-02-backend-completion-roadmap.md)
- Open defects and accepted risks:
  [`docs/reviews/2026-09-04-backend-follow-up.md`](../docs/reviews/2026-09-04-backend-follow-up.md)
- Local commands and recovery procedures:
  [`docs/operations/LOCAL-RUNBOOK.md`](../docs/operations/LOCAL-RUNBOOK.md)
- Approved Phase C behavior:
  [`docs/superpowers/specs/2026-09-02-alert-config-design.md`](../docs/superpowers/specs/2026-09-02-alert-config-design.md)
- Approved Phase D scope:
  [`docs/superpowers/specs/2026-09-20-operations-design.md`](../docs/superpowers/specs/2026-09-20-operations-design.md)

Files under `docs/superpowers/plans/`, `docs/checkpoints/` and dated production
test reports are implementation history. Load them only when verifying an old
decision or its evidence.

## Current delivery point

- Phase A identity/access: complete.
- Phase B backend core: complete against controlled sample data.
- Phase B frontend integration and live-device verification: open.
- Phase C backend core: implemented and verified locally; current changes have
  not yet been committed as the Phase C baseline.
- Phase D operations: the local release candidate is implemented and verified;
  external production/staging decisions remain open.

Latest local D1 gate on 2026-09-20: 57/57 test files and 365/365 tests; coverage
is 88.48% statements, 77.60% branches, 93.24% functions and 90.29% lines.
Format, typecheck, lint, build, migration status and diff check also pass.

## Next checkpoint

1. Connect the frontend to the verified Phase A–C OpenAPI contract and execute
   the browser role matrix against controlled sample data.
2. Verify CENTER plus one NODE when the provider becomes reachable.
3. Run the external D-production gate only after staging and infrastructure
   owners supply the missing deployment decisions.

Initial Phase D assumptions: one backend instance, Node.js 24, PostgreSQL in
Docker with persistent local data on drive E, structured JSON logs, a separate
readiness contract, Prometheus-compatible metrics and no secrets in Git. Hosting,
TLS/proxy topology, RPO/RTO and off-machine backup storage remain deployment
decisions and must not be guessed in code.
