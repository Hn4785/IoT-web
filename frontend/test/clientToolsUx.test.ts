import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const docsTsx = readFileSync(new URL("../src/pages/developer/ApiDocs.tsx", import.meta.url), "utf8");
const docsCss = readFileSync(new URL("../src/pages/developer/ApiDocs.module.css", import.meta.url), "utf8");
const explorerTsx = readFileSync(new URL("../src/pages/developer/ApiExplorer.tsx", import.meta.url), "utf8");
const explorerCss = readFileSync(new URL("../src/pages/developer/ApiExplorer.module.css", import.meta.url), "utf8");
const variablesCss = readFileSync(new URL("../src/styles/variables.css", import.meta.url), "utf8");

test("both developer tool pages use the established 1440px centered content frame", () => {
  for (const { name, css } of [{ name: "ApiDocs", css: docsCss }, { name: "ApiExplorer", css: explorerCss }]) {
    assert.match(css, /width:\s*(?:100%|min\(100%,\s*1440px\))/, `${name} must have width: 100% or min(100%, 1440px)`);
    assert.match(css, /max-width:\s*1440px/, `${name} must specify max-width: 1440px`);
    assert.match(css, /margin-inline:\s*auto/, `${name} must center content with auto horizontal margins`);
    assert.match(css, /padding:\s*var\(--spacing-6\)/, `${name} desktop padding must use var(--spacing-6)`);
    assert.match(css, /box-sizing:\s*border-box/, `${name} must specify border-box sizing`);
    assert.match(css, /@media[^{]*\b(?:700|768)px\b[^{]*\{[\s\S]*?\.page\s*\{[^}]*?padding:\s*var\(--spacing-4\)/, `${name} narrow-screen padding must use var(--spacing-4)`);
  }
});

test("explorer starts and resets with an empty station and safe placeholder", () => {
  assert.doesNotMatch(explorerTsx, /NODE01/, "Explorer must not contain hard-coded NODE01 station identifier");
  assert.match(explorerTsx, /station:\s*""/, "Initial station must be empty string");
  assert.match(explorerTsx, /placeholder="Enter station code"/, "Station input placeholder must prompt for code entry");
});

test("API key stays strictly in React memory and is never persisted", () => {
  assert.match(explorerTsx, /type="password"/, "API key input must be password masked");
  assert.match(explorerTsx, /autoComplete="off"/, "API key input must disable autocomplete");
  assert.match(explorerTsx, /setApiKey\(""\)/, "Reset must clear the API key in memory");
  assert.doesNotMatch(explorerTsx, /localStorage|sessionStorage/, "API key must not be persisted in storage");
});

test("documentation and explorer contain no N/A and remain truthful", () => {
  assert.doesNotMatch(docsTsx, /\bN\/A\b/, "ApiDocs must not contain N/A");
  assert.doesNotMatch(explorerTsx, /\bN\/A\b/, "ApiExplorer must not contain N/A");
  assert.doesNotMatch(docsTsx, /\bdemo (?:farm|plot)\b/i, "ApiDocs must not advertise demo data");
});

test("all CSS custom properties referenced in tool pages are declared in variables.css", () => {
  const declaredTokens = new Set(Array.from(variablesCss.matchAll(/(--[a-zA-Z0-9-]+):/g), (m) => m[1]));
  for (const { name, css } of [{ name: "ApiDocs", css: docsCss }, { name: "ApiExplorer", css: explorerCss }]) {
    const usedTokens = Array.from(css.matchAll(/var\((--[a-zA-Z0-9-]+)\)/g), (m) => m[1]);
    for (const token of usedTokens) {
      assert.ok(declaredTokens.has(token), `${name} uses undeclared CSS token: ${token}`);
    }
  }
});

test("explorer inputs use project token height and body typography, and controls retain focus-visible styles", () => {
  assert.match(explorerCss, /height:\s*var\(--height-input-md\)/, "Inputs must use --height-input-md");
  assert.match(explorerCss, /font-size:\s*var\(--font-size-body\)/, "Inputs must use readable body font size");
  assert.match(explorerCss, /:focus-visible\s*\{[^}]*outline:/, "Explorer controls must retain visible focus-visible outline");
  assert.match(docsCss, /:focus-visible\s*\{[^}]*outline:/, "Docs interactive elements must retain visible focus-visible outline");
});

test("explorer preserves validation, response envelope, headers and cursor paging", () => {
  assert.match(explorerTsx, /buildExplorerRequest/, "Explorer must use buildExplorerRequest");
  assert.match(explorerTsx, /createDeveloperExplorerService/, "Explorer must use developerExplorerService");
  assert.match(explorerTsx, /nextExplorerRequest/, "Explorer must handle cursor pagination");
  assert.match(explorerTsx, /CLIENT_VALIDATION/, "Explorer must distinguish client validation failures");
  assert.match(explorerTsx, /Load next page/, "Explorer must offer next-page pagination trigger");
});
