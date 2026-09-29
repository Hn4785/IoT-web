import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../src/pages/admin/ApiSources.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/pages/admin/AdminDashboard.tsx", import.meta.url), "utf8");
const users = readFileSync(new URL("../src/pages/admin/UserManagement.tsx", import.meta.url), "utf8");
const alerts = readFileSync(new URL("../src/components/alerts/AlertWorkspace.tsx", import.meta.url), "utf8");
const adminPageStyles = [
  "../src/pages/admin/AdminDashboard.module.css",
  "../src/pages/admin/AdminStationBrowser.module.css",
  "../src/pages/admin/ApiSources.module.css",
  "../src/components/alerts/AlertWorkspace.module.css",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
const sidebar = readFileSync(new URL("../src/components/layout/Sidebar.tsx", import.meta.url), "utf8");

test("Admin API Sources exposes truthful inventory, owner-only controls and no N/A copy", () => {
  assert.match(sidebar, /API Sources/);
  assert.doesNotMatch(sidebar, /label: ["']Device Health["']/);
  assert.doesNotMatch(sidebar, /label: ["']Config Proposals["']/);
  assert.doesNotMatch(sidebar, /label: ["']IoT Config["']/);
  assert.match(page, /Visible Accounts/);
  assert.match(page, /canManageAccess/);
  assert.match(page, /canRevealKey/);
  assert.match(page, /No API sources/);
  assert.match(page, /Last check failed/);
  assert.doesNotMatch(page, />Connection failed</);
  assert.doesNotMatch(page, /N\/A/);
});

test("connection secrets are cleared when the add dialog closes", () => {
  assert.match(page, /setXApiKey\(""\)/);
  assert.doesNotMatch(page, /Paste connection details|Fill Fields|setPastedDetails/);
  assert.match(page, /currentPassword/);
});

test("source creation supports select-or-create hierarchy and station-scoped sharing", () => {
  assert.match(page, /farmName/);
  assert.match(page, /plotName/);
  assert.match(page, /stationIds/);
  assert.match(page, /setGrantStations/);
  assert.match(page, /Remove Source/);
});

test("Admin dashboard omits unsupported hardware inventory", () => {
  assert.doesNotMatch(dashboard, /["']N\/A["']/);
  assert.doesNotMatch(dashboard, /Not supported/);
  assert.doesNotMatch(dashboard, /Total Gateways|Total Sensors/);
  assert.doesNotMatch(dashboard, /Operational Health/);
});

test("Admin account editing is role-focused and source access is read only", () => {
  assert.match(users, /Shared access/);
  assert.match(users, /Source access is managed from API Sources/);
  assert.match(users, /Delete Account/);
  assert.doesNotMatch(users, /UserScopeEditor/);
});

test("alert rules are created from confirmed station metadata", () => {
  assert.match(alerts, /getFieldMetadata/);
  assert.match(alerts, /expectedMetadataRevision/);
  assert.match(alerts, /Add Rule/);
  assert.match(alerts, /Enable now/);
  assert.match(alerts, /notify authorized accounts/);
  assert.match(alerts, /notifications paused/);
  assert.doesNotMatch(alerts, /Rule creation stays disabled/);
});

test("Admin operational pages share the same centered content frame", () => {
  for (const css of adminPageStyles) {
    assert.match(css, /width:\s*min\(100%,\s*1440px\)/);
    assert.match(css, /margin-inline:\s*auto/);
    assert.match(css, /padding:\s*var\(--spacing-6\)/);
    assert.match(css, /box-sizing:\s*border-box/);
  }
});
