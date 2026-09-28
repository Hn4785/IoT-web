import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../src/pages/admin/ApiSources.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/pages/admin/AdminDashboard.tsx", import.meta.url), "utf8");
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
  assert.doesNotMatch(page, /N\/A/);
});

test("connection secrets are cleared when the add dialog closes", () => {
  assert.match(page, /setXApiKey\(""\)/);
  assert.match(page, /setPastedDetails\(""\)/);
  assert.match(page, /currentPassword/);
});

test("Admin dashboard describes unsupported inventory without N/A", () => {
  assert.doesNotMatch(dashboard, /["']N\/A["']/);
  assert.match(dashboard, /Not supported/);
});

test("Admin operational pages share the same centered content frame", () => {
  for (const css of adminPageStyles) {
    assert.match(css, /width:\s*min\(100%,\s*1280px\)/);
    assert.match(css, /margin-inline:\s*auto/);
    assert.match(css, /padding:\s*var\(--spacing-6\)/);
    assert.match(css, /box-sizing:\s*border-box/);
  }
});
