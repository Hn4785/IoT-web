import assert from "node:assert/strict";
import test from "node:test";

import { measurementSummary } from "../src/pages/farm-owner/historicalSummary.ts";

test("empty history has no numeric summary", () => {
  assert.deepEqual(measurementSummary([]), { average: null, minimum: null, maximum: null, standardDeviation: null });
});

test("history summary includes real zero measurements", () => {
  assert.deepEqual(measurementSummary([0, 2]), { average: 1, minimum: 0, maximum: 2, standardDeviation: 1 });
});
