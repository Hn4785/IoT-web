import { test, expect } from "@playwright/test";
import { loginAs } from "./support/mockApi";

const isRealApi = process.env.QA_REAL_API === "true";
const password = process.env.QA_FIXTURE_PASSWORD;

test.describe("Real backend live fixture suite", () => {
  test.describe.configure({ timeout: 60000 });
  test.beforeEach(async () => {
    test.skip(!isRealApi, "QA_REAL_API is not set to true; skipping live real-backend fixture");
    test.skip(!password, "QA_FIXTURE_PASSWORD is not set; skipping live real-backend fixture");
    // Honor the application's unchanged per-IP login/refresh/request budgets.
    await new Promise((resolve) => setTimeout(resolve, 12000));
  });

  test("real actual API HTTP login and role routing", async ({ page }) => {
    const roles = [
      { email: "qa-super@example.test", path: /\/admin/ },
      { email: "qa-admin@example.test", path: /\/admin/ },
      { email: "qa-farmer@example.test", path: /\/farm-owner\/dashboard/ },
      { email: "qa-client@example.test", path: /\/developer\/dashboard/ },
      { email: "qa-temporary@example.test", path: /\/change-password/ },
    ];

    for (const { email, path } of roles) {
      await loginAs(page, email, password!);
      await expect(page).toHaveURL(path);
    }
  });

  test("super audit allowed and admin 403 on audit events", async ({ page }) => {
    await loginAs(page, "qa-super@example.test", password!);
    await page.waitForURL(/\/admin/);

    await page.goto("/admin/audit-logs");
    await expect(page.getByText(/Audit Activity/i)).toBeVisible();
    await expect(page.getByText(/Only the Super Admin can read audit events/i)).not.toBeVisible();

    const resultSelect = page.locator("label:has-text('Result') select");
    await resultSelect.selectOption("SUCCESS");
    await page.getByRole("button", { name: /Apply/i }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(20);
    const firstPage = await page.locator("table tbody tr").allTextContents();
    const nextBtn = page.getByRole("button", { name: /Next/i });
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
    await expect(page.getByText(/Page 2/i)).toBeVisible();
    await expect(page.locator("table tbody tr")).toHaveCount(20);
    expect(await page.locator("table tbody tr").allTextContents()).not.toEqual(firstPage);

    await loginAs(page, "qa-admin@example.test", password!);
    await page.waitForURL(/\/admin/);

    await page.goto("/admin/audit-logs");
    await expect(page.getByText(/Only the Super Admin can read audit events/i)).toBeVisible();
  });

  test("farmer notification cursor > 100 pagination", async ({ page }) => {
    await loginAs(page, "qa-farmer@example.test", password!);
    await page.waitForURL(/\/farm-owner\/dashboard/);

    await page.goto("/farm-owner/notifications");
    const loadMoreButton = page.getByRole("button", { name: /Load more notifications/i });
    await expect(loadMoreButton).toBeVisible();
    await loadMoreButton.click();
    await expect(page.locator("article").nth(100)).toBeVisible();
  });

  test("developer key create, rotate, and revoke", async ({ page }) => {
    await loginAs(page, "qa-client@example.test", password!);
    await page.waitForURL(/\/developer\/dashboard/);

    await page.goto("/developer/api-access/keys");
    await page.getByRole("button", { name: /Create API Key/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator("input").first().fill("Live QA Key");
    await dialog.getByRole("button", { name: /Generate Key/i }).click();

    await expect(dialog.getByText(/API key ready/i)).toBeVisible();
    const ackCheckbox = dialog.locator("input[type='checkbox']");
    await ackCheckbox.check();
    await dialog.getByRole("button", { name: /Done/i }).click();
    await expect(dialog).not.toBeVisible();

    page.on("dialog", (d) => d.accept());
    const rotateButton = page.locator("button[title='Rotate key']").first();
    await expect(rotateButton).toBeVisible();
    await rotateButton.click();
    await expect(dialog.getByText(/API key ready/i)).toBeVisible();
    await ackCheckbox.check();
    await dialog.getByRole("button", { name: /Done/i }).click();
    await expect(dialog).not.toBeVisible();

    const revokeButton = page.locator("button[title='Revoke key']").first();
    await expect(revokeButton).toBeVisible();
    await revokeButton.click();
    await expect(page.locator("table")).toContainText(/Revoked/i);
  });

  test("history native CSV export from controlled provider", async ({ page }) => {
    await loginAs(page, "qa-farmer@example.test", password!);
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
    const content = Buffer.concat(chunks).toString("utf-8");

    expect(content).toContain("observedAt,value,unit,quality");
    expect(content.split("\n").length).toBeGreaterThan(2);
  });

  test("user creation, forced password change, reload and logout", async ({ page }, testInfo) => {
    await loginAs(page, "qa-super@example.test", password!);
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Create User", exact: true }).click();
    const drawer = page.getByRole("dialog");
    const email = `qa-created-${testInfo.project.name}-${Date.now()}@example.test`;
    await drawer.getByLabel("Display name").fill("QA Created Farmer");
    await drawer.getByLabel("Email", { exact: true }).fill(email);
    await drawer.getByRole("button", { name: "Create User", exact: true }).click();
    const credential = page.getByRole("dialog");
    await expect(credential.getByRole("heading", { name: "Account created" })).toBeVisible();
    const temporary = await credential.locator("code").innerText();
    await credential.getByRole("checkbox").check();
    await credential.getByRole("button", { name: "Done", exact: true }).click();
    await loginAs(page, email, temporary);
    await expect(page).toHaveURL(/\/change-password/);
    await page.getByLabel("Current Password", { exact: true }).fill(temporary);
    await page.getByLabel("New Password", { exact: true }).fill("short");
    await page.getByLabel("Confirm New Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Update Password", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("between 12 and 128");
    const permanent = `${password!}-new`;
    await page.getByLabel("New Password", { exact: true }).fill(permanent);
    await page.getByLabel("Confirm New Password", { exact: true }).fill(permanent);
    await page.getByRole("button", { name: "Update Password", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Account Secured" })).toBeVisible();
    await page.getByRole("button", { name: "Enter Dashboard" }).click();
    await expect(page).toHaveURL(/\/farm-owner\/dashboard/);
    await page.reload();
    await expect(page).toHaveURL(/\/farm-owner\/dashboard/);
    await page.getByRole("button", { name: "User menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/farm-owner/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("Super Admin transfer revokes both sessions and can be restored in fixture", async ({ page }) => {
    async function transfer(target: string) {
      await page.goto("/admin/users");
      await page.getByRole("button", { name: `Make ${target} Super Admin`, exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Current Super Admin password").fill(password!);
      await dialog.getByRole("checkbox").check();
      await dialog.getByRole("button", { name: "Transfer and sign out" }).click();
      await expect(page).toHaveURL(/\/login\?authority-transferred=1/);
    }
    await loginAs(page, "qa-super@example.test", password!);
    await expect(page).toHaveURL(/\/admin/);
    await transfer("QA Admin");
    await loginAs(page, "qa-super@example.test", password!);
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/admin/audit-logs");
    await expect(page.getByText(/Only the Super Admin can read audit events/i)).toBeVisible();
    await loginAs(page, "qa-admin@example.test", password!);
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/admin/audit-logs");
    await expect(page.getByText("Audit Activity", { exact: true })).toBeVisible();
    await transfer("QA Super Admin");
  });
});
