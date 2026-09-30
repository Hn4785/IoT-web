import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { findActiveNavigationPath } from "../src/components/layout/sidebarSelection.ts";

// ---------------------------------------------------------------------------
// 1. Sidebar shows the four approved CLIENT_DEVELOPER destinations
// ---------------------------------------------------------------------------

test("client developer sidebar contains Dashboard, API Access, API Tools, and Settings", () => {
  const source = readFileSync(
    new URL("../src/components/layout/Sidebar.tsx", import.meta.url),
    "utf8",
  );

  // Must contain these four items
  assert.match(source, /label:\s*['"]Dashboard['"]/);
  assert.match(source, /label:\s*['"]API Access['"]/);
  assert.match(source, /label:\s*['"]API Tools['"]/);

  // Must NOT contain old separate items or metrics in CLIENT_DEVELOPER nav
  // Extract the CLIENT_DEVELOPER config block
  const devStart = source.indexOf("CLIENT_DEVELOPER");
  assert.notEqual(devStart, -1, "CLIENT_DEVELOPER config must exist");
  const devBlock = source.slice(devStart, source.indexOf("};", devStart));

  assert.doesNotMatch(devBlock, /label:\s*['"]API Keys['"]/);
  assert.doesNotMatch(devBlock, /label:\s*['"]API Permissions['"]/);
  assert.doesNotMatch(devBlock, /label:\s*['"]API Docs['"]/);
  assert.doesNotMatch(devBlock, /label:\s*['"]API Explorer['"]/);
  assert.doesNotMatch(devBlock, /label:\s*['"]API Metrics['"]/);
  assert.match(devBlock, /label:\s*['"]Settings['"],\s*path:\s*['"]\/change-password['"],\s*icon:\s*Settings/);
});

test("client developer sidebar does not use Settings icon for API Access", () => {
  const source = readFileSync(
    new URL("../src/components/layout/Sidebar.tsx", import.meta.url),
    "utf8",
  );

  const devStart = source.indexOf("CLIENT_DEVELOPER");
  const devEnd = source.indexOf("};", devStart);
  const devBlock = source.slice(devStart, devEnd);

  // API Access must exist
  assert.match(devBlock, /API Access/);
  // API Access entry should not use Settings icon
  assert.doesNotMatch(devBlock, /API Access['"],\s*path:[^}]*icon:\s*Settings/);
});

test("change password copy distinguishes forced and voluntary changes", () => {
  const source = readFileSync(
    new URL("../src/pages/auth/ChangePassword.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /requiresPasswordChange\(user\)/);
  assert.match(source, /update your password to secure your account and unlock/);
  assert.match(source, /Update your password to keep your AgriSense account secure/);
});

// ---------------------------------------------------------------------------
// 2. Canonical routes exist with CLIENT_DEVELOPER guard
// ---------------------------------------------------------------------------

test("canonical API Access routes are defined with CLIENT_DEVELOPER role", () => {
  const source = readFileSync(
    new URL("../src/routes/routeConfig.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /path:\s*["']\/developer\/api-access\/keys["']/);
  assert.match(source, /path:\s*["']\/developer\/api-access\/scope["']/);
  assert.match(source, /path:\s*["']\/developer\/api-tools\/docs["']/);
  assert.match(source, /path:\s*["']\/developer\/api-tools\/explorer["']/);
});

test("developer section roots redirect to their default tabs and remain guarded", () => {
  const source = readFileSync(
    new URL("../src/routes/routeConfig.tsx", import.meta.url),
    "utf8",
  );
  const lines = source.split("\n");

  for (const [sectionPath, defaultPath] of [
    ["/developer/api-access", "/developer/api-access/keys"],
    ["/developer/api-tools", "/developer/api-tools/docs"],
  ]) {
    const index = lines.findIndex((line: string) =>
      line.includes(`"${sectionPath}"`),
    );
    assert.notEqual(index, -1, `${sectionPath} must exist`);
    const context = lines.slice(index, index + 6).join("\n");
    assert.match(context, /CLIENT_DEVELOPER/);
    assert.match(context, new RegExp(`Navigate to="${defaultPath}" replace`));
  }
});

// ---------------------------------------------------------------------------
// 3. Legacy routes redirect to canonical routes
// ---------------------------------------------------------------------------

test("legacy developer routes redirect to canonical paths", () => {
  const source = readFileSync(
    new URL("../src/routes/routeConfig.tsx", import.meta.url),
    "utf8",
  );

  // Legacy /developer/api-keys -> /developer/api-access/keys
  assert.match(source, /\/developer\/api-keys/);
  assert.match(source, /\/developer\/api-access\/keys/);

  // Legacy /developer/api-permissions -> /developer/api-access/scope
  assert.match(source, /\/developer\/api-permissions/);
  assert.match(source, /\/developer\/api-access\/scope/);

  // Legacy /developer/api-docs -> /developer/api-tools/docs
  assert.match(source, /\/developer\/api-docs/);
  assert.match(source, /\/developer\/api-tools\/docs/);

  // Legacy /developer/api-explorer -> /developer/api-tools/explorer
  assert.match(source, /\/developer\/api-explorer/);
  assert.match(source, /\/developer\/api-tools\/explorer/);

  // All legacy routes use Navigate with replace
  assert.match(source, /Navigate to="\/developer\/api-access\/keys" replace/);
  assert.match(source, /Navigate to="\/developer\/api-access\/scope" replace/);
  assert.match(source, /Navigate to="\/developer\/api-tools\/docs" replace/);
  assert.match(source, /Navigate to="\/developer\/api-tools\/explorer" replace/);
});

test("legacy redirects are guarded by CLIENT_DEVELOPER role", () => {
  const source = readFileSync(
    new URL("../src/routes/routeConfig.tsx", import.meta.url),
    "utf8",
  );

  // Each legacy redirect route must have CLIENT_DEVELOPER role
  const lines = source.split("\n");
  for (const legacyPath of [
    "/developer/api-keys",
    "/developer/api-permissions",
    "/developer/api-docs",
    "/developer/api-explorer",
  ]) {
    const idx = lines.findIndex((l: string) => l.includes(`"${legacyPath}"`) || l.includes(`'${legacyPath}'`));
    assert.notEqual(idx, -1, `Legacy route ${legacyPath} must exist`);
    // Within 5 lines there should be CLIENT_DEVELOPER
    const context = lines.slice(Math.max(0, idx - 3), idx + 5).join("\n");
    assert.match(context, /CLIENT_DEVELOPER/, `${legacyPath} must be guarded by CLIENT_DEVELOPER`);
  }
});

// ---------------------------------------------------------------------------
// 4. API Metrics hidden from nav but route still exists
// ---------------------------------------------------------------------------

test("api-metrics route exists but is not in sidebar navigation", () => {
  const routeSource = readFileSync(
    new URL("../src/routes/routeConfig.tsx", import.meta.url),
    "utf8",
  );
  const sidebarSource = readFileSync(
    new URL("../src/components/layout/Sidebar.tsx", import.meta.url),
    "utf8",
  );

  // Route still exists
  assert.match(routeSource, /\/developer\/api-metrics/);

  // But not in CLIENT_DEVELOPER sidebar
  const devStart = sidebarSource.indexOf("CLIENT_DEVELOPER");
  const devBlock = sidebarSource.slice(devStart, sidebarSource.indexOf("};", devStart));
  assert.doesNotMatch(devBlock, /api-metrics/);
});

// ---------------------------------------------------------------------------
// 5. Breadcrumb labels cover new segments
// ---------------------------------------------------------------------------

test("breadcrumb has labels for api-access, scope, api-tools, docs, explorer", () => {
  const source = readFileSync(
    new URL("../src/components/layout/Breadcrumb.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /['"]api-access['"]\s*:/);
  assert.match(source, /['"]scope['"]\s*:/);
  assert.match(source, /['"]api-tools['"]\s*:/);
  assert.match(source, /['"]docs['"]\s*:/);
  assert.match(source, /['"]explorer['"]\s*:/);
});

// ---------------------------------------------------------------------------
// 6. Sidebar active state for nested API Access/Tools routes
// ---------------------------------------------------------------------------

test("sidebar highlights API Access for /developer/api-access/keys", () => {
  const paths = [
    "/developer/dashboard",
    "/developer/api-access",
    "/developer/api-tools",
  ];

  assert.equal(
    findActiveNavigationPath(paths, "/developer/api-access/keys"),
    "/developer/api-access",
  );
  assert.equal(
    findActiveNavigationPath(paths, "/developer/api-access/scope"),
    "/developer/api-access",
  );
});

test("sidebar highlights API Tools for /developer/api-tools/docs", () => {
  const paths = [
    "/developer/dashboard",
    "/developer/api-access",
    "/developer/api-tools",
  ];

  assert.equal(
    findActiveNavigationPath(paths, "/developer/api-tools/docs"),
    "/developer/api-tools",
  );
  assert.equal(
    findActiveNavigationPath(paths, "/developer/api-tools/explorer"),
    "/developer/api-tools",
  );
});

// ---------------------------------------------------------------------------
// 7. DeveloperSectionTabs component exists
// ---------------------------------------------------------------------------

test("DeveloperSectionTabs component exists and uses link-based tabs", () => {
  const source = readFileSync(
    new URL("../src/components/developer/DeveloperSectionTabs.tsx", import.meta.url),
    "utf8",
  );

  // Must use Link from react-router-dom for shareable URLs
  assert.match(source, /from\s+["']react-router-dom["']/);
  // Must have aria-label for accessibility
  assert.match(source, /aria-label/);
  // Must render a nav element
  assert.match(source, /<nav/);
});

// ---------------------------------------------------------------------------
// 8. Pages import and render DeveloperSectionTabs
// ---------------------------------------------------------------------------

test("API Keys page imports DeveloperSectionTabs", () => {
  const source = readFileSync(
    new URL("../src/pages/developer/ApiKeys.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /DeveloperSectionTabs/);
});

test("API Permissions page imports DeveloperSectionTabs", () => {
  const source = readFileSync(
    new URL("../src/pages/developer/ApiPermissions.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /DeveloperSectionTabs/);
});

test("API Docs page imports DeveloperSectionTabs", () => {
  const source = readFileSync(
    new URL("../src/pages/developer/ApiDocs.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /DeveloperSectionTabs/);
});

test("API Explorer page imports DeveloperSectionTabs", () => {
  const source = readFileSync(
    new URL("../src/pages/developer/ApiExplorer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /DeveloperSectionTabs/);
});
