import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sidebar = readFileSync(new URL("../src/components/layout/Sidebar.tsx", import.meta.url), "utf8");
const routeConfig = readFileSync(new URL("../src/routes/routeConfig.tsx", import.meta.url), "utf8");
const routeComponents = readFileSync(new URL("../src/routes/routeComponents.tsx", import.meta.url), "utf8");

test("Farmer navigation and routing expose API Sources with FARMER role protection", () => {
  assert.match(sidebar, /path:\s*['"]\/farm-owner\/api-sources['"]/);
  assert.match(sidebar, /label:\s*['"]API Sources['"]/);
  assert.match(routeConfig, /path:\s*['"]\/farm-owner\/api-sources['"]/);
  assert.match(routeConfig, /roles:\s*\[['"]FARMER['"]\]/);
  assert.match(routeComponents, /FarmerApiSources/);
  assert.match(routeComponents, /import\(["']@\/pages\/farm-owner\/ApiSources["']\)/);
});

test("Farmer API Sources page presents owned and shared sources, owner actions, and truthful copy without N/A", () => {
  const page = readFileSync(new URL("../src/pages/farm-owner/ApiSources.tsx", import.meta.url), "utf8");
  assert.match(page, /Visible Accounts/);
  assert.match(page, /canManageAccess/);
  assert.match(page, /canRevealKey/);
  assert.match(page, /No API sources/);
  assert.match(page, /Last check failed/);
  assert.doesNotMatch(page, />Connection failed</);
  assert.doesNotMatch(page, /N\/A/);

  // View Data navigates to Farmer soil monitoring
  assert.match(page, /\/farm-owner\/soil-dashboard/);

  // Owned actions
  assert.match(page, /Manage Access/);
  assert.match(page, /Test/);
  assert.match(page, /Reveal Key/);
  assert.match(page, /Remove Source/);
  assert.match(page, /currentPassword/);
  assert.match(page, /setGrantStations/);
});

test("Farmer source creation supports explicit fields without paste or curl parsing", () => {
  const page = readFileSync(new URL("../src/pages/farm-owner/ApiSources.tsx", import.meta.url), "utf8");
  assert.match(page, /farmName/);
  assert.match(page, /plotName/);
  assert.match(page, /baseUrl/);
  assert.match(page, /xApiKey/);
  assert.match(page, /setXApiKey\(""\)/);
  assert.doesNotMatch(page, /Paste connection details|Fill Fields|setPastedDetails/);
});

test("Farmer API Sources page follows the standard centered content frame and design system", () => {
  const pageCss = readFileSync(new URL("../src/pages/farm-owner/ApiSources.module.css", import.meta.url), "utf8");
  assert.match(pageCss, /width:\s*min\(100%,\s*1440px\)/);
  assert.match(pageCss, /margin-inline:\s*auto/);
  assert.match(pageCss, /padding:\s*var\(--spacing-6\)/);
  assert.match(pageCss, /box-sizing:\s*border-box/);
});

test("Farmer API Sources Manage Access uses grant-candidates instead of userService or admin routes", () => {
  const page = readFileSync(new URL("../src/pages/farm-owner/ApiSources.tsx", import.meta.url), "utf8");
  assert.match(page, /listGrantCandidates/);
  assert.doesNotMatch(page, /userService/);
  assert.doesNotMatch(page, /\/admin\/users/);
});
