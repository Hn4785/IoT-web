# Project: IoT Soil Monitoring Backend

## Role and scope

This repository is owned by Role 3: backend, database, authentication,
authorization, integrations, alerts, configuration, and deployment.
Frontend source belongs in `D:/IoT-web` and must not be copied into this project.

## Planned stack

- Node.js and TypeScript
- NestJS with the Fastify adapter
- PostgreSQL with Prisma, introduced by the module that first needs persistence
- OpenAPI for the Role 2/Role 3 contract
- Schema validation at every HTTP, environment, and third-party API boundary

## Required workflow

- Read `CAPABILITY-MAP.md`, the current status in `tasks/todo.md`, and only the relevant section of the active module specification before editing. Do not load completed implementation plans or unrelated module documents by default.
- Use test-driven development: add one failing behavioral test, verify the expected failure, add minimal production code, then refactor while green.
- After completing a feature or module slice, re-check every connected path it can affect: controllers and public contracts, services and authorization policies, database transactions and cleanup, sessions/API keys, frontend integration assumptions, OpenAPI, and related integration tests.
- Reproduce each suspected bug before changing production code. Fix bugs that are in the approved task scope; record verified-but-deferred issues in the current dated file under `docs/reviews/` with severity, evidence, impact, affected paths, proposed fix, and required regression test.
- When a suspected issue cannot be reproduced, record the attempted scenario and observed result instead of changing behavior speculatively.
- Treat a passing focused test as incomplete evidence: also run the connected module tests and the project quality gates. If shared integration infrastructure causes test races, report that separately and verify with an isolation-safe command rather than hiding the failure.
- Keep commits atomic and scoped to one verified behavior.
- Run build, test, lint, and type checking before declaring a change complete.
- Update the specification before changing an approved public contract.

## Context and document budget

- Keep task context focused: rules, current status/checkpoint, affected source and tests, one matching project pattern, and the relevant spec section. Aim to stay below 2,000 lines unless broader review is explicitly required.
- Treat `docs/superpowers/plans/` as execution history. Read a completed plan only to verify an earlier decision or unfinished task; do not reload it for routine implementation.
- Prefer updating `tasks/todo.md`, the current checkpoint, or the current dated review over creating another status document with duplicate content.
- Periodically compact active status and review documents: remove repetition, replace copied detail with links to the authoritative spec/test/file, and retain decisions, evidence, open risks, and next actions.
- Never shorten approved specs, security records, migrations, or audit evidence merely to save tokens. Archive superseded human-facing summaries instead of deleting technical history.
- When switching modules, discard stale file context and load the new module selectively from the hierarchy above.

## Security boundaries

- Never commit `.env`, credentials, API keys, access tokens, private keys, or database passwords.
- Never return Weather API keys or internal errors to the frontend.
- Never treat client-side menu hiding as authorization.
- Validate Weather API responses as untrusted input.
- Restrict outbound Weather API calls to the configured service origin; request parameters must not control the upstream host.
- Public station endpoints require server-side station authorization.
- Ask before changing authentication flows, CORS, rate limits, database schema, or external integrations.

## API conventions

- API prefix: `/api/v1`.
- Resource names are plural nouns and fields/query parameters use `camelCase`.
- Success response: `{ "success": true, "data": ... }`.
- Error response: `{ "success": false, "error": { "code": "...", "message": "..." }, "requestId": "..." }`.
- Store timestamps as UTC and return ISO 8601 strings unless a contract explicitly requires Unix milliseconds.
- Public responses use dedicated DTOs and never expose database records directly.
