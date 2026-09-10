# Backend expansion plan

Canonical roadmap: [`docs/roadmaps/2026-09-02-backend-completion-roadmap.md`](../docs/roadmaps/2026-09-02-backend-completion-roadmap.md)

Approved spec: [`docs/superpowers/specs/2026-09-02-station-data-design.md`](../docs/superpowers/specs/2026-09-02-station-data-design.md)

Implementation plan: [`docs/superpowers/plans/2026-09-02-station-data.md`](../docs/superpowers/plans/2026-09-02-station-data.md)

Completed backend modules: `integration-core`, `identity-access`, `station-data`

Current module: frontend B-core integration; backend next module is `alert-config`

Current delivery point: SD-4 history and SD-5 Client Developer routes are
backend-verified. Latest/history DTOs are sample-verified; UI mock replacement
remains the open part of Checkpoint B-core.
Development uses the approved API Guide sample JSON while the upstream service is
unavailable. B-core may become `sample-verified`; Phase B remains incomplete until
Checkpoint B-device proves at least one live station and the unresolved hardware
metadata.

Dependencies remain sequential:

```text
integration-core -> identity-access -> station-data -> alert-config -> operations
```
