import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { findActiveNavigationPath } from "../src/components/layout/sidebarSelection.ts";
import { formatVietnamDateTime } from "../src/utils/formatDateTime.ts";
import { isInteractiveApiReferenceAvailable } from "../src/utils/apiDocsAvailability.ts";

test("sidebar highlights only the most specific matching navigation item", () => {
  const paths = ["/admin", "/admin/users", "/admin/audit-logs"];

  assert.equal(
    findActiveNavigationPath(paths, "/admin/audit-logs"),
    "/admin/audit-logs",
  );
  assert.equal(
    findActiveNavigationPath(paths, "/admin/users/user-1"),
    "/admin/users",
  );
  assert.equal(findActiveNavigationPath(paths, "/admin"), "/admin");
});

test("audit timestamps are displayed in Vietnam time instead of raw ISO", () => {
  assert.equal(
    formatVietnamDateTime("2026-08-30T16:42:11Z"),
    "23:42 30/08/2026",
  );
  assert.equal(formatVietnamDateTime("not-a-date"), "—");
});

test("interactive API reference is hidden from production builds", () => {
  assert.equal(isInteractiveApiReferenceAvailable(true), false);
  assert.equal(isInteractiveApiReferenceAvailable(false), true);

  const source = readFileSync(
    new URL("../src/pages/developer/ApiDocs.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /http:\/\/localhost:3000\/docs/);
  assert.match(source, /isInteractiveApiReferenceAvailable/);
});

test("login identifies the deployed v2.5 release", () => {
  const source = readFileSync(
    new URL("../src/pages/auth/Login.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Monitoring Node System v2\.5\.5/);
  assert.doesNotMatch(source, /Monitoring Node System v2\.4/);
});

test("developer portal fails closed instead of presenting fabricated production analytics", () => {
  const dashboard = readFileSync(
    new URL("../src/pages/developer/DeveloperDashboard.tsx", import.meta.url),
    "utf8",
  );
  const metrics = readFileSync(
    new URL("../src/pages/developer/ApiMetrics.tsx", import.meta.url),
    "utf8",
  );
  const permissions = readFileSync(
    new URL("../src/pages/developer/ApiPermissions.tsx", import.meta.url),
    "utf8",
  );
  const explorer = readFileSync(
    new URL("../src/pages/developer/ApiExplorer.tsx", import.meta.url),
    "utf8",
  );

  assert.match(dashboard, /summarizeDeveloperAccess/);
  assert.doesNotMatch(dashboard, /18,426|482,913|99\.99%/);
  assert.match(metrics, /Backend contract not available/);
  assert.doesNotMatch(metrics, /requestLogs|98\.76%|18,198/);
  assert.match(permissions, /getGrantedKeyStations/);
  assert.doesNotMatch(permissions, /Save Permissions/);
  assert.match(explorer, /createDeveloperExplorerService/);
});

test("production API calls default to the same origin proxy", () => {
  const source = readFileSync(
    new URL("../src/config/env.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /VITE_API_BASE_URL \|\| "\/api\/v1"/);
  assert.doesNotMatch(source, /localhost:3000/);
});

test("soil dashboard does not advertise unsupported depth data", () => {
  const source = readFileSync(
    new URL("../src/pages/farm-owner/RealtimeSoilMonitoring.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /Depth:/);
  assert.doesNotMatch(source, /currentDepth/);
});

test("date range actions stay inside a bounded popover", () => {
  const source = readFileSync(
    new URL("../src/components/common/DateRangePicker.module.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /right:\s*0/);
  assert.match(source, /max-height:/);
  assert.match(source, /overflow-y:\s*auto/);
});

test("admin dashboard uses backend services instead of empty mock data", () => {
  const source = readFileSync(
    new URL("../src/pages/admin/AdminDashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /stationBrowserService/);
  assert.match(source, /userService/);
  assert.doesNotMatch(source, /from "@\/data\/farms"/);
  assert.doesNotMatch(source, /Healthy station percentage/);
  assert.doesNotMatch(source, />95%</);
  assert.doesNotMatch(source, /Total Gateways/);
  assert.doesNotMatch(source, /Total Sensors/);
});
