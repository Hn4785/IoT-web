# Capability Map: IoT Soil Monitoring Backend

## Objective

Build the Role 3 backend as a secure boundary between the Role 2 web application,
the existing Weather API, and the future PostgreSQL business database.

| Module id          | Responsibility                                                                                              | Depends on                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `integration-core` | Runtime configuration, public health check, Weather API client, validation, timeouts, and normalized errors | -                                     |
| `identity-access`  | Login, token lifecycle, RBAC, and farm/plot/station authorization                                           | `integration-core`                    |
| `station-data`     | Authorized stations, latest data, history, metadata enrichment, and frontend DTOs                           | `integration-core`, `identity-access` |
| `alert-config`     | Alert rules, alert lifecycle, escalation, and IoT configuration                                             | `station-data`                        |
| `operations`       | Audit log, monitoring, deployment, backup, and operational documentation                                    | All preceding modules                 |

Build order:

1. `integration-core`
2. `identity-access`
3. `station-data`
4. `alert-config`
5. `operations`

## Dependency rules

- Dependencies point only from later modules to earlier modules.
- Weather API credentials are owned by `integration-core` and are never exposed to consumers.
- Public station-data endpoints cannot be added before `identity-access` supplies authentication and station authorization.
- Database models must not leak directly into the public API; each module owns explicit input and output contracts.
- Every module receives its own approved specification and implementation plan before production code is written.
