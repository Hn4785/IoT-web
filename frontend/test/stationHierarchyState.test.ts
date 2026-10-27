import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserFarm, BrowserPlot, BrowserStation } from "../src/services/stationBrowserService.ts";
import type { CursorPage } from "../src/types/api.ts";
import { buildHierarchyScopeKey, StationHierarchyCoordinator } from "../src/utils/stationHierarchyState.ts";

const page = <T>(items: T[], nextCursor: string | null = null): CursorPage<T> => ({ items, nextCursor });
function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (r: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("buildHierarchyScopeKey binds user role/scope/env without tokens", () => {
  assert.equal(buildHierarchyScopeKey(null, "/api/v1"), "anon@/api/v1");
  const key = buildHierarchyScopeKey({ id: "u1", role: "FARMER", assignedFarmIds: ["f2", "f1"] }, "/api/v1");
  assert.equal(key, "u1:FARMER:f1,f2::@/api/v1");
  assert.ok(!key.includes("token") && !key.includes("Bearer"));
});

test("reload same parent IDs re-fetches all levels and observes changed stations", async () => {
  let ver = "A";
  const coordinator = new StationHierarchyCoordinator({
    service: {
      listFarms: async () => page([{ id: "f1", name: "F1" }]),
      listPlots: async () => page([{ id: "p1", farmId: "f1", name: "P1" }]),
      listStations: async () => page([{ id: ver === "A" ? "s1" : "s2", farmId: "f1", plotId: "p1", name: ver, code: ver }]),
    },
    scopeKey: "u1@/api/v1",
  });
  await coordinator.initialize();
  assert.equal(coordinator.getState().selectedStationId, "s1");
  ver = "B";
  await coordinator.reload();
  const st = coordinator.getState();
  assert.equal(st.selectedFarmId, "f1"); assert.equal(st.selectedPlotId, "p1");
  assert.equal(st.selectedStationId, "s2"); assert.equal(st.stations[0]?.id, "s2");
});

test("pending reload exposes empty selectedStationId and clears lists", async () => {
  const dFarm = deferred<CursorPage<BrowserFarm>>(), dPlot = deferred<CursorPage<BrowserPlot>>(), dStation = deferred<CursorPage<BrowserStation>>();
  const coordinator = new StationHierarchyCoordinator({
    service: { listFarms: async () => dFarm.promise, listPlots: async () => dPlot.promise, listStations: async () => dStation.promise },
    scopeKey: "u1@/api/v1",
  });
  const init = coordinator.initialize();
  assert.equal(coordinator.getState().loading, true); assert.equal(coordinator.getState().selectedStationId, "");
  assert.deepEqual(coordinator.getState().stations, []);
  dFarm.resolve(page([{ id: "f1", name: "F1" }])); dPlot.resolve(page([{ id: "p1", farmId: "f1", name: "P1" }]));
  dStation.resolve(page([{ id: "s1", farmId: "f1", plotId: "p1", name: "S1", code: "S1" }]));
  await init;
  assert.equal(coordinator.getState().selectedStationId, "s1");
});

test("revocation and error clears descendants and reports normalized error", async () => {
  let fail = false;
  const coordinator = new StationHierarchyCoordinator({
    service: {
      listFarms: async () => page([{ id: "f1", name: "F1" }]),
      listPlots: async () => { if (fail) throw new Error("Forbidden access"); return page([{ id: "p1", farmId: "f1", name: "P1" }]); },
      listStations: async () => page([]),
    },
    scopeKey: "u1@/api/v1",
  });
  await coordinator.initialize();
  assert.equal(coordinator.getState().selectedPlotId, "p1"); assert.equal(coordinator.getState().selectedStationId, "");
  fail = true;
  await coordinator.reload();
  const st = coordinator.getState();
  assert.deepEqual(st.plots, []); assert.equal(st.selectedPlotId, "");
  assert.equal(st.selectedStationId, ""); assert.match(st.error, /Forbidden/);
});

test("fences obsolete requests, identity switch, and validates selection", async () => {
  let useSlow = false;
  const dSlow = deferred<CursorPage<BrowserPlot>>(), dFast = deferred<CursorPage<BrowserPlot>>();
  const coordinator = new StationHierarchyCoordinator({
    service: {
      listFarms: async () => page([{ id: "f1", name: "F1" }, { id: "f2", name: "F2" }]),
      listPlots: async (fId) => (useSlow && fId === "f1" ? dSlow.promise : fId === "f2" ? dFast.promise : page([{ id: "p1", farmId: "f1", name: "P1" }])),
      listStations: async (plotId) => page([{ id: "s1", farmId: plotId === "p2" ? "f2" : "f1", plotId, name: "S1", code: "S1" }]),
    },
    scopeKey: "u1@/api/v1",
  });
  await coordinator.initialize();
  useSlow = true;
  const p1 = coordinator.selectFarm("f1"), p2 = coordinator.selectFarm("f2");
  dFast.resolve(page([{ id: "p2", farmId: "f2", name: "P2" }]));
  await p2;
  assert.equal(coordinator.getState().selectedFarmId, "f2");
  dSlow.resolve(page([{ id: "p1", farmId: "f1", name: "P1" }]));
  await p1;
  assert.equal(coordinator.getState().selectedFarmId, "f2");
  coordinator.selectStation("unverified-id");
  assert.equal(coordinator.getState().selectedStationId, "s1");
  useSlow = false;
  await coordinator.setScopeKey("u2@/api/v1");
  assert.equal(coordinator.getState().scopeKey, "u2@/api/v1");
});

test("enforces finite pagination budget and detects repeated cursors", async () => {
  let calls = 0;
  const coordinator = new StationHierarchyCoordinator({
    service: {
      listFarms: async () => page([{ id: "f1", name: "F1" }]),
      listPlots: async () => page([{ id: "p1", farmId: "f1", name: "P1" }]),
      listStations: async (_p, c) => { calls += 1; return page([{ id: `s${calls}`, farmId: "f1", plotId: "p1", name: `S${calls}`, code: `S${calls}` }], c === "c1" ? "c1" : "c1"); },
    },
    scopeKey: "u1@/api/v1",
    maxPages: 3,
  });
  await coordinator.initialize();
  const st = coordinator.getState();
  assert.equal(st.loading, false); assert.match(st.error, /repeated pagination cursor/i);
  assert.deepEqual(st.stations, []);
});

test("disposed coordinator does not publish after await and remount uses fresh instance", async () => {
  const dFarm = deferred<CursorPage<BrowserFarm>>();
  let publishes = 0;
  const c1 = new StationHierarchyCoordinator({
    service: { listFarms: async () => dFarm.promise, listPlots: async () => page([]), listStations: async () => page([]) },
    scopeKey: "u1@/api/v1",
    onStateChange: () => { publishes += 1; },
  });
  const init1 = c1.initialize();
  c1.dispose();
  dFarm.resolve(page([{ id: "f1", name: "F1" }]));
  await init1;
  assert.equal(publishes, 1); assert.equal(c1.getState().selectedFarmId, "");
  const c2 = new StationHierarchyCoordinator({
    service: { listFarms: async () => page([{ id: "f2", name: "F2" }]), listPlots: async () => page([]), listStations: async () => page([]) },
    scopeKey: "u1@/api/v1",
  });
  await c2.initialize();
  assert.equal(c2.getState().selectedFarmId, "f2");
});

test("responses with wrong parent bindings never expose their stations", async () => {
  for (const wrongLevel of ["plots", "stations"]) {
    const coordinator = new StationHierarchyCoordinator({ scopeKey: "scope", service: {
      listFarms: async () => page([{ id: "f", name: "F" }]),
      listPlots: async () => page([{ id: "p", farmId: wrongLevel === "plots" ? "other-farm" : "f", name: "P" }]),
      listStations: async () => page([{ id: "s", farmId: "f", plotId: "other-plot", name: "S", code: "S" }]),
    } });
    await coordinator.initialize();
    assert.deepEqual(coordinator.getState().stations, []);
    assert.equal(coordinator.getState().selectedStationId, "");
    assert.match(coordinator.getState().error, /parent/);
  }
});

test("dispose stops cursor continuation while an obsolete page settles", async () => {
  const first = deferred<CursorPage<BrowserFarm>>();
  const calls: Array<string | undefined> = [];
  const coordinator = new StationHierarchyCoordinator({ scopeKey: "scope", service: {
    listFarms: async cursor => { calls.push(cursor); return cursor ? page([]) : first.promise; },
    listPlots: async () => page([]), listStations: async () => page([]),
  } });
  const pending = coordinator.initialize();
  coordinator.dispose();
  first.resolve(page([{ id: "f", name: "F" }], "next"));
  await pending;
  assert.deepEqual(calls, [undefined]);
});

test("overlapping reloads preserve a still-authorized selection rather than first station", async () => {
  let slow = false;
  const gate = deferred<CursorPage<BrowserFarm>>();
  const coordinator = new StationHierarchyCoordinator({ scopeKey: "scope", service: {
    listFarms: async () => slow ? gate.promise : page([{ id: "f", name: "F" }]),
    listPlots: async () => page([{ id: "p", farmId: "f", name: "P" }]),
    listStations: async () => page(["a", "b"].map(id => ({ id, farmId: "f", plotId: "p", name: id, code: id }))),
  } });
  await coordinator.initialize();
  coordinator.selectStation("b");
  slow = true;
  const first = coordinator.reload(), second = coordinator.reload();
  assert.equal(coordinator.getState().selectedStationId, "");
  gate.resolve(page([{ id: "f", name: "F" }]));
  await Promise.all([first, second]);
  assert.equal(coordinator.getState().selectedStationId, "b");
});
