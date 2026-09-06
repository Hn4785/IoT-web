# Frontend–backend integration status

This branch connects the account area to the Phase A backend at `VITE_API_BASE_URL` (default: `http://localhost:3000/api/v1`). It deliberately leaves unfinished IoT screens on mock data until their contracts are available.

## Connected

- Login uses the backend envelope and redirects by `ADMIN`, `FARMER`, or `CLIENT_DEVELOPER` role.
- Access tokens remain in memory. Refresh tokens remain in the backend-managed HttpOnly cookie.
- Session restoration calls refresh once, then `/auth/me`; concurrent 401 responses share one refresh request.
- Logout calls the backend, clears local authentication state, and is visible in the top bar.
- Accounts with `PENDING_PASSWORD_CHANGE` are restricted to `/change-password` until the backend accepts a new password.
- Admin User Management lists users with backend cursor pagination and supports create, edit role/status, disable/enable, and password reset. One-time passwords are displayed only after the relevant operation.
- Client Developer API Keys supports list, create, rotate, and revoke. A secret is shown only after creation or rotation and is never persisted by the frontend.

## Known contract gap

The backend exposes commands to grant or remove Farm/Station access, but the Admin User response has no current membership/grant list and there is no read endpoint for it. The former mock permission editor was therefore disabled instead of sending fake IDs or overwriting unknown access.

To finish that UI safely, the backend should expose either assignment IDs in `GET /admin/users/:id` or a dedicated read endpoint. The frontend can then load real Farm/Plot/Station UUIDs and reconcile changes explicitly.

## Still mocked or deferred

- Station telemetry, sensors, alerts, weather, reports, dashboard metrics, and other Phase B/C screens.
- Station-scoped selection during API-key creation; new keys currently send `stationIds: []`, meaning the backend applies its documented default scope.
- Browser end-to-end authentication tests and automated accessibility checks.

## Local verification

1. Start the backend on port 3000 and the frontend with `npm run dev`.
2. Sign in using a seeded account. Confirm refresh-cookie requests use credentials and logout returns to `/login`.
3. Use a temporary-password account and confirm every protected route redirects to `/change-password`.
4. As Admin, create/edit/disable/reset an account and use Next/Previous on the user list.
5. As Client Developer, create, copy once, rotate, and revoke an API key.
6. Run `npm test`, `npm run lint`, `npm run build`, and `npm audit --audit-level=high`.

Never commit `.env`, access tokens, refresh cookies, temporary passwords, or generated API-key secrets.
