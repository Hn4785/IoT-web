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
    await expect(page.getByRole("status").filter({ hasText: "No new nodes detected" })).toBeVisible();
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

for (const role of ["ADMIN", "FARMER"] as const) {
  test(`${role} owner discovers new nodes, cancels or imports selected nodes without widening sharing`, async ({ page }, testInfo) => {
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

    let testCalls = 0;
    const postStationCalls: Array<{ url: string; body: unknown }> = [];
    let simulateStationError = false;

    await page.route("**/api/v1/data-sources**", async route => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();

      if (path === "/api/v1/data-sources/owned-source/test" && method === "POST") {
        testCalls++;
        return route.fulfill({
          json: {
            success: true,
            data: {
              connectionStatus: "CONNECTED",
              stationCount: 9,
              lastCheckedAt: "2026-10-27T00:01:00Z",
              newStationCodes: ["NODE-07", "NODE-08", "NODE-09"],
            },
          },
        });
      }

      if (path === "/api/v1/data-sources/owned-source/stations" && method === "POST") {
        const body = route.request().postDataJSON();
        postStationCalls.push({ url: path, body });
        if (simulateStationError) {
          return route.fulfill({
            status: 403,
            json: {
              success: false,
              error: { code: "FORBIDDEN", message: "Only the source owner can import soil stations" },
            },
          });
        }
        const stationCodes: string[] = body?.stationCodes || [];
        return route.fulfill({
          json: {
            success: true,
            data: {
              source: { ...owned, stationCount: owned.stationCount + stationCodes.length },
              importedStationCodes: stationCodes,
            },
          },
        });
      }

      if (method === "DELETE" && path === "/api/v1/data-sources/owned-source") {
        return route.fulfill({ json: { success: true, data: { removed: true } } });
      }

      if (method === "GET") {
        if (path.endsWith("/connection-status")) {
          return route.fulfill({
            json: { success: true, data: { connectionStatus: "CONNECTED", lastCheckedAt: owned.lastCheckedAt, isFromCache: false } },
          });
        }
        return route.fulfill({
          json: { success: true, data: { items: [owned, shared], nextCursor: null } },
        });
      }

      return route.fulfill({ status: 400, json: { success: false, error: { code: "BAD_REQUEST", message: "Unexpected request" } } });
    });

    await loginAs(page, `qa-${role === "ADMIN" ? "admin" : "farmer"}@example.test`);
    await page.goto(role === "ADMIN" ? "/admin/api-sources" : "/farm-owner/api-sources");

    const ownedRow = page.locator("tbody tr").nth(0);
    const sharedRow = page.getByRole("row").filter({ hasText: "Shared source" });

    await expect(sharedRow.getByRole("button", { name: "Test", exact: true })).toHaveCount(0);
    await expect(sharedRow.getByRole("cell").nth(2)).toHaveText("3");
    await expect(ownedRow.getByRole("cell").nth(2)).toHaveText("6");

    await ownedRow.getByRole("button", { name: "Test", exact: true }).click();
    await expect.poll(() => testCalls).toBe(1);
    await expect(ownedRow.getByRole("cell").nth(2)).toHaveText("6");

    const notice = page.getByRole("status").filter({ hasText: /NODE-07/ });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("3 new nodes detected: NODE-07, NODE-08, NODE-09");
    await expect(notice).toContainText("Would you like to add them?");
    await expect(page.getByRole("button", { name: "Review and add nodes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Later" })).toBeVisible();

    await page.getByRole("button", { name: "Later" }).click();
    await expect(page.getByRole("button", { name: "Review and add nodes" })).toHaveCount(0);
    expect(postStationCalls).toEqual([]);
    await expect(ownedRow.getByRole("cell").nth(2)).toHaveText("6");

    await ownedRow.getByRole("button", { name: "Test", exact: true }).click();
    await expect(page.getByRole("button", { name: "Review and add nodes" })).toBeVisible();
    await page.getByRole("button", { name: "Review and add nodes" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const checkbox07 = dialog.getByLabel("NODE-07");
    const checkbox08 = dialog.getByLabel("NODE-08");
    const checkbox09 = dialog.getByLabel("NODE-09");
    await expect(checkbox07).not.toBeChecked();
    await expect(checkbox08).not.toBeChecked();
    await expect(checkbox09).not.toBeChecked();

    await dialog.evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
    });
    await page.screenshot({ path: testInfo.outputPath("source-node-import-dialog.png"), fullPage: true });

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    expect(postStationCalls).toEqual([]);

    await page.getByRole("button", { name: "Review and add nodes" }).click();
    await expect(dialog).toBeVisible();

    simulateStationError = true;
    await dialog.getByLabel("NODE-07").check();
    await expect(dialog.getByLabel("NODE-07")).toBeChecked();
    await dialog.getByRole("button", { name: /Add nodes|Add selected/i }).click();

    await expect(dialog.getByRole("alert")).toContainText("Only the source owner can import soil stations");
    await expect(dialog.getByLabel("NODE-07")).toBeChecked();
    await expect(dialog.getByLabel("NODE-08")).not.toBeChecked();
    await expect(ownedRow.getByRole("cell").nth(2)).toHaveText("6");

    simulateStationError = false;
    await dialog.getByLabel("NODE-08").check();
    await dialog.getByRole("button", { name: /Add nodes|Add selected/i }).click();

    await expect(dialog).toHaveCount(0);
    expect(postStationCalls).toHaveLength(2);
    expect(postStationCalls[1].body).toEqual({ stationCodes: ["NODE-07", "NODE-08"] });

    await expect(ownedRow.getByRole("cell").nth(2)).toHaveText("8");
    await expect(page.getByRole("status").filter({ hasText: /2 soil stations? added.*existing sharing was unchanged/i })).toBeVisible();

    await expect(sharedRow.getByRole("cell").nth(2)).toHaveText("3");

    // Stale discovery actions: removing source clears import notice and dialog
    await ownedRow.getByRole("button", { name: "Test", exact: true }).click();
    await expect(page.getByRole("button", { name: "Review and add nodes" })).toBeVisible();
    await ownedRow.getByRole("button", { name: "Remove Source" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove Source" }).click();
    await expect(page.getByRole("status").filter({ hasText: "was removed" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review and add nodes" })).toHaveCount(0);

    expect(errors).toEqual([]);
  });
}

test("import selection caps at backend maximum 100 with preserved uncheck", async ({ page }) => {
  await setupMockApi(page, { userRole: "ADMIN" });
  const codes = Array.from({ length: 102 }, (_, i) => `NODE-${String(i + 1).padStart(3, "0")}`);
  const owned = {
    id: "owned-source", name: "provider.example",
    owner: { id: "owner", displayName: "Owner", role: "ADMIN" as const },
    baseUrl: "https://provider.example/api/v1", keyPreview: "1234",
    stationCount: 6, visibleAccountCount: 2, connectionStatus: "CONNECTED" as const,
    lastCheckedAt: "2026-10-27T00:00:00Z", canReadData: true,
    canManageAccess: true, canRevealKey: true,
    createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-27T00:00:00Z",
  };
  await page.route("**/api/v1/data-sources**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/test")) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            connectionStatus: "CONNECTED",
            stationCount: 108,
            lastCheckedAt: "2026-10-27T00:01:00Z",
            newStationCodes: codes,
          },
        },
      });
    }
    if (path.endsWith("/connection-status")) {
      return route.fulfill({ json: { success: true, data: { connectionStatus: "CONNECTED", lastCheckedAt: owned.lastCheckedAt, isFromCache: false } } });
    }
    return route.fulfill({ json: { success: true, data: { items: [owned], nextCursor: null } } });
  });

  await loginAs(page, "qa-admin@example.test");
  await page.goto("/admin/api-sources");
  await page.getByRole("button", { name: "Test", exact: true }).click();
  await page.getByRole("button", { name: "Review and add nodes" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const checkboxes = dialog.locator('input[type="checkbox"]');

  for (let i = 0; i < 100; i++) {
    await checkboxes.nth(i).evaluate((el: HTMLInputElement) => el.click());
  }

  await expect(dialog.getByText(/100 of 102 selected/)).toBeVisible();
  await expect(dialog.getByText(/Maximum limit of 100 nodes reached/)).toBeVisible();
  await expect(checkboxes.nth(100)).toBeDisabled();
  await expect(checkboxes.nth(0)).toBeEnabled();
  await checkboxes.nth(0).uncheck();
  await expect(checkboxes.nth(100)).toBeEnabled();
  await expect(dialog.getByText(/99 of 102 selected/)).toBeVisible();
});
