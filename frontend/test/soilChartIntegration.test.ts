import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const chart = readFileSync(new URL("../src/components/charts/LineChart.tsx", import.meta.url), "utf8");
const soil = readFileSync(new URL("../src/pages/farm-owner/RealtimeSoilMonitoring.tsx", import.meta.url), "utf8");

test("LineChart and RealtimeSoilMonitoring wiring", () => {
  assert.match(chart, /series\??:\s*LineChartSeries\[\]/);
  assert.match(chart, /computeSharedDomain/);
  assert.match(chart, /ResizeObserver/);
  assert.match(chart, /effectiveWidth/);
  assert.match(chart, /formatTimeAxisLabel\(activePoint\.timestamp\)/);
  assert.match(chart, /Number\.isFinite\(value\)/);
  assert.match(chart, /<g role="group" aria-label=\{ariaLabel\}>/);
  assert.doesNotMatch(soil, /Live telemetry streaming/);
  assert.match(soil, /snapshot/i);
  assert.match(soil, /reloadKey/);
  assert.match(soil, /fetchedAt/);
  assert.match(soil, /mapQualityLabel/);
  assert.doesNotMatch(soil, /function qualityLabel\(/);
  assert.match(soil, /\/farm-owner\/alert-center/);
  assert.doesNotMatch(soil, /Optimal Target: 30% - 40%/);
  assert.doesNotMatch(soil, /Optimal Range: 18°C - 26°C/);
  assert.doesNotMatch(soil, /Acidic Warning threshold < 5\.5/);
  assert.doesNotMatch(soil, /function NpkLine\(/);
  assert.match(soil, /series=\{npkSeries\}/);
  assert.match(soil, /mg\/kg/);
  assert.doesNotMatch(soil, /Trends \(7 Days\)/);
  assert.match(soil, /<small>\{value\?\.unit \|\| metric\.unit\}<\/small>/);
  assert.match(soil, /history\?\.series\.find\(\(s\) => s\.field === chart\.field\)\?\.unit \|\| chart\.unit/);
});

test("a single second-series sample remains visible when first series is empty or starts with a gap", async () => {
  const source = chart.replace(/import styles from "\.\/LineChart.module.css";/, 'const styles = new Proxy({}, {get: (_, key) => key});').replace('"./soilChartPresentation.ts"', JSON.stringify(new URL("../src/components/charts/soilChartPresentation.ts", import.meta.url).href));
  const js = ts.transpileModule(source, {compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext}}).outputText.replaceAll('"react"', JSON.stringify(import.meta.resolve("react"))).replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")));
  const {default: LineChart} = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
  for (const data of [[], [{value: null}]]) {
    const html = renderToStaticMarkup(React.createElement(LineChart, {series: [{data}, {name: "P", data: [{value: 68}]}], showDots: false}));
    assert.equal((html.match(/class="dot"/g) ?? []).length, 1);
  }
});
