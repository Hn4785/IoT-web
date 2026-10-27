import assert from "node:assert/strict";
import { test } from "node:test";
import { dataSourceDisplayName } from "../src/utils/dataSourceDisplayName.ts";

test("legacy generated labels do not advertise a creation-time station count", () => {
  const source = { name: "provider.example — 6 soil stations", baseUrl: "https://provider.example/api/v1" };
  assert.equal(dataSourceDisplayName(source), "provider.example");
  assert.equal(source.name, "provider.example — 6 soil stations");
  assert.equal(dataSourceDisplayName({ ...source, name: "provider.example — 1 soil station" }), "provider.example");
});

test("custom source labels and restricted metadata are not rewritten", () => {
  for (const name of ["North field — 6 soil stations", "API source", "provider.example — 6 soil stations east", "provider.example"]) {
    assert.equal(dataSourceDisplayName({ name, baseUrl: "https://provider.example/api/v1" }), name);
  }
  assert.equal(dataSourceDisplayName({ name: "Saved source", baseUrl: "invalid" }), "Saved source");
});
