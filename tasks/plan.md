# Active implementation plan

Canonical plan: [`docs/superpowers/plans/2026-08-30-integration-core.md`](../docs/superpowers/plans/2026-08-30-integration-core.md)

Active module: `integration-core`

Execution order is sequential because each task consumes contracts established
by the preceding task. Do not start `identity-access` until the integration-core
completion gate passes.
