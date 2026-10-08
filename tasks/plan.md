# Implementation Plan: Client Developer checkpoint

This preserves the completed Client Developer checkpoint, not the current global
work queue. Current F/FE/release evidence is in the
handover report (provided separately, not in Git); remaining work is in the
[BE task index](https://github.com/Hn4785/IoT-web/blob/BE/tasks/todo.md).

## Overview

Complete the Client Developer portal using only approved backend contracts. Consolidate duplicated navigation into API Access and API Tools, preserve legacy URLs with redirects, keep metrics fail-closed, align the visual frame with Admin/Farmer, and verify API-key security and real client API requests.

## Architecture decisions

- Canonical navigation exposes Dashboard, API Access, and API Tools only.
- API Access contains Keys and Access Scope tabs backed by existing bearer-authenticated developer key endpoints.
- API Tools contains Documentation and API Explorer tabs. Explorer continues to send the user-entered `X-API-Key` directly and never persists or echoes it.
- Legacy API Keys, Permissions, Docs, and Explorer URLs redirect to their canonical tab routes for one compatibility cycle.
- API Metrics stays reachable only through its legacy route as an unavailable-contract explanation; it is hidden from navigation and never fabricates analytics.
- No backend, role guard, session, database, dependency, or deployment changes are part of this checkpoint.

## Task list

### Slice 1: Canonical Client navigation and route compatibility

- [x] Add canonical API Access and API Tools routes with explicit tabs.
- [x] Redirect legacy Keys, Permissions, Docs, and Explorer routes to the matching canonical tab.
- [x] Reduce Client sidebar to Dashboard, API Access, and API Tools; hide API Metrics.
- [x] Preserve CLIENT_DEVELOPER guards and the existing default dashboard route.

Verification: focused route/navigation tests and production type checking.

### Slice 2: API Access behavior and design

- [x] Reuse real key inventory, create, rotate, revoke, station scope, one-time secret, copy feedback, loading/error/empty states.
- [x] Keep effective access read-only and remove `N/A` wording where absence can be stated plainly.
- [x] Align the page to the 1440px content frame, project tokens, responsive controls, keyboard labels, and focusable tabs.

Verification: focused API key/access tests, lint, and responsive source assertions.

### Slice 3: API Tools behavior and design

- [x] Reuse contract-valid documentation and Explorer requests for health, stations, latest, and history.
- [x] Preserve validation, rate-limit headers, cursor handling, exact response envelopes, and in-memory-only API key handling.
- [x] Align Documentation and Explorer under one responsive tabbed area without inventing endpoints or response fields.

Verification: focused Explorer/docs tests, security assertions, and build.

### Checkpoint: independent audit

- [x] Perform an independent read-only review of routing, security, API contracts, empty/error/loading states, accessibility, and design consistency.
- [x] Independently inspect the diff and run the focused Client test set plus lint/build.
- [x] Record the checkpoint in `tasks/todo.md` and commit local only.

## Risks and mitigations

| Risk                                               | Impact | Mitigation                                                                                                    |
| -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| API key leaks into storage, URL, logs, or examples | High   | Keep secrets in component memory; test source and request config; never include real credentials in evidence. |
| Redirects weaken role protection                   | High   | Canonical and legacy routes retain `CLIENT_DEVELOPER` guards; test route map.                                 |
| Consolidation changes API behavior                 | Medium | Reuse existing services and DTOs; no endpoint changes.                                                        |
| Metrics page suggests unavailable telemetry        | Medium | Hide from navigation and keep truthful unavailable copy only.                                                 |
| Visual consolidation breaks mobile                 | Medium | Use native controls, tokenized layout, and test 390px/desktop behavior during final browser matrix.           |

## Open questions

None. The final Settings checkpoint reuses the protected change-password flow
and intentionally adds no general account configuration surface.
