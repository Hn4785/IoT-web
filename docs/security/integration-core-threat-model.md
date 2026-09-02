# Integration Core and Identity Access Threat Model

Status: Phase A implementation review

Reviewed: 2026-09-02

## Scope

This document covers runtime configuration, health/error contracts, the private
Weather client and Phase A identity-access: PostgreSQL accounts, browser sessions,
administrator authority, farm/station grants, Client Developer API keys, audit
evidence and retention. Station observations, alerts and IoT configuration remain
outside this boundary.

## Assets

- Password hashes, refresh-token hashes, API-key hashes and signing/hash secrets.
- Account identity, role, status and singleton Super Admin authority.
- Farm memberships, Client station grants and API-key station scopes.
- Security audit evidence and stable user IDs retained after anonymization.
- Weather API credential and validated upstream measurements.
- Availability of the API, PostgreSQL and request correlation IDs.

Plaintext temporary passwords and API keys exist only in memory for the one HTTP
response that creates or rotates them. Plaintext refresh tokens exist only in the
browser cookie and request-handling memory.

## Trust boundaries

1. Environment to process: configuration is untrusted until the Zod runtime schema
   validates distinct secrets, database targets and exact frontend origin.
2. Browser to API: bodies, JWTs, Origin, cookies, identifiers and request IDs are
   untrusted. UI visibility never grants permission.
3. Client integration to API: `X-API-Key` and station identifiers are untrusted;
   authentication must verify owner, account grant and key scope on every use.
4. API to PostgreSQL: Prisma owns parameterized queries and transactions. Database
   failures must cross back only as normalized safe errors.
5. API to Weather provider: fixed configured origin and credential leave the
   process; every upstream status/body remains untrusted.
6. Backend to operators: logs, DBeaver, OpenAPI and maintenance output must not
   disclose plaintext credentials or connection secrets.

## STRIDE review

| Threat                 | Abuse case                                                | Implemented control                                                                                                 |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Spoofing               | Forged JWT or stale role claims impersonate an Admin      | HS256 issuer/audience/expiry verification followed by live session, user and authority lookup                       |
| Spoofing               | Guessed or stolen API key accesses another station        | Keyed hash verification, timing-safe comparison, active owner check, key scope plus current account grant           |
| Tampering              | Two refreshes or authority transfers both win             | Conditional session rotation and serializable authority transaction                                                 |
| Tampering              | Client grants itself broader scope                        | Only authenticated Admin routes mutate account grants; Client key scope must be a subset                            |
| Repudiation            | Security mutation cannot be attributed                    | Append-only audit rows include actor, target, request ID, result, timestamp and sanitized metadata                  |
| Information disclosure | Login reveals account existence                           | Unknown, wrong-password, disabled and locked accounts share `INVALID_CREDENTIALS` and bounded password verification |
| Information disclosure | Hash/secret reaches HTTP, OpenAPI or Git                  | Safe DTO selects, normalized filter, no-store one-time responses, secret scans and ignored `.env`                   |
| Denial of service      | Credential endpoints are flooded                          | Global and dedicated login/refresh/transfer rate limits, bounded schemas and Argon2 input limits                    |
| Elevation of privilege | Normal Admin changes an Admin or current holder           | Live authority matrix and invariant preventing holder disable/demotion before transfer                              |
| Elevation of privilege | Farmer crosses farm or browser Client reads business data | Central `ScopeService`; Farmer membership join; browser Client Developer is denied                                  |

## Credential and session controls

- Passwords use Argon2id and a 12–128 character boundary.
- Five failed attempts lock login for 15 minutes, including concurrent attempts.
- Access JWT lifetime is 15 minutes and contains no trusted role/scope claim.
- Seven-day refresh credentials are random 32-byte values stored only as keyed
  hashes. Rotation is single-use; replaced-token reuse revokes the full family.
- Refresh/logout require the exact frontend Origin. Cookie attributes are
  `HttpOnly`, `SameSite=Strict`, auth-path scoped and `Secure` in production.
- Role, status, password, authority and reset changes revoke affected sessions.
- API keys are random, expire after 90 days by default and are shown only once.
  Owner role/status, expiry, revocation, station scope and current grant are all
  checked during authentication.

## Data lifecycle

- PostgreSQL data persists outside the repository under `E:/IoT-data/postgres`.
- Explicit retention purges expired/revoked sessions after 30 days and API-key
  evidence after 90 days in bounded batches.
- Deletion requests older than 90 days replace personal fields with deterministic
  non-personal values while retaining the stable audit-linked user ID.
- The current Super Admin is excluded from anonymization until authority transfer.
- Retention never runs at startup and requires `--confirm-retention`.
- Security audit evidence is retained for at least 365 days; the current command
  does not purge it.

## Residual risks and follow-up

- Rate limiting is process-local. Multi-instance deployment needs a shared store
  or infrastructure limiter during operations work.
- API-key rate metadata is enforced by the future station-data route; Phase A only
  authenticates and attaches the bounded principal because no data route exists.
- PostgreSQL backup encryption, restore drills, production secret rotation and
  audit monitoring belong to operations.
- No MFA or SSO is included. Compromise of the Super Admin password remains a high
  impact risk; add MFA before an internet-facing production launch.
- Audit tables are append-only by application convention, not a database role that
  denies update/delete. Production database privileges should harden this boundary.
- Dependency audit covers known advisories, not maintainer compromise or every
  supply-chain attack.

## Verification evidence

The Phase A completion gate runs clean migration checks, format, lint, typecheck,
build, full tests, coverage, dependency audit, allowed-build review, secret scan
and adversarial authorization cases. Final counts and review findings are recorded
in the Phase A checkpoint evidence after the gate completes.
