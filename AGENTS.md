# AgriSense Frontend Agent Rules

## Skill gate

- Before changing code, configuration, tests, or documentation in every turn,
  identify the applicable skill and read its complete `SKILL.md`.
- Confirm to the user that the skill has been read and understood before making
  any edit. Re-read it on later turns; do not rely on an earlier turn.
- If a required skill is unavailable, report that clearly before using the
  safest fallback.

## Project rules

- Backend contracts and authorization are authoritative; do not invent routes,
  DTO fields, permissions, device state, or sample production data.
- Keep the single project update record in
  `tasks/todo.md`. Record verified scope and evidence there; do not create another
  changelog or per-version update file.
- Before marking a change complete, check connected API contracts, role routing,
  session behavior, shared UI and relevant tests. Browser-only claims require
  browser evidence under consistent viewport and zoom.
- Never commit credentials, `.env`, access/refresh tokens, temporary passwords,
  API keys or unredacted diagnostic screenshots.
