# Capability Map: IoT Soil Monitoring Backend

## Objective

Build the Role 3 backend as a secure boundary between the Role 2 web application,
the existing Weather API, and the PostgreSQL identity/business/reading database.

| Module id          | Responsibility                                                                                                  | Depends on                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `integration-core` | Runtime configuration, public health check, Weather API client, validation, timeouts, and normalized errors     | -                                     |
| `identity-access`  | PostgreSQL identity state, sessions, three-role/Super Admin policy, resource authorization, and client API keys | `integration-core`                    |
| `station-data`     | Authorized stations, durable readings/snapshots/history, bounded background collection, metadata, and DTOs      | `integration-core`, `identity-access` |
| `alert-config`     | Alert rules, alert lifecycle, escalation, notifications, and the no-device-write boundary                       | `station-data`                        |
| `operations`       | Audit log, monitoring, deployment, backup, and operational documentation                                        | All preceding modules                 |

Build order:

1. `integration-core`
2. `identity-access`
3. `station-data`
4. `alert-config`
5. `operations`

## Dependency rules

- Dependencies point only from later modules to earlier modules.
- The finite private operations-signals provider is shared infrastructure: station
  collection may consume it. Its module depends only on identity/authentication,
  not station-data or alert-config, avoiding a module cycle. Do not expose the
  process-local metric registry as a public API.
- Weather API credentials are owned by `integration-core` and are never exposed to consumers.
- Public station-data endpoints cannot be added before `identity-access` supplies authentication and station authorization.
- Database models must not leak directly into the public API; each module owns explicit input and output contracts.
- Web configuration is limited to alert rules. Calibration and other physical
  intervention happen directly at the device; the backend must not publish
  commands or configuration to CENTER/NODE.
- Every module receives its own approved specification and implementation plan before production code is written.
