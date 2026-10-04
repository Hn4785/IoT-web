import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Download,
  Info,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/common/ErrorState";
import Loading from "@/components/common/Loading";
import LineChart, { type LineChartSeries } from "@/components/charts/LineChart";

import { useStationHierarchy } from "@/hooks/useStationHierarchy";
import {
  stationBrowserService,
  type SoilHistoryData,
} from "@/services/stationBrowserService";
import { normalizeApiError } from "@/utils/apiError";
import type { SoilField } from "@/types/soil";

import { historyDepthPresentation } from "./historicalDepthPresentation.ts";
import { historyWindow, type HistoryDays } from "./historicalChartControls.ts";
import { measurementSummary } from "./historicalSummary.ts";
import styles from "./HistoricalAnalysis.module.css";

const EMPTY_HISTORY: Record<string, SoilHistoryData> = {};

const SERIES_COLORS = [
  "var(--color-primary, #16a34a)",
  "var(--color-info, #0284c7)",
  "var(--color-warning, #d97706)",
  "#64748b",
];

const metricOptions: {
  value: SoilField;
  label: string;
  unit: string;
}[] = [
  {
    value: "moisture",
    label: "Soil Moisture",
    unit: "%",
  },
  {
    value: "temperature",
    label: "Soil Temperature",
    unit: "°C",
  },
  {
    value: "ph",
    label: "pH Level",
    unit: "pH",
  },
  {
    value: "ec",
    label: "Electrical Conductivity",
    unit: "µS/cm",
  },
];

interface HistoryState {
  key: string;
  begin: string;
  end: string;
  data: Record<string, SoilHistoryData>;
  error: string;
}

function SelectBox({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.filter}>
      <span>{label}:</span>

      <div className={styles.selectWrap}>
        <select value={value} onChange={onChange}>
          {children}
        </select>
        <ChevronDown size={12} />
      </div>
    </label>
  );
}

export default function HistoricalAnalysis() {
  const hierarchy = useStationHierarchy();
  const [historyState, setHistoryState] = useState<HistoryState | null>(null);

  const [selectedMetric, setSelectedMetric] =
    useState<SoilField>("moisture");

  const [selectedDepths, setSelectedDepths] = useState<number[]>([]);
  const [historyDays, setHistoryDays] = useState<HistoryDays>(30);
  const [chartView, setChartView] = useState<"line" | "area">("line");
  const [showChartInfo, setShowChartInfo] = useState(false);

  const metric =
    metricOptions.find(
      (item) => item.value === selectedMetric,
    ) ?? metricOptions[0];

  const historyKey = `${selectedMetric}:${historyDays}:${hierarchy.stations.map((station) => station.id).join(",")}`;

  useEffect(() => {
    let active = true;
    if (hierarchy.stations.length === 0) return () => { active = false; };

    const { begin, end } = historyWindow(new Date(), historyDays);
    Promise.all(hierarchy.stations.map(async (station) => [
      station.id,
      await stationBrowserService.getHistory(station.id, {
        fields: [selectedMetric],
        begin,
        end,
        interval: "1d",
        aggregate: "mean",
        limit: 500,
      }),
    ] as const)).then(
      (entries) => {
        if (!active) return;
        setHistoryState({
          key: historyKey,
          begin,
          end,
          data: Object.fromEntries(entries),
          error: "",
        });
      },
      (reason) => {
        if (!active) return;
        setHistoryState({
          key: historyKey,
          begin,
          end,
          data: {},
          error: normalizeApiError(reason).message,
        });
      },
    );
    return () => { active = false; };
  }, [hierarchy.stations, historyDays, historyKey, selectedMetric]);

  const currentHistory = historyState?.key === historyKey ? historyState : null;
  const historyByStation = currentHistory?.data ?? EMPTY_HISTORY;
  const historyError = currentHistory?.error ?? "";
  const historyLoading = hierarchy.stations.length > 0 && !currentHistory;

  const isPending = hierarchy.loading || historyLoading;
  const hasError = Boolean(hierarchy.error || historyError);
  const currentError = hierarchy.error || historyError;

  const timeDomain = currentHistory
    ? { begin: currentHistory.begin, end: currentHistory.end }
    : undefined;

  const backendUnit = useMemo(() => {
    for (const history of Object.values(historyByStation)) {
      const found = history.series.find((s) => s.field === selectedMetric && s.unit);
      if (found?.unit) return found.unit;
    }
    return metric.unit;
  }, [historyByStation, selectedMetric, metric.unit]);

  const availableDepths = useMemo(() => Array.from(new Set(
    Object.values(historyByStation).flatMap((history) =>
      history.series.flatMap((item) => item.depthCm == null ? [] : [item.depthCm]),
    ),
  )).sort((left, right) => left - right), [historyByStation]);
  const depthPresentation = useMemo(
    () => historyDepthPresentation(availableDepths),
    [availableDepths],
  );

  const series = useMemo(() => hierarchy.stations.flatMap((station) =>
    (historyByStation[station.id]?.series ?? [])
      .filter((item) => item.field === selectedMetric)
      .filter((item) => item.points.length > 0)
      .filter((item) => item.depthCm == null || selectedDepths.length === 0 || selectedDepths.includes(item.depthCm))
      .map((item, index) => {
        const depthLabel = item.depthCm == null ? "" : `${item.depthCm}cm`;
        return {
        id: `${station.id}-${item.sensorId ?? index}-${item.depthCm ?? "na"}`,
        stationLabel: station.code,
        depthLabel,
        label: depthPresentation.seriesLabel(station.code, item.depthCm),
        points: item.points,
        values: item.points.map((point) => point.value),
      };}),
  ), [hierarchy.stations, historyByStation, selectedDepths, selectedMetric, depthPresentation]);

  const chartSeries: LineChartSeries[] = useMemo(() => series.map((item, index) => ({
    name: item.label,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    data: item.points.map((point) => ({
      value: point.value,
      timestamp: point.observedAt,
      quality: point.quality,
    })),
  })), [series]);

  const exportCsv = () => {
    const safeCell = (value: string | number) => {
      const text = String(value);
      const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${guarded.replaceAll('"', '""')}"`;
    };
    const rows: Array<Array<string | number>> = [
      depthPresentation.csvColumns,
      ...series.flatMap((item) => item.points.map((point) => [
        item.stationLabel,
        ...(depthPresentation.showDepth ? [item.depthLabel] : []),
        selectedMetric,
        point.observedAt,
        point.value,
        backendUnit,
      ])),
    ];
    const blob = new Blob([rows.map((row) => row.map(safeCell).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `soil-history-${selectedMetric}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const allValues = series.flatMap(
    (item) => item.values,
  );
  const summary = measurementSummary(allValues);
  const formatMeasurement = (value: number | null) =>
    value == null ? "N/A" : `${value.toFixed(1)}${backendUnit}`;

  const toggleDepth = (depth: number) => {
    setSelectedDepths((current) =>
      current.includes(depth)
        ? current.filter((item) => item !== depth)
        : [...current, depth],
    );
  };

  return (
    <main className={styles.page}>
      <PageHeader
        title="Historical Analysis"
        description={depthPresentation.showDepth
          ? "Station comparison and trends across soil depths over time."
          : "Station comparison and trends across stations over time."}
        actions={
          <button className={styles.exportButton} disabled={series.length === 0} onClick={exportCsv}>
            <Download size={13} />
            Export CSV
          </button>
        }
      />

      <section className={styles.filterBar}>
        <SelectBox
          label="Farm"
          value={hierarchy.selectedFarmId}
          onChange={(event) => {
            hierarchy.setSelectedFarmId(event.target.value);
          }}
        >
          {hierarchy.farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </SelectBox>

        <SelectBox
          label="Plot"
          value={hierarchy.selectedPlotId}
          onChange={(event) =>
            hierarchy.setSelectedPlotId(event.target.value)
          }
        >
          {hierarchy.plots.map((plot) => (
            <option key={plot.id} value={plot.id}>
              {plot.name}
            </option>
          ))}
        </SelectBox>

        <div className={styles.filter}>
          <span>Stations:</span>
          <div className={styles.staticFilter}>
            {hierarchy.stations.length > 0
              ? hierarchy.stations.map((station) => station.code).join(", ")
              : "All Stations"}
          </div>
        </div>

        {depthPresentation.showDepth && (
          <div className={styles.filter}>
            <span>Depths:</span>
            <div className={styles.depthSelector}>
              {availableDepths.map((depth) => (
                <button
                  key={depth}
                  type="button"
                  className={selectedDepths.includes(depth) ? styles.depthActive : styles.depthButton}
                  onClick={() => toggleDepth(depth)}
                >
                  {depth}cm
                </button>
              ))}
            </div>
          </div>
        )}

        <SelectBox
          label="Metric"
          value={selectedMetric}
          onChange={(event) =>
            setSelectedMetric(
              event.target.value as SoilField,
            )
          }
        >
          {metricOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </SelectBox>

        <div className={styles.filter}>
          <span>Date:</span>

          <div className={styles.dateFilter}>
            <CalendarDays size={12} />
            <select
              aria-label="History date range"
              value={historyDays}
              onChange={(event) => setHistoryDays(Number(event.target.value) as HistoryDays)}
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
        </div>
      </section>

      <section className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div>
            <h2>{metric.label} Station Comparison & Trends</h2>
            <span>{depthPresentation.showDepth
              ? "Station comparison and depth trends over the selected period."
              : "Station comparison and trends over the selected period."}</span>
          </div>

          <div className={styles.chartControls}>
            <button type="button" className={chartView === "line" ? styles.activeView : ""} aria-pressed={chartView === "line"} onClick={() => setChartView("line")}>
              Line
            </button>
            <button type="button" className={chartView === "area" ? styles.activeView : ""} aria-pressed={chartView === "area"} onClick={() => setChartView("area")}>
              Area
            </button>
            <button type="button" title="Chart information" aria-label="Chart information" aria-expanded={showChartInfo} onClick={() => setShowChartInfo((current) => !current)}>
              <Info size={12} />
            </button>
          </div>
        </div>
        {showChartInfo && (
          <p className={styles.chartInfo}>
            Daily mean values from authorized stations for the selected {historyDays}-day range, plotted on a common scale in your local timezone.
          </p>
        )}

        <div className={styles.chartContainer}>
          {hasError ? (
            <ErrorState
              description={currentError}
              onRetry={hierarchy.error ? hierarchy.reload : undefined}
            />
          ) : isPending ? (
            <Loading label={hierarchy.loading ? "Loading authorized stations..." : "Loading soil history..."} />
          ) : hierarchy.stations.length === 0 ? (
            <p className={styles.chartEmpty}>
              No stations available for the selected farm and plot. Select a plot with authorized stations to view historical trends.
            </p>
          ) : (
            <LineChart
              series={chartSeries}
              timeDomain={timeDomain}
              showDots={false}
              showArea={chartView === "area"}
              unit={backendUnit}
              emptyMessage="No historical measurements for the selected filters."
              ariaLabel={`${metric.label} historical trends`}
            />
          )}
        </div>

        {series.length > 0 && !isPending && !hasError && hierarchy.stations.length > 0 && (
          <div className={styles.legend}>
            {series.map((item, index) => (
              <span key={item.id}>
                <i
                  className={
                    index % 4 === 0
                      ? styles.legendGreen
                      : index % 4 === 1
                        ? styles.legendBlue
                        : index % 4 === 2
                          ? styles.legendOrange
                          : styles.legendSlate
                  }
                />
                {item.label}
              </span>
            ))}
          </div>
        )}
      </section>

      {!isPending && !hasError && hierarchy.stations.length > 0 && (
        <section className={styles.bottomGrid}>
          <div className={styles.statisticsCard}>
            <h2>Summary Statistics</h2>

            <div className={styles.tableContainer}>
              <table>
                <thead>
                  <tr>
                    <th>Station</th>
                    {depthPresentation.showDepth && <th>Depth</th>}
                    <th>Average</th>
                    <th>Minimum</th>
                    <th>Maximum</th>
                    <th>Std Deviation</th>
                  </tr>
                </thead>

                <tbody>
                  {series.map((item) => {
                    const values = item.values;
                    const itemSummary = measurementSummary(values);

                    return (
                      <tr key={item.id}>
                        <td>{item.stationLabel}</td>
                        {depthPresentation.showDepth && <td>{item.depthLabel}</td>}
                        <td>{formatMeasurement(itemSummary.average)}</td>
                        <td>{formatMeasurement(itemSummary.minimum)}</td>
                        <td>{formatMeasurement(itemSummary.maximum)}</td>
                        <td>{formatMeasurement(itemSummary.standardDeviation)}</td>
                      </tr>
                    );
                  })}
                  {series.length === 0 && (
                    <tr>
                      <td colSpan={depthPresentation.showDepth ? 6 : 5}>
                        No measurements available for the selected date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.insights}>
            <InsightCard
              title="Selected Metric Average"
              value={summary.average == null
                ? "No measurements available for the selected date range."
                : `${formatMeasurement(summary.average)} average across selected daily mean samples.`}
              icon="↗"
            />

            <InsightCard
              title="Lowest Observed Value"
              value={
                summary.minimum != null
                  ? `${formatMeasurement(summary.minimum)} lowest observed daily mean in the selected range.`
                  : "No measurements available for the selected date range."
              }
              icon="↓"
            />

            <InsightCard
              title="Daily Mean Samples Calculated"
              value={allValues.length > 0
                ? `${allValues.length} daily mean samples analyzed for selected ${depthPresentation.showDepth ? "station/depth combinations" : "stations"}.`
                : "No measurements available for the selected date range."}
              icon="▤"
            />
          </div>
        </section>
      )}
    </main>
  );
}

function InsightCard({
  title,
  value,
  icon,
  warning = false,
}: {
  title: string;
  value: string;
  icon: string;
  warning?: boolean;
}) {
  return (
    <article
      className={
        warning
          ? `${styles.insightCard} ${styles.insightWarning}`
          : styles.insightCard
      }
    >
      <div className={styles.insightTitle}>
        <strong>{title}</strong>
        <span>{icon}</span>
      </div>

      <p>{value}</p>
    </article>
  );
}
