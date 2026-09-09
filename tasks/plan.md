# Backend expansion plan

Canonical roadmap: [`docs/roadmaps/2026-09-02-backend-completion-roadmap.md`](../docs/roadmaps/2026-09-02-backend-completion-roadmap.md)

Approved spec: [`docs/superpowers/specs/2026-09-02-station-data-design.md`](../docs/superpowers/specs/2026-09-02-station-data-design.md)

Implementation plan: [`docs/superpowers/plans/2026-09-02-station-data.md`](../docs/superpowers/plans/2026-09-02-station-data.md)

Completed modules: `integration-core`, `identity-access`

Current module: `station-data`

Current delivery point: SD-4 bounded soil history after Checkpoint B2. The
latest-soil DTO and frontend adapter are sample-verified; UI mock replacement
remains part of Checkpoint B-core.
Development uses the approved API Guide sample JSON while the upstream service is
unavailable. B-core may become `sample-verified`; Phase B remains incomplete until
Checkpoint B-device proves at least one live station and the unresolved hardware
metadata.

Dependencies remain sequential:

```text
integration-core -> identity-access -> station-data -> alert-config -> operations
```
