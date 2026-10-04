import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../src/pages/farm-owner/HistoryReport.tsx", import.meta.url), "utf8");

test("HistoryReport passes observedAt and quality into LineChart points and backend unit into chart", () => {
  assert.match(page, /timestamp:\s*point\.observedAt/);
  assert.match(page, /quality:\s*point\.quality/);
  assert.match(page, /unit=\{series\?\.unit/);
});

test("HistoryReport uses hidden dots and bounded height between 280 and 320", () => {
  assert.match(page, /showDots=\{false\}/);
  assert.match(page, /height=\{(2[8-9]\d|3[0-2]\d)\}/);
});

test("HistoryReport explains UTC filter boundaries versus local time chart labels", () => {
  assert.match(page, /UTC/i);
  assert.match(page, /local.*time|local.*timezone/i);
});

test("HistoryReport describes counts as hourly mean data points", () => {
  assert.match(page, /hourly mean data points/i);
  assert.doesNotMatch(page, /\{points\.length\}\s+measurements/);
});

test("HistoryReport distinguishes loading and error states from successful empty data", () => {
  assert.match(page, /isLoading/);
  assert.match(page, /Loading label=/);
  assert.match(page, /No historical measurements for the selected range/);
});

