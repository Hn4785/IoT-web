import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("notification inbox uses standard 1440px frame and responsive spacing tokens", () => {
  const css = fs.readFileSync("src/pages/farm-owner/NotificationInbox.module.css", "utf-8");
  assert.ok(css.includes("1440px"), "Should constrain width to 1440px");
  assert.ok(css.includes("var(--spacing-6)"), "Desktop uses spacing tokens");
  assert.ok(css.includes("var(--spacing-4)"), "Mobile uses spacing tokens");
});

test("notification inbox toolbar, empty state, and labels satisfy accessibility and honest wording", () => {
  const tsx = fs.readFileSync("src/pages/farm-owner/NotificationSettings.tsx", "utf-8");

  // Filter aria-pressed
  assert.ok(tsx.includes("aria-pressed"), "Filters should include aria-pressed");

  // Empty state with Bell icon, clear heading and truthful explanation
  assert.ok(tsx.includes("<Bell"), "Empty state should render Bell icon");
  assert.ok(
    tsx.includes("No unread notifications") || tsx.includes("Inbox is empty"),
    "Empty state should have clear heading",
  );

  // Textual distinction for read and severity
  assert.ok(
    tsx.includes("Unread") && tsx.includes("Read"),
    "Read/unread should have visible textual distinctions",
  );
  assert.ok(
    tsx.includes("Critical") && tsx.includes("Warning"),
    "Severity should have visible text labels",
  );

  // Simplified footer note without internal contract wording
  assert.ok(
    !tsx.includes("backend in-app notification contract"),
    "Should remove internal backend-contract wording from footer",
  );
  assert.ok(
    tsx.includes("in-app") || tsx.includes("In-app"),
    "Footer should explain in-app delivery honestly",
  );
});

test("notification inbox displays unable-to-load explanation when initial fetch fails", () => {
  const tsx = fs.readFileSync("src/pages/farm-owner/NotificationSettings.tsx", "utf-8");

  // When error && items.length === 0, renders Unable to load notifications and Refresh guidance
  assert.ok(
    tsx.includes("error && items.length === 0"),
    "Should condition empty error on error and empty items",
  );
  assert.ok(
    tsx.includes("Unable to load notifications"),
    "Should explain load failure truthfully",
  );
  assert.ok(
    tsx.includes("Refresh"),
    "Should guide user to refresh on failure",
  );
});

test("LineChart wiring filters finite values, uses accessible group, gates showTooltip, and renders unit", () => {
  const tsx = fs.readFileSync("src/components/charts/LineChart.tsx", "utf-8");
  assert.ok(tsx.includes("const activeTooltip ="), "A stale point index must be guarded after a data update");
  assert.ok(tsx.includes("if (pt.y === null) return null"), "Missing or invalid point geometry must not be rendered");

  // Finite value filtering prevents NaN poisoning
  assert.ok(
    tsx.includes("Number.isFinite(value)"),
    "LineChart must filter Number.isFinite before domain computation",
  );

  // SVG group accessibility
  assert.ok(
    tsx.includes("<g role=\"group\" aria-label={ariaLabel}>"),
    "Interactive chart must use role=group with aria-label rather than role=img on svg",
  );

  // showTooltip gating on tabIndex, role, and handlers
  assert.ok(
    tsx.includes("tabIndex={showTooltip ? 0 : undefined}"),
    "tabIndex should be gated by showTooltip",
  );
  assert.ok(
    tsx.includes("role={showTooltip ? \"button\" : undefined}"),
    "role=button should be gated by showTooltip",
  );

  // Y-axis unit label
  assert.ok(
    tsx.includes("{showLabels && unit &&"),
    "LineChart must render unit label when unit and showLabels are provided",
  );

  // Tooltip timestamp with timezone
  assert.ok(
    tsx.includes("formatTimeAxisLabel(activePoint.timestamp)"),
    "Tooltip must include date and local timezone context",
  );
});
