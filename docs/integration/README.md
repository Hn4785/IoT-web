# Frontend integration follow-up

The shared API foundation now follows the backend Phase A contract. The access token is memory-only and the refresh token remains in the backend HttpOnly cookie.

Still owned by the frontend team:

- Replace the mock login screen with `authService.login` and restore sessions through refresh followed by `/auth/me`.
- Connect Admin User Management to `userService`, including cursor pagination and one-time temporary-password display.
- Treat route guards as presentation only; backend authorization remains authoritative.
- Keep station, sensor, alert and telemetry screens on mock data until their backend contracts are implemented.
- Add browser-level authentication tests and address the existing lint and bundle-size warnings.
