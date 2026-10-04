import assert from "node:assert/strict";
import test from "node:test";

import {
  computeAdaptiveTicks,
  computeSharedDomain,
  computeTimeGeometry,
  formatTimeAxisLabel,
  mapQualityLabel,
} from "../src/components/charts/soilChartPresentation.ts";

test("numeric ticks adapt decimal precision so pH/temperature ticks do not repeat", () => {
  const phTicks = computeAdaptiveTicks(6.0, 7.0, 5);
  assert.equal(phTicks.length, 5);
  const phLabels = phTicks.map((t) => t.label);
  assert.equal(new Set(phLabels).size, 5, `Expected 5 unique pH labels, got ${phLabels.join(", ")}`);
  assert.ok(phLabels.some((l) => l.includes(".")), "pH ticks should include decimals");

  // Narrow domain should not duplicate labels
  const narrowTicks = computeAdaptiveTicks(6.12, 6.18, 5);
  assert.equal(new Set(narrowTicks.map((t) => t.label)).size, 5, "Narrow domain ticks must not repeat");

  const tempTicks = computeAdaptiveTicks(18.2, 22.4, 5);
  assert.equal(new Set(tempTicks.map((t) => t.label)).size, 5);

  const integerTicks = computeAdaptiveTicks(0, 100, 5);
  assert.deepEqual(
    integerTicks.map((t) => t.label),
    ["100", "75", "50", "25", "0"],
  );

  // Reject nonfinite input
  assert.deepEqual(computeAdaptiveTicks(NaN, 10, 5), []);
  assert.deepEqual(computeAdaptiveTicks(0, Infinity, 5), []);
});

test("timestamped series uses elapsed time rather than sample indices and preserves null gaps", () => {
  const points = [
    { timestamp: "2026-10-04T10:00:00.000Z", value: 10 },
    { timestamp: "2026-10-04T10:30:00.000Z", value: null },
    { timestamp: "2026-10-04T12:00:00.000Z", value: 20 },
  ];
  const chartWidth = 600;
  const paddingLeft = 40;

  const result = computeTimeGeometry(points, {
    chartWidth,
    paddingLeft,
    chartHeight: 200,
    paddingTop: 20,
    domain: { min: 0, max: 20 },
    timeDomain: {
      begin: "2026-10-04T10:00:00.000Z",
      end: "2026-10-04T12:00:00.000Z",
    },
  });

  assert.equal(result.length, 3);
  assert.equal(result[0].x, paddingLeft); // at 0%
  assert.equal(result[1].x, paddingLeft + chartWidth * 0.25); // at 25% (30m of 2h)
  assert.equal(result[1].y, null); // null gap preserved
  assert.equal(result[2].x, paddingLeft + chartWidth); // at 100%
  assert.equal(result[2].y, 20); // top of chart (ratio 1)

  // Nonfinite values become null
  const nonfinite = computeTimeGeometry([{ value: NaN, timestamp: "2026-10-04T10:00:00.000Z" }], {
    chartWidth,
    paddingLeft,
    chartHeight: 200,
    paddingTop: 20,
    domain: { min: 0, max: 20 },
  });
  assert.equal(nonfinite[0].y, null);
});

test("mixed finite and nonfinite values produce valid coordinates for finite points and null gaps", () => {
  const points = [
    { value: 10, timestamp: "2026-10-04T10:00:00.000Z" },
    { value: NaN, timestamp: "2026-10-04T10:30:00.000Z" },
    { value: Infinity, timestamp: "2026-10-04T11:00:00.000Z" },
    { value: 20, timestamp: "2026-10-04T12:00:00.000Z" },
  ];
  const chartWidth = 600;
  const paddingLeft = 40;

  const result = computeTimeGeometry(points, {
    chartWidth,
    paddingLeft,
    chartHeight: 200,
    paddingTop: 20,
    domain: { min: 10, max: 20 },
  });

  assert.equal(result.length, 4);
  assert.equal(result[0].y, 220); // bottom (min 10)
  assert.equal(result[1].y, null); // NaN becomes null
  assert.equal(result[2].y, null); // Infinity becomes null
  assert.equal(result[3].y, 20); // top (max 20)
});

test("one-point and empty series remain meaningful and retain timestamp position with common bounds", () => {
  const empty = computeTimeGeometry([], {
    chartWidth: 600,
    paddingLeft: 40,
    chartHeight: 200,
    paddingTop: 20,
    domain: { min: 0, max: 100 },
  });
  assert.deepEqual(empty, []);

  // Centered without timeDomain
  const single = computeTimeGeometry(
    [{ timestamp: "2026-10-04T12:00:00.000Z", value: 50 }],
    {
      chartWidth: 600,
      paddingLeft: 40,
      chartHeight: 200,
      paddingTop: 20,
      domain: { min: 0, max: 100 },
    },
  );
  assert.equal(single.length, 1);
  assert.equal(single[0].x, 40 + 300); // centered horizontally
  assert.equal(single[0].y, 20 + 100); // centered vertically (50%)

  // Retains timestamp position when common begin/end supplied
  const singleWithBounds = computeTimeGeometry(
    [{ timestamp: "2026-10-04T10:30:00.000Z", value: 50 }],
    {
      chartWidth: 600,
      paddingLeft: 40,
      chartHeight: 200,
      paddingTop: 20,
      domain: { min: 0, max: 100 },
      timeDomain: {
        begin: "2026-10-04T10:00:00.000Z",
        end: "2026-10-04T12:00:00.000Z",
      },
    },
  );
  assert.equal(singleWithBounds[0].x, 40 + 600 * 0.25); // 25% along timeline
});

test("axis label includes date/time and explicit local timezone context", () => {
  const formatted = formatTimeAxisLabel("2026-10-04T12:00:00.000Z");
  assert.ok(formatted.length > 0);
  assert.match(formatted, /\d{1,2}:\d{2}/, "Should include time");
  assert.ok(
    formatted.includes("GMT") || formatted.includes("UTC") || formatted.includes("/") || formatted.includes("-"),
    "Should include date and timezone context",
  );
});

test("quality labels map explicitly without green good for unknown", () => {
  assert.equal(mapQualityLabel("good").label, "Data valid");
  assert.equal(mapQualityLabel("good").variant, "good");
  assert.equal(mapQualityLabel("stale").label, "Data stale");
  assert.equal(mapQualityLabel("stale").variant, "warning");
  assert.equal(mapQualityLabel("out_of_range").label, "Out of range");
  assert.equal(mapQualityLabel("out_of_range").variant, "warning");
  assert.equal(mapQualityLabel(undefined).label, "Unknown");
  assert.equal(mapQualityLabel(undefined).variant, "neutral");
});

test("computeSharedDomain calculates unified numeric bounds across multiple series", () => {
  const domain = computeSharedDomain([{ data: [{ value: 10 }, { value: 30 }] }, { data: [{ value: 5 }, { value: 80 }] }]);
  assert.equal(domain.min, 5 - 7.5);
  assert.equal(domain.max, 80 + 7.5);
  assert.deepEqual(computeSharedDomain([{ data: [{ value: 10 }] }], 0, 100), { min: 0, max: 100 });
  assert.deepEqual(computeSharedDomain([]), { min: 0, max: 100 });
  const zeroDomain = computeSharedDomain([{ data: [{ value: 0 }] }]);
  assert.ok(zeroDomain.min < 0 && zeroDomain.max > 0);
  assert.deepEqual(computeSharedDomain([{ data: [{ value: 50 }, { value: 50 }] }]), { min: 45, max: 55 });
});

test("malformed timestamp amid valid timestamps produces a gap and never NaN in coordinates", () => {
  const res = computeTimeGeometry(
    [{ timestamp: "2026-10-04T10:00:00Z", value: 10 }, { timestamp: "bad", value: 15 }, { timestamp: "2026-10-04T12:00:00Z", value: 20 }],
    { chartWidth: 600, paddingLeft: 40, chartHeight: 200, paddingTop: 20, domain: { min: 0, max: 20 } },
  );
  assert.equal(res.length, 3);
  assert.ok(Number.isFinite(res[1].x));
  assert.equal(res[1].y, null);
});

test("malformed-only series stays a gap with a shared timeline", () => {
  const [point] = computeTimeGeometry([{ timestamp: "bad", value: 10 }], { chartWidth: 600, paddingLeft: 40, chartHeight: 200, paddingTop: 20, domain: { min: 0, max: 20 }, timeDomain: { begin: "2026-10-04T10:00:00Z", end: "2026-10-04T12:00:00Z" } });
  assert.equal(point.y, null);
});
