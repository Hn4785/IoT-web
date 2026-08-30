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

- Read `CAPABILITY-MAP.md` and the active module specification before editing.
- Use test-driven development: add one failing behavioral test, verify the expected failure, add minimal production code, then refactor while green.
- Keep commits atomic and scoped to one verified behavior.
- Run build, test, lint, and type checking before declaring a change complete.
- Update the specification before changing an approved public contract.

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
