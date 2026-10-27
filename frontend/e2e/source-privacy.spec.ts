import { test, expect } from "@playwright/test";
import { setupMockApi, loginAs } from "./support/mockApi";

for (const role of ["ADMIN", "FARMER"] as const) {
  test(`${role} Test keeps registered and shared station counts separate from upstream discovery`, async ({ page }, testInfo) => {
    await setupMockApi(page, { userRole: role });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const owned = {
      id: "owned-source", name: "provider.example — 6 soil stations",
      owner: { id: "owner", displayName: "Owner", role },
      baseUrl: "https://provider.example/api/v1", keyPreview: "1234",
      stationCount: 6, visibleAccountCount: 2, connectionStatus: "CONNECTED",
      lastCheckedAt: "2026-10-27T00:00:00Z", canReadData: true,
      canManageAccess: true, canRevealKey: true,
      createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-27T00:00:00Z",
    };
    const shared = {
      ...owned, id: "shared-source", name: "Shared source", stationCount: 3,
      owner: { id: "other", displayName: "Other owner", role: "ADMIN" },
      canManageAccess: false, canRevealKey: false,
    };
    const custom = { ...owned, id: "custom-source", name: "North field — 6 soil stations" };
    let tests = 0;
    const unexpectedWrites: string[] = [];
    await page.route("**/api/v1/data-sources**", async route => {
      const path = new URL(route.request().url()).pathname;
      let data: unknown;
      if (path === "/api/v1/data-sources/owned-source/test") {
        tests++;
        data = { connectionStatus: "CONNECTED", stationCount: 9, lastCheckedAt: "2026-10-27T00:01:00Z" };
      } else if (route.request().method() !== "GET") {
        unexpectedWrites.push(`${route.request().method()} ${path}`);
        return route.fulfill({ status: 403, json: { success: false, error: { code: "FORBIDDEN", message: "Unexpected mutation" } } });
      } else if (path.endsWith("/connection-status")) {
        data = { connectionStatus: "CONNECTED", lastCheckedAt: owned.lastCheckedAt, isFromCache: false };
      } else {
        data = { items: [owned, shared, custom], nextCursor: null };
      }
      await route.fulfill({ json: { success: true, data } });
    });
    await loginAs(page, `qa-${role === "ADMIN" ? "admin" : "farmer"}@example.test`);
    await page.goto(role === "ADMIN" ? "/admin/api-sources" : "/farm-owner/api-sources");
    const ownedRow = page.locator("tbody tr").nth(0);
    const sharedRow = page.getByRole("row").filter({ hasText: "Shared source" });
    await expect(ownedRow.getByRole("cell").nth(2)).toHaveText("6");
    await expect(sharedRow.getByRole("cell").nth(2)).toHaveText("3");
    await expect(ownedRow.getByRole("button", { name: "Test", exact: true })).toBeEnabled();
    await ownedRow.getByRole("button", { name: "Test", exact: true }).click();
    await expect.poll(() => tests).toBe(1);
    await expect(ownedRow.getByRole("button", { name: "Test", exact: true })).toBeEnabled();
    await expect(ownedRow.getByRole("cell").nth(2)).toHaveText("6");
    await expect(sharedRow.getByRole("cell").nth(2)).toHaveText("3");
    await expect(page.getByRole("status").filter({ hasText: "9 soil stations detected upstream" })).toBeVisible();
    await expect(ownedRow.locator("strong")).toHaveText("provider.example");
    await expect(page.getByText(custom.name, { exact: true })).toBeVisible();
    await expect(sharedRow.getByRole("button", { name: "Test", exact: true })).toHaveCount(0);
    await expect(ownedRow.getByRole("cell").nth(3)).toHaveText("2");
    await page.screenshot({ path: testInfo.outputPath("source-counts.png"), fullPage: true });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(ownedRow.getByRole("button", { name: "Test", exact: true })).toBeEnabled();
    await expect(ownedRow.getByRole("cell").nth(2)).toHaveText("6");
    await expect(sharedRow.getByRole("cell").nth(2)).toHaveText("3");
    await expect(ownedRow.locator("strong")).toHaveText("provider.example");
    expect(unexpectedWrites).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const role of ["ADMIN", "FARMER"] as const) {
  for (const scenario of ["valid", "autofill", "invalid", "expired"] as const) {
    test(`${role} Reveal handles ${scenario} password without unintended logout`, async ({ page }) => {
      await setupMockApi(page, { userRole: role });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      let attempts = 0;
      let submitted = "";
      let refreshes = 0;
      await page.route("**/api/v1/auth/refresh", async route => {
        refreshes++;
        await route.fulfill({ json: { success: true, data: { accessToken: "mock-refreshed", expiresIn: 900 } } });
      });
      await page.route("**/api/v1/data-sources**", async route => {
        const path = new URL(route.request().url()).pathname;
        let data: unknown;
        if (path.endsWith("/reveal")) {
          attempts++;
          submitted = route.request().postDataJSON().currentPassword;
          if (scenario === "expired" && attempts === 1) {
            return route.fulfill({ status: 401, json: { success: false, error: { code: "SESSION_EXPIRED", message: "Session is invalid or expired" } } });
          }
          if (submitted !== "valid-password-123") {
            return route.fulfill({ status: 401, json: { success: false, error: { code: "INVALID_CREDENTIALS", message: "Current password is invalid" } } });
          }
          data = { xApiKey: "fixture-provider-key", expiresInSeconds: 30 };
        } else if (path.endsWith("/connection-status")) {
          data = { connectionStatus: "CONNECTED", lastCheckedAt: "2026-10-11T00:00:00Z", isFromCache: false };
        } else {
          data = { items: [{ id: "source-1", name: "Owned source", owner: { id: "owner", displayName: "Owner", role }, baseUrl: "https://provider.example/api/v1", stationCount: 2, visibleAccountCount: 1, connectionStatus: "CONNECTED", lastCheckedAt: "2026-10-11T00:00:00Z", canReadData: true, canManageAccess: true, canRevealKey: true }], nextCursor: null };
        }
        await route.fulfill({ json: { success: true, data } });
      });
      await loginAs(page, `qa-${role === "ADMIN" ? "admin" : "farmer"}@example.test`);
      const route = role === "ADMIN" ? "/admin/api-sources" : "/farm-owner/api-sources";
      await page.goto(route);
      await page.getByRole("button", { name: "Reveal Key" }).click();
      const dialog = page.getByRole("dialog", { name: "Reveal X-API-Key" });
      refreshes = 0; // Exclude session restoration during navigation.
      const input = dialog.getByLabel("Current password");
      await input.fill(scenario === "invalid" || scenario === "autofill" ? "wrong-password-123" : "valid-password-123");
      if (scenario === "autofill") {
        // Password managers may update the native value without React's change event.
        await input.evaluate(element => { (element as HTMLInputElement).value = "valid-password-123"; });
      }
      await dialog.getByRole("button", { name: "Reveal", exact: true }).click();
      if (scenario === "autofill") {
        await expect.poll(() => submitted).toBe("valid-password-123");
      }
      if (scenario === "invalid") {
        await expect(dialog.getByRole("alert")).toHaveText("Current password is invalid");
        await expect(page).toHaveURL(new RegExp(`${route}$`));
        expect(attempts).toBe(1);
        expect(refreshes).toBe(0);
        await input.fill("valid-password-123");
        await dialog.getByRole("button", { name: "Reveal", exact: true }).click();
      }
      await expect(dialog.locator("code")).toHaveText("fixture-provider-key");
      expect(submitted).toBe("valid-password-123");
      expect(refreshes).toBe(scenario === "expired" ? 1 : 0);
      await dialog.getByRole("button", { name: "Close dialog" }).click();
      await page.getByRole("button", { name: "Reveal Key" }).click();
      await expect(dialog.locator("code")).toHaveCount(0);
      await expect(dialog.getByLabel("Current password")).toHaveValue("");
      expect(errors).toEqual([]);
    });
  }
}

test("ordinary Admin sees only connectivity for another owner's source", async ({ page }, testInfo) => {
  await setupMockApi(page, { userRole: "ADMIN" });
  await page.route("**/api/v1/data-sources**", async route => {
    const data = new URL(route.request().url()).pathname.endsWith("/connection-status")
      ? { connectionStatus: "CONNECTED", lastCheckedAt: "2026-10-11T00:00:00Z", isFromCache: false }
      : { items: [{ id: "source-1", name: "Another source", owner: { id: "other-owner", displayName: "Other Farmer", role: "FARMER" }, baseUrl: "https://provider.example/api/v1", stationCount: null, visibleAccountCount: null, connectionStatus: "CONNECTED", lastCheckedAt: "2026-10-11T00:00:00Z", canReadData: false, canManageAccess: false, canRevealKey: false }], nextCursor: null };
    await route.fulfill({ json: { success: true, data } });
  });
  await loginAs(page, "qa-admin@example.test");
  await page.goto("/admin/api-sources");
  await expect(page.getByRole("status", { name: "" }).filter({ hasText: "Connected" })).toBeVisible();
  await expect(page.getByText("Restricted", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "View Data" })).toHaveCount(0);
  await expect(page.getByText("Connection status only", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("source-privacy-health.png"), fullPage: true });
});

for (const role of ["ADMIN", "FARMER"] as const) {
  test(`${role} discards a Reveal response after its dialog closes`, async ({ page }) => {
    await setupMockApi(page, { userRole: role });
    let releaseResponse!: () => void;
    const responseReady = new Promise<void>(resolve => { releaseResponse = resolve; });
    let started = false;
    let finished = false;
    await page.route("**/api/v1/data-sources**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/reveal")) {
        started = true;
        await responseReady;
        await route.fulfill({ json: { success: true, data: { xApiKey: "obsolete-fixture-key", expiresInSeconds: 30 } } });
        finished = true;
      } else {
        const data = path.endsWith("/connection-status")
          ? { connectionStatus: "CONNECTED", lastCheckedAt: "2026-10-11T00:00:00Z", isFromCache: false }
          : { items: [{ id: "source-1", name: "Owned source", owner: { id: "owner", displayName: "Owner", role }, baseUrl: "https://provider.example/api/v1", stationCount: 2, visibleAccountCount: 1, connectionStatus: "CONNECTED", lastCheckedAt: "2026-10-11T00:00:00Z", canReadData: true, canManageAccess: true, canRevealKey: true }], nextCursor: null };
        await route.fulfill({ json: { success: true, data } });
      }
    });
    await loginAs(page, `qa-${role === "ADMIN" ? "admin" : "farmer"}@example.test`);
    await page.goto(role === "ADMIN" ? "/admin/api-sources" : "/farm-owner/api-sources");
    await page.getByRole("button", { name: "Reveal Key" }).click();
    const dialog = page.getByRole("dialog", { name: "Reveal X-API-Key" });
    await dialog.getByLabel("Current password").fill("valid-password-123");
    await dialog.getByRole("button", { name: "Reveal", exact: true }).click();
    await expect.poll(() => started).toBe(true);
    await dialog.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: "Reveal Key" }).click();
    releaseResponse();
    await expect.poll(() => finished).toBe(true);
    await expect(dialog.getByLabel("Current password")).toBeVisible();
    await expect(dialog.locator("code")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Reveal", exact: true })).toBeEnabled();
  });
}
