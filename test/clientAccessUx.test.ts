import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboardTsx = readFileSync(
  new URL("../src/pages/developer/DeveloperDashboard.tsx", import.meta.url),
  "utf8",
);
const dashboardCss = readFileSync(
  new URL("../src/pages/developer/DeveloperDashboard.module.css", import.meta.url),
  "utf8",
);
const apiKeysTsx = readFileSync(
  new URL("../src/pages/developer/ApiKeys.tsx", import.meta.url),
  "utf8",
);
const apiKeysCss = readFileSync(
  new URL("../src/pages/developer/ApiKeys.module.css", import.meta.url),
  "utf8",
);
const permissionsTsx = readFileSync(
  new URL("../src/pages/developer/ApiPermissions.tsx", import.meta.url),
  "utf8",
);
const permissionsCss = readFileSync(
  new URL("../src/pages/developer/ApiPermissions.module.css", import.meta.url),
  "utf8",
);

const allPages = [
  { name: "DeveloperDashboard", tsx: dashboardTsx, css: dashboardCss },
  { name: "ApiKeys", tsx: apiKeysTsx, css: apiKeysCss },
  { name: "ApiPermissions", tsx: permissionsTsx, css: permissionsCss },
];

// ---------------------------------------------------------------------------
// 1. Content frame alignment (1440px centered frame, tokens, responsive)
// ---------------------------------------------------------------------------

test("all three developer pages use the established 1440px centered content frame", () => {
  for (const page of allPages) {
    assert.match(
      page.css,
      /width:\s*(?:100%|min\(100%,\s*1440px\))/,
      `${page.name} must have width: 100% or min(100%, 1440px)`,
    );
    assert.match(
      page.css,
      /max-width:\s*1440px/,
      `${page.name} must specify max-width: 1440px`,
    );
    assert.match(
      page.css,
      /margin-inline:\s*auto/,
      `${page.name} must center content with auto horizontal margins`,
    );
    assert.match(
      page.css,
      /padding:\s*var\(--spacing-6\)/,
      `${page.name} desktop padding must use var(--spacing-6)`,
    );
    assert.match(
      page.css,
      /box-sizing:\s*border-box/,
      `${page.name} must specify border-box sizing`,
    );
    assert.match(
      page.css,
      /@media[^{]*\b(?:700|768)px\b[^{]*\{[\s\S]*?\.page\s*\{[^}]*?padding:\s*var\(--spacing-4\)/,
      `${page.name} narrow-screen padding must use var(--spacing-4)`,
    );
  }
});

// ---------------------------------------------------------------------------
// 2. Truthful copy: remove all N/A occurrences
// ---------------------------------------------------------------------------

test("no page displays N/A; all absence copy is context-specific and truthful", () => {
  for (const page of allPages) {
    assert.doesNotMatch(
      page.tsx,
      /\bN\/A\b/,
      `${page.name} must not contain N/A`,
    );
  }

  // DeveloperDashboard specific truthful absence copy
  assert.match(dashboardTsx, /Unavailable|None/, "Highest rate limit fallback must be truthful");
  assert.match(dashboardTsx, /No health response/, "Health status fallback must be truthful");
  assert.match(dashboardTsx, /Not checked|Unavailable/, "Health time fallback must be truthful");

  // ApiPermissions specific truthful copy
  assert.match(permissionsTsx, /No key selected/, "Unselected key status must say No key selected");
});

// ---------------------------------------------------------------------------
// 3. API Permissions remains strictly read-only with non-interactive styling
// ---------------------------------------------------------------------------

test("API Permissions page removes pointer cursors from non-interactive rows", () => {
  // .permissionItem must not have cursor: pointer
  assert.doesNotMatch(
    permissionsCss,
    /\.permissionItem\s*\{[^}]*cursor:\s*pointer/,
    "permissionItem must not have pointer cursor",
  );
  // .station must not have cursor: pointer
  assert.doesNotMatch(
    permissionsCss,
    /\.station\s*\{[^}]*cursor:\s*pointer/,
    "station row must not have pointer cursor",
  );
  // Must not have write actions or edit buttons
  assert.doesNotMatch(permissionsTsx, /Save Permissions|Edit Permissions|saveButton.*onClick/);
});

const variablesCss = readFileSync(
  new URL("../src/styles/variables.css", import.meta.url),
  "utf8",
);
const declaredVariables = new Set(
  [...variablesCss.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)].map((m) => m[1]),
);

// ---------------------------------------------------------------------------
// 4. Design token usage, table scrolling, and keyboard focus
// ---------------------------------------------------------------------------

test("touched styles use existing design tokens and avoid undeclared tokens", () => {
  for (const page of allPages) {
    const usedVariables = [...page.css.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
    for (const variable of usedVariables) {
      assert.ok(
        declaredVariables.has(variable),
        `${page.name} uses undeclared CSS custom property "${variable}" not found in variables.css`,
      );
    }
  }

  // Tables have overflow-x: auto wrapper for safe horizontal scrolling
  assert.match(dashboardCss, /\.tableWrapper\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(apiKeysCss, /\.tableWrapper\s*\{[^}]*overflow-x:\s*auto/);

  // Controls provide visible keyboard focus
  for (const page of allPages) {
    assert.match(
      page.css,
      /:focus-visible/,
      `${page.name} must define visible keyboard focus with :focus-visible`,
    );
  }
});

test("ApiPermissions.module.css ends with a trailing newline", () => {
  assert.ok(permissionsCss.endsWith("\n"), "ApiPermissions.module.css must end with a trailing newline");
});

// ---------------------------------------------------------------------------
// 5. Preserves API key lifecycle and security semantics
// ---------------------------------------------------------------------------

test("API Keys preserves key management, one-time reveal, and fail-closed state", () => {
  // Backend service calls preserved
  assert.match(apiKeysTsx, /apiKeyService\.create/);
  assert.match(apiKeysTsx, /apiKeyService\.rotate/);
  assert.match(apiKeysTsx, /apiKeyService\.revoke/);
  assert.match(apiKeysTsx, /apiKeyService\.listAvailableStations/);

  // One-time secret copy and security warning
  assert.match(apiKeysTsx, /copyText/);
  assert.match(apiKeysTsx, /generatedSecret/);
  assert.match(apiKeysTsx, /Store this secret securely|Copy it now/);

  // Retry mechanisms preserved
  assert.match(apiKeysTsx, /loadData\(\)/);
  assert.match(dashboardTsx, /load\(\)/);
  assert.match(permissionsTsx, /load\(\)/);
});
