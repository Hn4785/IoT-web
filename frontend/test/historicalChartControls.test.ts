import assert from "node:assert/strict";
import test from "node:test";

import { historyWindow, areaPoints } from "../src/pages/farm-owner/historicalChartControls.ts";

test("history window follows the selected number of days", () => {
  const now = new Date("2026-09-25T12:00:00.000Z");
  assert.deepEqual(historyWindow(now, 7), {
    begin: "2026-09-18T12:00:00.000Z",
    end: "2026-09-25T12:00:00.000Z",
  });
  assert.equal(historyWindow(now, 90).begin, "2026-06-27T12:00:00.000Z");
});

test("area geometry closes at the chart baseline", () => {
  assert.equal(areaPoints([10, 20]), "16,234 16,234 884,16 884,234");
  assert.equal(areaPoints([10]), "");
});
