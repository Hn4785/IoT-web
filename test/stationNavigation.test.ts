import assert from "node:assert/strict";
import test from "node:test";

import { stationDetailPath } from "../src/routes/stationNavigation.ts";

test("station search navigates Admin and Farmer only to their scoped detail routes", () => {
  assert.equal(stationDetailPath("ADMIN", "station-1"), "/admin/stations/station-1");
  assert.equal(stationDetailPath("FARMER", "station-1"), "/farm-owner/stations/station-1");
  assert.equal(stationDetailPath("CLIENT_DEVELOPER", "station-1"), null);
});
