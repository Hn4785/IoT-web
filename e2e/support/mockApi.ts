import type { Page, Route } from "@playwright/test";

export interface MockApiOptions {
  userRole?: "ADMIN" | "FARMER" | "CLIENT_DEVELOPER";
  isSuperAdmin?: boolean;
  status?: "ACTIVE" | "PENDING_PASSWORD_CHANGE";
  revokeRefresh?: boolean;
  notificationError?: number;
}

export async function loginAs(page: Page, email: string, password = "valid-password-123") {
  await page.goto("/login");
  await page.fill("#login-email", email);
  await page.fill("#login-password", password);
  await page.click('button[type="submit"]');
}

export async function setupMockApi(page: Page, options: MockApiOptions = {}) {
  const role = options.userRole ?? "FARMER";
  const isSuper = options.isSuperAdmin ?? false;
  const status = options.status ?? "ACTIVE";

  const makeUser = (userRole = role, superAdmin = isSuper, userStatus = status) => ({
    id: `usr-${userRole.toLowerCase()}`,
    displayName: `Test ${userRole}`,
    email: `qa-${superAdmin ? "super" : userRole.toLowerCase()}@example.test`,
    role: userRole,
    isSuperAdmin: superAdmin,
    status: userStatus,
    assignedFarmIds: ["farm-1"],
    assignedPlotIds: ["plot-1"],
    assignedStationIds: ["s-1"],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  });

  let currentUser = makeUser();
  let notifErr = options.notificationError;

  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = route.request().method();

    const ok = (data: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    const err = (code: string, message: string, status = 400) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: false, error: { code, message }, requestId: "mock-err" }) });

    if (path === "/auth/login" && method === "POST") {
      const body = JSON.parse(route.request().postData() || "{}");
      if (body.email?.includes("super")) currentUser = makeUser("ADMIN", true);
      else if (body.email?.includes("admin")) currentUser = makeUser("ADMIN", false);
      else if (body.email?.includes("temporary")) currentUser = makeUser("FARMER", false, "PENDING_PASSWORD_CHANGE");
      else if (body.email?.includes("client")) currentUser = makeUser("CLIENT_DEVELOPER", false);
      else currentUser = makeUser("FARMER", false);
      return ok({ user: currentUser, accessToken: "mock-token", expiresIn: 3600 });
    }
    if (path === "/auth/refresh" && method === "POST") {
      if (options.revokeRefresh) return err("UNAUTHORIZED", "Token revoked", 401);
      return ok({ accessToken: "mock-token", expiresIn: 3600 });
    }
    if (path === "/auth/me" && method === "GET") return ok(currentUser);
    if (path === "/auth/logout" && method === "POST") return ok(null);

    if (path === "/health" && method === "GET") {
      return ok({ service: "AgriSense API", status: "healthy", version: "2.5.6", environment: "development", time: new Date().toISOString() });
    }

    if (path === "/notifications" && method === "GET") {
      if (notifErr) return err(notifErr === 403 ? "FORBIDDEN" : "INTERNAL_ERROR", "Notification error", notifErr);
      const cursor = url.searchParams.get("cursor");
      if (cursor === "101") {
        return ok({
          items: [{
            id: "notif-101", alertId: "alert-101", eventType: "OPENED",
            station: { id: "s-1", code: "NODE01", name: "Station 1" }, field: "MOISTURE",
            severity: "CRITICAL", alertStatus: "OPEN", isRead: false, createdAt: "2026-10-05T00:00:00.000Z",
          }],
          unreadCount: 101, nextCursor: null,
        });
      }
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `notif-${i + 1}`, alertId: `alert-${i + 1}`, eventType: "OPENED",
        station: { id: "s-1", code: "NODE01", name: "Station 1" }, field: "MOISTURE",
        severity: i % 2 === 0 ? "CRITICAL" : "WARNING", alertStatus: "OPEN", isRead: false,
        createdAt: "2026-10-05T00:00:00.000Z",
      }));
      return ok({ items, unreadCount: 101, nextCursor: "101" });
    }

    if (path === "/farms" && method === "GET") return ok({ items: [{ id: "farm-1", name: "Green Farm" }], nextCursor: null });
    if (path === "/farms/farm-1/plots" && method === "GET") return ok({ items: [{ id: "plot-1", farmId: "farm-1", name: "North Field" }], nextCursor: null });
    if (path === "/plots/plot-1/stations" && method === "GET") return ok({ items: [{ id: "s-1", farmId: "farm-1", plotId: "plot-1", name: "Station 1", code: "NODE01" }], nextCursor: null });
    if (path === "/stations/s-1" && method === "GET") return ok({ id: "s-1", farmId: "farm-1", plotId: "plot-1", name: "Station 1", code: "NODE01", status: "ACTIVE" });
    if (path === "/stations/s-1/field-metadata" && method === "GET") return ok({ fields: [{ field: "moisture", unit: "%" }] });
    if (path === "/alerts" && method === "GET") return ok({ items: [], nextCursor: null });
    if (path === "/stations/s-1/data/latest" && method === "GET") {
      return ok({ stationId: "s-1", readings: { moisture: { value: 24.5, unit: "%", quality: "GOOD", observedAt: "2026-10-05T08:00:00.000Z" } } });
    }
    if (path === "/stations/s-1/data/history" && method === "GET") {
      return ok({
        stationId: "s-1", measurement: "soil",
        series: [{
          field: "moisture", unit: "%", sensorId: "s1", depthCm: 10,
          points: [
            { observedAt: "2026-10-05T08:00:00.000Z", value: 25.1, quality: "good" },
            { observedAt: "2026-10-05T09:00:00.000Z", value: 24.8, quality: "good" },
          ],
        }],
        page: { nextCursor: null }, fetchedAt: "2026-10-05T10:00:00.000Z",
        isFromCache: false, isStale: false, dataOrigin: "upstream", coverage: { status: "complete" },
      });
    }

    if (path === "/developer/api-keys" && method === "GET") {
      return ok({ items: [{ id: "k-1", name: "Analytics Key", prefix: "apk_123", createdAt: "2026-10-01T00:00:00.000Z", lastUsedAt: null, expiresAt: "2027-01-01T00:00:00.000Z", requestsPerMinute: 60, stationIds: ["s-1"], revokedAt: null }] });
    }
    if (path === "/developer/api-keys/available-stations" && method === "GET") {
      return ok({ items: [{ id: "s-1", name: "Station 1", code: "NODE01" }] });
    }
    if (path === "/developer/api-keys" && method === "POST") {
      const body = JSON.parse(route.request().postData() || "{}");
      return ok({
        apiKey: { id: "k-2", name: body.name, prefix: "apk_sec", createdAt: "2026-10-05T00:00:00.000Z", lastUsedAt: null, expiresAt: "2027-01-01T00:00:00.000Z", requestsPerMinute: 60, stationIds: body.stationIds ?? [], revokedAt: null },
        key: "apk_one_time_secret_998877",
      });
    }
    if (path.startsWith("/developer/api-keys/") && path.endsWith("/rotate") && method === "POST") {
      return ok({
        apiKey: { id: "k-1", name: "Analytics Key", prefix: "apk_rot", createdAt: "2026-10-01T00:00:00.000Z", lastUsedAt: null, expiresAt: "2027-01-01T00:00:00.000Z", requestsPerMinute: 60, stationIds: ["s-1"], revokedAt: null },
        key: "apk_rotated_secret_112233",
      });
    }
    if (path.startsWith("/developer/api-keys/") && path.endsWith("/revoke") && method === "POST") {
      return ok({ id: "k-1", revokedAt: "2026-10-05T10:00:00.000Z" });
    }

    if (path === "/admin/audit-events" && method === "GET") {
      if (!currentUser.isSuperAdmin) return err("FORBIDDEN", "Only the Super Admin can read audit events.", 403);
      const cursor = url.searchParams.get("cursor");
      const resultFilter = url.searchParams.get("result");
      const allEvents = [
        { id: "aud-1", action: "LOGIN", result: "SUCCESS", actorUserId: "usr-super", targetType: "SESSION", requestId: "r-1", createdAt: "2026-10-05T00:00:00.000Z" },
        { id: "aud-2", action: "KEY_ROTATE", result: "SUCCESS", actorUserId: "usr-client", targetType: "API_KEY", requestId: "r-2", createdAt: "2026-10-05T01:00:00.000Z" },
      ];
      const items = resultFilter ? allEvents.filter((e) => e.result === resultFilter) : allEvents;
      return ok({ items: cursor ? [{ ...allEvents[0], id: "aud-3", action: "LOGIN_REJECTED" }] : items, nextCursor: cursor ? null : "aud-page-2" });
    }

    return err("NOT_FOUND", `Endpoint not matched: ${path}`, 404);
  });

  return {
    setNotificationError: (code?: number) => { notifErr = code; },
  };
}
