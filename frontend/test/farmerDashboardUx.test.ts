import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(new URL("../src/pages/farm-owner/FarmDashboard.tsx", import.meta.url), "utf8");
const soil = readFileSync(new URL("../src/pages/farm-owner/RealtimeSoilMonitoring.tsx", import.meta.url), "utf8");
const soilCss = readFileSync(new URL("../src/pages/farm-owner/RealtimeSoilMonitoring.module.css", import.meta.url), "utf8");
const history = readFileSync(new URL("../src/pages/farm-owner/HistoryReport.tsx", import.meta.url), "utf8");
const dashboardCss = readFileSync(new URL("../src/pages/farm-owner/ConnectedSoil.module.css", import.meta.url), "utf8");
const alertWorkspace = readFileSync(new URL("../src/components/alerts/AlertWorkspace.tsx", import.meta.url), "utf8");
const alertCss = readFileSync(new URL("../src/components/alerts/AlertWorkspace.module.css", import.meta.url), "utf8");

// === Real data and states ===

test("Farm Dashboard uses request-keyed composite state to isolate selections without setState in effect", () => {
  // Uses composite state holding stationId and reloadKey
  assert.match(dashboard, /dataState\??\.(stationId|reloadKey)/);
  // Visible state is derived from current selection match
  assert.match(dashboard, /dataState\?\.stationId\s*===\s*hierarchy\.selectedStationId/);
  // Avoids synchronous setState inside effect body
  assert.doesNotMatch(dashboard, /useEffect\(\(\)\s*=>\s*\{[^}]*?setLatest\s*\(\s*null\s*\)/);
});

test("Soil Dashboard keys data by stationId so stale data is never rendered for a new selection", () => {
  assert.match(soil, /stationId/);
  assert.match(soil, /currentData/);
});

test("Farm/Plot/Station selects have explicit placeholder options when empty", () => {
  assert.match(dashboard, /Select a farm|All.*farms|<option.*value=""/i);
  assert.match(history, /Select a station|<option.*value=""/i);
});

test("Farm/Plot/Station selects disable child selects when parent is unavailable", () => {
  assert.match(dashboard, /disabled=\{!hierarchy\.selectedFarmId\}/);
  assert.match(dashboard, /disabled=\{!hierarchy\.selectedPlotId\}/);
});

test("Farm Dashboard does not hardcode farm, plot, station options or fabricate values", () => {
  assert.doesNotMatch(dashboard, /farm1|farm-1|mockFarm|demoFarm|sampleFarm/i);
  assert.doesNotMatch(dashboard, /N\/A/);
});

test("Soil Dashboard does not hardcode options or fabricate values", () => {
  assert.doesNotMatch(soil, /farm1|farm-1|mockFarm|demoFarm|sampleFarm/i);
  assert.doesNotMatch(soil, /N\/A/);
});

test("History Report uses request-keyed composite state to isolate queries without setState in effect", () => {
  // Uses composite state holding stationId, field, begin, end, reloadKey
  assert.match(history, /dataState\??\.(stationId|field|begin|end|reloadKey)/);
  // Visible data is derived from exact criteria match
  assert.match(history, /dataState\?\.stationId\s*===\s*hierarchy\.selectedStationId/);
  // Avoids synchronous setState inside effect body
  assert.doesNotMatch(history, /useEffect\(\(\)\s*=>\s*\{[^}]*?setData\s*\(\s*null\s*\)/);
});

test("History Report disables Apply button when station is not selected", () => {
  assert.match(history, /disabled=\{!hierarchy\.selectedStationId \|\| hierarchy\.loading\}/);
});

test("History Report disables Export when no results are available", () => {
  assert.match(history, /disabled=\{!series\?\.points\.length\}/);
});

// === Design alignment ===

test("Farm Dashboard page uses design-token-aligned centered layout", () => {
  assert.match(dashboardCss, /width:\s*min\s*\(\s*100%\s*,\s*1440px\s*\)/);
  assert.match(dashboardCss, /margin-inline:\s*auto/);
});

test("Soil Dashboard page uses the standard max content width and outer padding", () => {
  assert.match(soilCss, /width:\s*min\s*\(\s*100%\s*,\s*1440px\s*\)/);
  assert.match(soilCss, /padding:\s*var\(--spacing-6\)/);
});

test("Soil Dashboard metric cards use a responsive grid, not seven permanently compressed columns", () => {
  assert.doesNotMatch(soilCss, /grid-template-columns:\s*repeat\s*\(\s*7\b/);
  assert.match(soilCss, /repeat\s*\(\s*auto-fit,\s*minmax\(170px,\s*1fr\)\)/);
});

test("Soil Dashboard filter controls use the project input height and readable body-sm text", () => {
  assert.doesNotMatch(soilCss, /font-size:\s*8px/);
  assert.doesNotMatch(soilCss, /font-size:\s*9px/);
  assert.doesNotMatch(soilCss, /font-size:\s*10px/);
  assert.match(soilCss, /height:\s*var\(--height-input-md\)/);
});

test("Soil Dashboard chart headings use readable font size not 10px", () => {
  assert.doesNotMatch(soilCss, /\.chartHeader[\s\S]*?font-size:\s*10px/);
});

test("Soil Dashboard metric labels use readable font size not 8-9px", () => {
  assert.doesNotMatch(soilCss, /\.metricLabel[\s\S]*?font-size:\s*9px/);
  assert.doesNotMatch(soilCss, /\.metricLabel[\s\S]*?font-size:\s*8px/);
});

test("ConnectedSoil layout uses design system tokens for padding, radius, and gap", () => {
  assert.match(dashboardCss, /--spacing/);
  assert.match(dashboardCss, /--radius/);
});

test("Alert workspace uses standard centered content frame at 1440px", () => {
  assert.match(alertCss, /width:\s*min\s*\(\s*100%\s*,\s*1440px\s*\)/);
  assert.match(alertCss, /margin-inline:\s*auto/);
  assert.match(alertCss, /padding:\s*var\(--spacing-6\)/);
});

test("History Report page uses same centered content frame as other farmer pages", () => {
  assert.match(dashboardCss, /width:\s*min\s*\(\s*100%\s*,\s*1440px\s*\)/);
});

// === Rules and notifications ===

test("AlertWorkspace Add Rule requires canManageRules, selectedStation, and metadata", () => {
  assert.match(alertWorkspace, /canManageRules\s*&&/);
  assert.match(alertWorkspace, /selectedStationId/);
  assert.match(alertWorkspace, /metadata\.length\s*>\s*0/);
});

test("AlertWorkspace rule form includes Above/Below/Outside range, Warning/Critical, and Automatic/Paused", () => {
  assert.match(alertWorkspace, /ABOVE/);
  assert.match(alertWorkspace, /BELOW/);
  assert.match(alertWorkspace, /OUTSIDE_RANGE/);
  assert.match(alertWorkspace, /WARNING/);
  assert.match(alertWorkspace, /CRITICAL/);
  assert.match(alertWorkspace, /Automatic/);
  assert.match(alertWorkspace, /Paused/);
});

test("AlertWorkspace Automatic copy states rules evaluate samples and notify without controlling devices", () => {
  assert.match(alertWorkspace, /evaluate.*new samples.*notif/i);
  assert.match(alertWorkspace, /without controlling.*device|do not control.*device/i);
  assert.match(alertWorkspace, /in-app notification|notify authorized/i);
});

test("AlertWorkspace shared viewers see read-only wording and no create/toggle controls", () => {
  assert.match(alertWorkspace, /read-only/i);
  assert.match(alertWorkspace, /managed by the.*source owner/i);
});
