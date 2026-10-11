# Client Developer checkpoint

This is the completed checkpoint index. Current F/FE evidence is in the
handover report (provided separately, not in Git); remaining work is in the
[BE task index](https://github.com/Hn4785/IoT-web/blob/BE/tasks/todo.md).

- [x] Slice 1: canonical routes, legacy redirects, and navigation.
- [x] Slice 2: API Access tabs, behavior, security, and responsive design.
- [x] Slice 3: API Tools tabs, Explorer/docs contract, and responsive design.
- [x] Client station-grant recovery in User Management.
- [x] Final Phase B Settings checkpoint: password-change notice/action only.
- [x] Independent technical review.
- [x] Focused verification and local commits.
- [x] Record the verified checkpoint in this task index.

Frontend Phase B is closed. Settings is intentionally limited to the existing
password-change notice/action and is not expanded into a general settings area.

## Handover documentation

- [x] Complete one self-contained Word report, version 1.1, dated 2026-10-08.
- [x] Review all 57 rendered pages, black text, schema/API facts and source paths.
- [x] Keep the updated Word report outside Git; remove internal release notes
      and clean references. The previously published 1.0 report is unchanged.
- [x] Keep only the open P2 in the active issue ledger; separate receiving-team
      acceptance and live-provider evidence from reproduced logic bugs.
- [ ] Receiving-team acceptance and sign-off.

The 2026-10-08 update changes documentation only. Runtime, dependencies and databases are
unchanged; no Pi redeployment or sample-data transfer was performed.

## Release v3.0 — 2026-10-11

- [x] Use email search and one recipient editor in Manage Access for both Admin
      and Farmer. Keep name/email/role visible and station selection explicit.
- [x] List only shared accounts below the editor; support editing and revoking.
      Typing, searching and selecting an account do not save access.
- [x] Preserve owner-only backend checks and current station-scoped permissions;
      paginate recipient searches and shared accounts without losing existing access.
- [x] Refresh grant pagination after Save/Revoke, including a revoked cursor account.
- [x] Fix login redirects that reused another role's route and sent Admin to
      Access Denied. Valid same-role deep links and denial guards remain unchanged.
- [x] Set package version 3.0.0 and displayed release v3.0; update API examples.
- [x] Verify 243/243 unit tests, 22/22 desktop/mobile browser cases, lint, build
      and dependency audit. Review the sharing editor at both viewport sizes.
- [x] Publish runtime commits BE `12f27ad` and FE `1f310a7`; deploy v3.0 on Pi.
      Health/readiness, protected-endpoint denial and deployed asset hash passed.
      PostgreSQL and ngrok retained their existing containers and start times.
      No handover document, credentials, database dump or sample data was published.
