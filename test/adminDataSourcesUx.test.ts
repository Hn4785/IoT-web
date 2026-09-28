import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../src/pages/admin/ApiSources.tsx", import.meta.url), "utf8");
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
