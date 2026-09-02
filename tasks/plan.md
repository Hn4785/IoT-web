# Backend expansion plan

Canonical roadmap: [`docs/roadmaps/2026-09-02-backend-completion-roadmap.md`](../docs/roadmaps/2026-09-02-backend-completion-roadmap.md)

Approved spec: [`docs/superpowers/specs/2026-09-02-identity-access-design.md`](../docs/superpowers/specs/2026-09-02-identity-access-design.md)

Implementation plan: [`docs/superpowers/plans/2026-09-02-identity-access.md`](../docs/superpowers/plans/2026-09-02-identity-access.md)

Completed module: `integration-core`

Next proposed module: `identity-access`

The identity design is approved. The implementation plan is ready for an
execution-mode decision; production changes begin with its Task 1 only after that
handoff.

Dependencies remain sequential:

```text
integration-core -> identity-access -> station-data -> alert-config -> operations
```
