import assert from "node:assert/strict";
import test from "node:test";

import { historyDepthPresentation } from "../src/pages/farm-owner/historicalDepthPresentation.ts";

test("historical analysis omits depth labels and CSV column when no depth is provided", () => {
  const presentation = historyDepthPresentation([]);
  assert.equal(presentation.showDepth, false);
  assert.equal(presentation.seriesLabel("NODE01", null), "NODE01");
  assert.deepEqual(presentation.csvColumns, ["station", "metric", "observedAt", "value", "unit"]);
});

test("historical analysis keeps depth when the source provides it", () => {
  const presentation = historyDepthPresentation([10]);
  assert.equal(presentation.showDepth, true);
  assert.equal(presentation.seriesLabel("NODE01", 10), "NODE01 (10cm)");
  assert.deepEqual(presentation.csvColumns, ["station", "depth", "metric", "observedAt", "value", "unit"]);
});
