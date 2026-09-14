# Backend expansion plan

Canonical roadmap: [`docs/roadmaps/2026-09-02-backend-completion-roadmap.md`](../docs/roadmaps/2026-09-02-backend-completion-roadmap.md)

Approved spec: [`docs/superpowers/specs/2026-09-02-station-data-design.md`](../docs/superpowers/specs/2026-09-02-station-data-design.md)

Implementation plan: [`docs/superpowers/plans/2026-09-02-station-data.md`](../docs/superpowers/plans/2026-09-02-station-data.md)

Current Phase C plan: [`docs/superpowers/plans/2026-09-14-alert-config.md`](../docs/superpowers/plans/2026-09-14-alert-config.md)

Completed backend modules: `integration-core`, `identity-access`, `station-data`

Current module: `alert-config`; frontend B-integration remains a deferred integration task

Current delivery point: Phase B-core backend is accepted as sample-verified.
Latest/history DTOs and Client Developer routes are backend-verified; UI mock
replacement remains open as Checkpoint B-integration.
Development uses the approved API Guide sample JSON while the upstream service is
unavailable. B-core is `sample-verified`; full live verification remains deferred until
Checkpoint B-device proves at least one live station and the unresolved hardware
metadata.

Dependencies remain sequential:

```text
integration-core -> identity-access -> station-data -> alert-config -> operations
```
