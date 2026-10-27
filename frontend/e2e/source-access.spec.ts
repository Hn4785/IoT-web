import { test, expect } from "@playwright/test";
import { setupMockApi, loginAs } from "./support/mockApi";

for (const role of ["ADMIN", "FARMER"] as const) {
  test(`${role} shares only after choosing email and saving stations`, async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await setupMockApi(page, { userRole: role });
    const recipient = { id: "recipient-1", displayName: "Chicken", email: "chicken@example.test", role: "FARMER" };
    const other = { ...recipient, id: "recipient-2", email: "developer@example.test", role: "CLIENT_DEVELOPER" };
    let grants = [{ user: other, stationIds: ["station-2"], createdAt: "2026-10-11T00:00:00Z" }];
    const writes: { method: string; body: unknown }[] = [];
    await page.route("**/api/v1/data-sources**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      let data: unknown;
      if (request.method() === "PUT") {
        const body = request.postDataJSON();
        writes.push({ method: "PUT", body });
        const user = path.includes(recipient.id) ? recipient : other;
        grants = [...grants.filter(g => g.user.id !== user.id), { user, stationIds: body.stationIds, createdAt: "2026-10-11T00:00:00Z" }];
        data = { assigned: true };
      } else if (request.method() === "DELETE") {
        writes.push({ method: "DELETE", body: null });
        grants = grants.filter(g => !path.includes(g.user.id));
        data = { assigned: false };
      } else if (path.endsWith("/grant-candidates")) {
        data = { items: [recipient, other].filter(r => r.email.includes(url.searchParams.get("email") ?? "")), nextCursor: null };
      } else if (path.endsWith("/grants")) data = { items: grants, nextCursor: null };
      else if (path.endsWith("/stations")) data = { items: [{ id: "station-1", name: "NODE01", code: "NODE01" }, { id: "station-2", name: "NODE02", code: "NODE02" }] };
      else if (path.endsWith("/connection-status")) data = { connectionStatus: "CONNECTED", lastCheckedAt: "2026-10-11T00:00:00Z", isFromCache: false };
      else data = { items: [{ id: "source-1", name: "Soil Source", owner: { id: "owner", displayName: "Owner", role }, baseUrl: "https://provider.example/api/v1", stationCount: 2, visibleAccountCount: 2, connectionStatus: "CONNECTED", lastCheckedAt: "2026-10-11T00:00:00Z", canManageAccess: true, canRevealKey: false }], nextCursor: null };
      await route.fulfill({ json: { success: true, data } });
    });
    await loginAs(page, `qa-${role === "ADMIN" ? "admin" : "farmer"}@example.test`);
    await page.goto(role === "ADMIN" ? "/admin/api-sources" : "/farm-owner/api-sources");
    await page.getByRole("button", { name: "Manage Access" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(other.email, { exact: true })).toBeVisible();
    await expect(dialog.getByText(recipient.email, { exact: true })).toHaveCount(0);
    await dialog.getByLabel("Recipient email").fill("chicken");
    expect(writes).toEqual([]);
    await dialog.getByRole("button", { name: "Search accounts" }).click();
    await dialog.getByRole("button", { name: new RegExp(recipient.email) }).click();
    const editor = dialog.getByRole("group", { name: "Station access" });
    await expect(editor.getByRole("button", { name: "Save Access" })).toBeDisabled();
    await editor.getByLabel(/NODE01/).check();
    await page.screenshot({ path: testInfo.outputPath("sharing-v3.0.png"), fullPage: true });
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(writes).toEqual([]);
    await editor.getByRole("button", { name: "Save Access" }).click();
    await expect(editor).toHaveCount(0);
    expect(writes).toEqual([{ method: "PUT", body: { stationIds: ["station-1"] } }]);
    const shared = dialog.getByRole("region", { name: "Shared accounts" });
    await shared.getByRole("button", { name: `Edit access for ${recipient.email}` }).click();
    await dialog.getByRole("group", { name: "Station access" }).getByLabel(/NODE02/).check();
    await dialog.getByRole("button", { name: "Save Access" }).click();
    await expect(dialog.getByRole("group", { name: "Station access" })).toHaveCount(0);
    await shared.getByRole("button", { name: `Edit access for ${recipient.email}` }).click();
    await dialog.getByRole("button", { name: "Revoke Access", exact: true }).click();
    await expect(shared.getByText(recipient.email, { exact: true })).toHaveCount(0);
    expect(writes.at(-1)?.method).toBe("DELETE");
    await dialog.getByLabel("Recipient email").fill("unknown");
    await dialog.getByRole("button", { name: "Search accounts" }).click();
    await expect(dialog.getByText("No matching active accounts.")).toBeVisible();
    await expect(shared.getByText(other.email, { exact: true })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}

test("revoking a page-boundary grant refreshes pagination before loading more accounts", async ({ page }) => {
  await setupMockApi(page, { userRole: "FARMER" });
  const account = (id: string) => ({ id, displayName: "Shared Farmer", email: `${id}@example.test`, role: "FARMER" });
  const grant = (id: string) => ({ user: account(id), stationIds: ["s-1"], createdAt: "2026-10-11T00:00:00Z" });
  let revoked = false;
  await page.route("**/api/v1/data-sources**", async route => {
    const url = new URL(route.request().url());
    let data: unknown;
    if (route.request().method() === "DELETE") { revoked = true; data = { assigned: false }; }
    else if (url.pathname.endsWith("/grants")) {
      const cursor = url.searchParams.get("cursor");
      if (revoked && cursor === "first") return route.fulfill({ status: 400, json: { success: false, error: { code: "VALIDATION_ERROR", message: "Cursor is invalid" } } });
      data = cursor ? { items: [grant("third")], nextCursor: null } : { items: [grant(revoked ? "second" : "first")], nextCursor: revoked ? "second" : "first" };
    } else if (url.pathname.endsWith("/stations")) data = { items: [{ id: "s-1", name: "NODE01", code: "NODE01" }] };
    else if (url.pathname.endsWith("/connection-status")) data = { connectionStatus: "CONNECTED", lastCheckedAt: "2026-10-11T00:00:00Z", isFromCache: false };
    else data = { items: [{ id: "source-1", name: "Soil Source", owner: { id: "owner", displayName: "Owner", role: "FARMER" }, baseUrl: "https://provider.example/api/v1", stationCount: 1, visibleAccountCount: 4, connectionStatus: "CONNECTED", lastCheckedAt: "2026-10-11T00:00:00Z", canManageAccess: true, canRevealKey: false }], nextCursor: null };
    await route.fulfill({ json: { success: true, data } });
  });
  await loginAs(page, "qa-farmer@example.test");
  await page.goto("/farm-owner/api-sources");
  await page.getByRole("button", { name: "Manage Access" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Edit access for first@example.test" }).click();
  await dialog.getByRole("button", { name: "Revoke Access", exact: true }).click();
  await expect(dialog.getByRole("group", { name: "Station access" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "More shared accounts" }).click();
  await expect(dialog.getByText("third@example.test", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});
