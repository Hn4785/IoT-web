import assert from "node:assert/strict";
import test from "node:test";

import { refreshSourceConnections } from "../src/utils/sourceConnectionRefresh.ts";

test("connection refresh checks every visible source and isolates failures", async () => {
  const outcomes: Array<{ id: string; status: string }> = [];
  await refreshSourceConnections(["owned", "shared", "busy"], async (id) => {
    if (id === "busy") throw new Error("Check busy");
    return { connectionStatus: id === "shared" ? "FAILED" : "CONNECTED", lastCheckedAt: "2026-10-05T00:00:00.000Z", isFromCache: false };
  }, (id, result) => outcomes.push({ id, status: result?.connectionStatus ?? "UNVERIFIED" }));
  assert.deepEqual(outcomes.sort((a, b) => a.id.localeCompare(b.id)), [
    { id: "busy", status: "UNVERIFIED" }, { id: "owned", status: "CONNECTED" }, { id: "shared", status: "FAILED" },
  ]);
});

test("connection refresh bounds concurrency to two and stops updates after navigation", async () => {
  let active = true;
  let running = 0;
  let maxRunning = 0;
  const releases: Array<() => void> = [];
  const outcomes: string[] = [];
  const refresh = refreshSourceConnections(["one", "two", "three"], async () => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    await new Promise<void>((resolve) => releases.push(resolve));
    running -= 1;
    return { connectionStatus: "CONNECTED", lastCheckedAt: "2026-10-05T00:00:00.000Z", isFromCache: false };
  }, (id) => outcomes.push(id), () => active);
  assert.equal(maxRunning, 2);
  active = false;
  releases.forEach((resolve) => resolve());
  await refresh;
  assert.equal(releases.length, 2);
  assert.deepEqual(outcomes, []);
});
