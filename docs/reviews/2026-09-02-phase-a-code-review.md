# Phase A Whole-Code Review

Date: 2026-09-02
Scope: all hand-written backend code, Prisma schema and migration, integration tests,
runtime configuration, Docker persistence, OpenAPI and operator documentation. Generated
Prisma files were build-verified but not reviewed as application-owned source.

## Result

Phase A is suitable as the identity-and-access foundation for Phase B. No reachable
critical or high-severity defect remains in the reviewed scope. The review covered API
contracts, authentication/session behavior, authorization and tenant scope, persistence,
secret handling, operational safety, maintainability and test evidence.

## Findings fixed during the review

| Severity | Finding                                                                                                            | Resolution and evidence                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Medium   | Login and password change could act on a stale account/password snapshot during a concurrent administrator update. | Conditional writes now bind the operation to the password hash and active account state. Authentication integration tests pass.                 |
| Medium   | Super Admin password verification happened before the serializable transfer transaction.                           | Holder and password are now re-read and verified inside the authority-transfer transaction. Concurrent-transfer tests pass.                     |
| Medium   | Audit metadata relied on every caller remembering not to include a credential.                                     | A central recursive sanitizer redacts credential-shaped fields and bounds depth/array size; `sanitizeAuditMetadata` has a dedicated test.       |
| Low      | A refresh racing with account/session revocation could be reported as token replay.                                | The losing refresh re-reads the session and reports replay only when rotation actually won. A deterministic race test protects the distinction. |
| Low      | A disabled principal passed directly to the station-scope service was not rejected locally.                        | `ScopeService` now fails closed before role/scope lookup; the scope integration test covers it.                                                 |
| Low      | The OpenAPI response marked the one-time temporary password as request-only.                                       | The schema now marks it `readOnly`, with a contract test.                                                                                       |

## Adversarial mutation map

| Mutation                                   | Test/evidence that detects it                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Trust role/status carried by JWT           | `login.spec.ts` — “reloads role and session state instead of trusting an unexpired JWT”            |
| Remove conditional refresh claim           | `sessions.spec.ts` — “allows only one concurrent rotation of the same token”                       |
| Permit the same refresh token twice        | `sessions.spec.ts` — “detects reuse of a replaced token and revokes its whole family”              |
| Treat account revocation as replay         | `session.service.spec.ts` — “does not report replay when account revocation wins the refresh race” |
| Let a normal Admin mutate an Admin         | `users.spec.ts` — administrator provisioning/update authority cases                                |
| Create two Super Admin holders             | `schema.spec.ts`, `bootstrap.spec.ts`, and concurrent `super-admin.spec.ts`                        |
| Let a Farmer cross farm hierarchy          | `scopes.spec.ts` — current hierarchy and cross-scope denial table                                  |
| Let an API key choose an ungranted station | `lifecycle.spec.ts` and `authentication.spec.ts` wrong-scope cases                                 |
| Accept a key owned by a disabled account   | `authentication.spec.ts` unified safe-denial case                                                  |
| Leak raw exceptions, hashes or tokens      | `errors.spec.ts`, `openapi.spec.ts`, API-key lifecycle test, and audit sanitizer test              |
| Point destructive test setup at `iot_dev`  | `database.spec.ts` — explicit `iot_dev` refusal                                                    |

## Verification evidence

- Node `24.19.0`, pnpm `11.19.0`.
- PostgreSQL container was removed and recreated while retaining
  `E:/IoT-data/postgres`; the `iot_dev` user count was unchanged (`0` before and after).
- `iot_dev` has one completed Prisma migration and all 11 expected Phase A tables.
- `iot_test` migration deploy is current; credential-column checks found only Argon2 or
  anonymized password markers and 64-character hashes for sessions/API keys.
- Final full suite: 27 test files, 114 tests passed.
- Coverage: 88.18% statements, 75.91% branches, 94.41% functions, 89.77% lines.
- Dependency audit: no known vulnerabilities. Ignored-build report: only the explicitly
  configured `@scarf/scarf`, with no automatically ignored builds.

## Accepted boundaries for later phases

These are deliberate roadmap items, not hidden Phase A defects:

- Per-API-key request-rate enforcement belongs on the Phase B station-data route; Phase A
  stores and authenticates the approved limit.
- The current global rate limiter is process-local; distributed enforcement is an
  operations/deployment decision.
- MFA, database-role enforcement for append-only audit storage, scheduled retention,
  backup/restore rehearsal, CI and production observability remain Phase D hardening.
- Phase A exposes identity, access and station authorization foundations only. Sensor
  latest/history data begins in Phase B, so the project remains aligned with the
  agricultural soil-monitoring product rather than becoming a generic account system.
