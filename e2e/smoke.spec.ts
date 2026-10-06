import { test, expect } from "@playwright/test";
import { setupMockApi, loginAs } from "./support/mockApi";

test.describe("Mock smoke suite", () => {
  test("restore and login role routing", async ({ page }) => {
    await setupMockApi(page, { userRole: "ADMIN" });
    await loginAs(page, "qa-admin@example.test");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Users", exact: true })).toBeVisible();

    await loginAs(page, "qa-farmer@example.test");
    await expect(page).toHaveURL(/\/farm-owner\/dashboard/);
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Soil Dashboard", exact: true })).toBeVisible();

    await loginAs(page, "qa-client@example.test");
    await expect(page).toHaveURL(/\/developer\/dashboard/);
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "API Access", exact: true })).toBeVisible();

    await loginAs(page, "qa-temporary@example.test");
    await expect(page).toHaveURL(/\/change-password/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/(change-password|admin|farm-owner|developer)/);
  });

  test("revoke refresh redirects to login", async ({ page }) => {
    await setupMockApi(page, { revokeRefresh: true });
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("notifications page 100 next 101 then 403 purges or alerts", async ({ page }) => {
    const mock = await setupMockApi(page, { userRole: "FARMER" });
    await loginAs(page, "qa-farmer@example.test");
    await page.waitForURL(/\/farm-owner\/dashboard/);

    await page.goto("/farm-owner/notifications");
    await expect(page.locator("article")).toHaveCount(100);

    const loadMoreButton = page.getByRole("button", { name: /Load more notifications/i });
    await expect(loadMoreButton).toBeVisible();
    await loadMoreButton.click();
    await expect(page.locator("article")).toHaveCount(101);

    mock.setNotificationError(500);
    const refreshBtn = page.getByRole("button", { name: /Refresh/i });
    await refreshBtn.click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.locator("article")).toHaveCount(101);

    mock.setNotificationError(403);
    await page.reload();
    await expect(page.locator("article")).toHaveCount(0);
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Refresh/i })).toBeEnabled();
  });

  test("key one-time ack overlay protection", async ({ page }) => {
    await setupMockApi(page, { userRole: "CLIENT_DEVELOPER" });
    await loginAs(page, "qa-client@example.test");
    await page.waitForURL(/\/developer\/dashboard/);

    await page.goto("/developer/api-access/keys");
    await page.getByRole("button", { name: /Create API Key/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator("input").first().fill("Telemetry Integration Key");
    await dialog.getByRole("button", { name: /Generate Key/i }).click();

    await expect(dialog.getByText(/API key ready/i)).toBeVisible();
    const secretCode = dialog.locator("code").first();
    await expect(secretCode).toBeVisible();
    const secretText = await secretCode.innerText();
    expect(secretText).toContain("apk_one_time_secret");

    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await dialog.locator("..").click({ position: { x: 2, y: 2 }, force: true });
    await expect(dialog).toBeVisible();

    await dialog.evaluate((d: HTMLElement) => d.focus());
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);

    const ackCheckbox = dialog.locator("input[type='checkbox']");
    const doneBtn = dialog.getByRole("button", { name: /Done/i });
    await expect(doneBtn).toBeDisabled();
    await ackCheckbox.check();
    await expect(doneBtn).toBeEnabled();
    await doneBtn.click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("table")).not.toContainText(secretText);
  });

  test("station search is role-appropriate", async ({ page }) => {
    await setupMockApi(page, { userRole: "FARMER" });
    await loginAs(page, "qa-farmer@example.test");
    await page.waitForURL(/\/farm-owner\/dashboard/);

    const searchInput = page.getByPlaceholder(/Search stations/i);
    await searchInput.fill("NODE01");
    await searchInput.press("Enter");

    const resultButton = page.locator("section[aria-label='Station search results'] button").first();
    await expect(resultButton).toBeVisible();
    await resultButton.click();
    await expect(page).toHaveURL(/\/farm-owner\/stations\/s-1/);

    await setupMockApi(page, { userRole: "ADMIN" });
    await page.goto("/admin");
    const adminSearch = page.getByPlaceholder(/Search stations/i);
    await adminSearch.fill("NODE01");
    await adminSearch.press("Enter");
    const adminResult = page.locator("section[aria-label='Station search results'] button").first();
    await expect(adminResult).toBeVisible();
    await adminResult.click();
    await expect(page).toHaveURL(/\/admin\/stations\/s-1/);
  });

  test("report and analysis loaded history then download native CSV", async ({ page }) => {
    await setupMockApi(page, { userRole: "FARMER" });
    await loginAs(page, "qa-farmer@example.test");
    await page.waitForURL(/\/farm-owner\/dashboard/);

    await page.goto("/farm-owner/history-reports");
    await page.locator("select").nth(0).selectOption({ index: 1 });
    await page.locator("select").nth(1).selectOption({ index: 1 });
    await page.locator("select").nth(2).selectOption({ index: 1 });
    await page.getByRole("button", { name: /Apply/i }).click();

    const exportButton = page.getByRole("button", { name: /Export CSV/i });
    await expect(exportButton).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      exportButton.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const csv = Buffer.concat(chunks).toString("utf-8");

    expect(csv).toContain("observedAt,value,unit,quality");
    expect(csv).toContain("%");
    expect(csv).toContain("2026-10-05T08:00:00.000Z");
    expect(csv).toContain("25.1");
    expect(csv).not.toContain("null");

    await page.goto("/farm-owner/historical-analysis");
    const analysisExport = page.getByRole("button", { name: /Export CSV/i });
    await expect(analysisExport).toBeEnabled();
    const [analysisDownload] = await Promise.all([
      page.waitForEvent("download"),
      analysisExport.click(),
    ]);
    expect(analysisDownload.suggestedFilename()).toMatch(/^soil-history-.*\.csv$/);
  });

  test("super audit allowed and admin 403 on audit events", async ({ page }) => {
    await setupMockApi(page, { userRole: "ADMIN", isSuperAdmin: false });
    await loginAs(page, "qa-admin@example.test");
    await page.waitForURL(/\/admin/);
    await page.goto("/admin/audit-logs");
    await expect(page.getByText(/Only the Super Admin can read audit events/i)).toBeVisible();

    await setupMockApi(page, { userRole: "ADMIN", isSuperAdmin: true });
    await loginAs(page, "qa-super@example.test");
    await page.waitForURL(/\/admin/);
    await page.goto("/admin/audit-logs");
    await expect(page.getByText(/Audit Activity/i)).toBeVisible();

    const resultSelect = page.locator("label:has-text('Result') select");
    await resultSelect.selectOption("SUCCESS");
    await page.getByRole("button", { name: /Apply/i }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(2);

    const nextBtn = page.getByRole("button", { name: /Next/i });
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
    await expect(page.getByText(/Page 2/i)).toBeVisible();
    await expect(page.locator("table tbody tr")).toHaveCount(1);
  });
});
