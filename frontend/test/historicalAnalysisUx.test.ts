import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../src/pages/farm-owner/HistoricalAnalysis.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/pages/farm-owner/HistoricalAnalysis.module.css", import.meta.url), "utf8");

test("HistoricalAnalysis renames away from correlation to station comparison and trends", () => {
  assert.doesNotMatch(page, /Historical Analysis & Correlation/);
  assert.match(page, /title="Historical Analysis"/);
  assert.doesNotMatch(page, /Multi-Series Correlation/i);
  assert.match(page, /Station comparison|comparison & trends|comparison \/ trends/i);
  assert.match(page, /daily mean/i);
  assert.match(page, /local.*timezone|local chart timezone/i);
  assert.match(page, /common scale/i);
});

test("HistoricalAnalysis uses shared LineChart with named/color series, showDots={false}, and removes linePoints", () => {
  assert.match(page, /import LineChart/);
  assert.doesNotMatch(page, /function linePoints\(/);
  assert.doesNotMatch(page, /<svg[^>]*viewBox="0 0 900 250"/);
  assert.doesNotMatch(page, /<polygon/);
  assert.doesNotMatch(page, /<polyline/);
  assert.match(page, /series=\{/);
  assert.match(page, /showDots=\{false\}/);
  assert.match(page, /timestamp:\s*point\.observedAt/);
  assert.match(page, /quality:\s*point\.quality/);
  assert.match(page, /showArea=\{chartView === "area"\}/);
});

test("HistoricalAnalysis stores exact request begin/end in historyState for timeDomain", () => {
  assert.match(page, /HistoryState[\s\S]*?begin:\s*string/i);
  assert.match(page, /HistoryState[\s\S]*?end:\s*string/i);
  assert.match(page, /currentHistory\s*\?\s*\{\s*begin:\s*currentHistory\.begin,\s*end:\s*currentHistory\.end\s*\}\s*:\s*undefined/);
  assert.doesNotMatch(page, /const timeDomain = useMemo\(\(\) => historyWindow/);
});

test("HistoricalAnalysis replaces root zone depletion warning with neutral lowest observed value", () => {
  assert.doesNotMatch(page, /Root Zone Depletion Warning/i);
  assert.doesNotMatch(page, /depletion warning/i);
  assert.match(page, /Lowest [Oo]bserved [Vv]alue/);
  assert.doesNotMatch(page, /summaryFooter/);
  assert.match(page, /daily mean samples/i);
});

test("HistoricalAnalysis aligns to 1440px centered frame, readable fonts, and responsive table scroll", () => {
  assert.match(css, /width:\s*min\s*\(\s*100%\s*,\s*1440px\s*\)/);
  assert.match(css, /margin-inline:\s*auto/);
  assert.doesNotMatch(css, /font-size:\s*8px/);
  assert.doesNotMatch(css, /font-size:\s*9px/);
  assert.doesNotMatch(css, /font-size:\s*10px/);
  assert.doesNotMatch(css, /font-size:\s*11px/);
  assert.match(css, /overflow-x:\s*auto/);
});

test("HistoricalAnalysis data-state truthfulness: handles hierarchy.error in chart and guards summary from pending/error", () => {
  assert.match(page, /historyLoading/);
  assert.match(page, /historyError/);
  assert.match(page, /hierarchy\.error/);
  // Chart container handles hierarchy error or history error
  assert.match(page, /hierarchy\.error[\s\S]*?<ErrorState/);
  // Summary/bottomGrid is guarded from loading or errors
  assert.match(page, /!isPending\s*&&\s*!hasError/);
  // Selection/guidance when no stations are available
  assert.match(page, /hierarchy\.stations\.length === 0/);
});

