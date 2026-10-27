import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Download,
  Info,
  RefreshCw,
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
import type { SoilField } from "@/types/soil";

import { historyDepthPresentation } from "./historicalDepthPresentation.ts";
import { historyWindow, type HistoryDays } from "./historicalChartControls.ts";
import { measurementSummary } from "./historicalSummary.ts";
import {
  buildHistoryQueryKey,
  handleStationHistorySuccess,
  handleStationHistoryError,
  insertChartGaps,
  getHonestProvenanceAndCoverage,
  safeCsvCell,
  createStationHistoryRequestFence,
  beginStationHistoryRequest,
  selectHistoryRecords,
  type StationHistoryRecord,
} from "../../utils/retainedHistoryData.ts";
import styles from "./HistoricalAnalysis.module.css";
import { formatVietnamDateTime } from "../../utils/formatDateTime.ts";

const EMPTY_HISTORY: Record<string, SoilHistoryData> = {};
const EMPTY_RECORDS: Record<string, StationHistoryRecord> = {};
const EMPTY_ERRORS: Record<string, string> = {};

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
  records: Record<string, StationHistoryRecord>;
  errors: Record<string, string>;
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
  const [historyDays, setHistoryDays] = useState<HistoryDays>(30);
  const [actualWindow, setActualWindow] = useState(() => historyWindow(new Date(), 30));
  const [historyState, setHistoryState] = useState<HistoryState | null>(null);

  const [selectedMetric, setSelectedMetric] =
    useState<SoilField>("moisture");

  const [selectedDepths, setSelectedDepths] = useState<number[]>([]);
  const [chartView, setChartView] = useState<"line" | "area">("line");
  const [showChartInfo, setShowChartInfo] = useState(false);
  const requestsRef = useRef(createStationHistoryRequestFence());

  const metric = metricOptions.find((item) => item.value === selectedMetric) ?? metricOptions[0];
  const historyKey = JSON.stringify(hierarchy.stations.map((station) => buildHistoryQueryKey({
    stationId: station.id, fields: [selectedMetric], ...actualWindow,
    interval: "1d", aggregate: "mean", order: "asc", limit: 500,
  })));
  if (!hierarchy.loading && hierarchy.stations.length === 0 && historyState !== null) {
    setHistoryState(null);
  }

  const handleDaysChange = (days: HistoryDays) => {
    setHistoryDays(days);
    setActualWindow(historyWindow(new Date(), days));
  };

  const loadStation = useCallback((stationId: string) => {
    const request = requestsRef.current.begin(stationId);
    const query = { fields: [selectedMetric], ...actualWindow, interval: "1d" as const,
      aggregate: "mean" as const, order: "asc" as const, limit: 500 };
    const queryKey = buildHistoryQueryKey({ stationId, ...query });
    const update = (resolve: (prior?: StationHistoryRecord) => StationHistoryRecord) => {
      setHistoryState((prev) => {
        if (!requestsRef.current.isCurrent(request)) return prev;
        const records = selectHistoryRecords(prev?.records ?? {}, JSON.parse(historyKey) as string[]);
        records[stationId] = resolve(records[stationId]);
        const data: Record<string, SoilHistoryData> = {};
        const errors: Record<string, string> = {};
        for (const [id, record] of Object.entries(records)) {
          if (record.data) data[id] = record.data;
          if (record.error) errors[id] = record.error;
        }
        return { key: historyKey, ...actualWindow, records, data, errors, error: "" };
      });
    };
    update((prior) => beginStationHistoryRequest(prior, queryKey, stationId));
    stationBrowserService.getHistory(stationId, query).then(
      (result) => update((prior) => handleStationHistorySuccess(prior, queryKey, result, stationId)),
      (reason) => update((prior) => handleStationHistoryError(prior, queryKey, reason, stationId)),
    );
  }, [historyKey, selectedMetric, actualWindow]);

  useEffect(() => {
    const requests = requestsRef.current;
    requests.reset();
    for (const station of hierarchy.stations) loadStation(station.id);
    return () => requests.reset();
  }, [hierarchy.stations, loadStation]);

  const retryStation = (stationId: string) => {
    if (hierarchy.stations.some((station) => station.id === stationId)) loadStation(stationId);
  };

  const currentHistory = historyState?.key === historyKey ? historyState : null;
  const historyByStation = currentHistory?.data ?? EMPTY_HISTORY;
  const stationRecords = currentHistory?.records ?? EMPTY_RECORDS;
  const failedStations = currentHistory?.errors ?? EMPTY_ERRORS;
  const historyError = currentHistory?.error ?? "";
  const historyLoading = hierarchy.stations.length > 0 && (!currentHistory
    || (Object.values(stationRecords).some((record) => record.pending) && Object.keys(historyByStation).length === 0));

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
        label: stationRecords[station.id]?.isRetained
          ? `${depthPresentation.seriesLabel(station.code, item.depthCm)} (Last known)`
          : depthPresentation.seriesLabel(station.code, item.depthCm),
        points: item.points,
        values: item.points.map((point) => point.value),
      };}),
  ), [hierarchy.stations, historyByStation, stationRecords, selectedDepths, selectedMetric, depthPresentation]);

  const chartSeries: LineChartSeries[] = useMemo(() => series.map((item, index) => ({
    name: item.label,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    data: insertChartGaps(item.points, "1d").map((point) => ({
      value: point.value,
      timestamp: point.observedAt,
      quality: point.quality,
    })),
  })), [series]);

  const exportCsv = () => {
    const meta = hierarchy.stations.flatMap((station) => {
      const record = stationRecords[station.id];
      const provenance = getHonestProvenanceAndCoverage(record?.data ?? null,
        Boolean(record?.isRetained), Boolean(record?.error || record?.pending));
      return [
        `# ${safeCsvCell("Station")},${safeCsvCell(station.code)}`,
        `# ${safeCsvCell("Query")},${safeCsvCell(record?.queryKey ?? "")}`,
        `# ${safeCsvCell("Source")},${safeCsvCell(record?.data ? provenance.origin : "unavailable")}`,
        `# ${safeCsvCell("Coverage")},${safeCsvCell(provenance.coverageLabel)}`,
        `# ${safeCsvCell("Last successful fetch")},${safeCsvCell(record?.fetchedAt)}`,
      ];
    });
    const rows = [
      depthPresentation.csvColumns.map(safeCsvCell).join(","),
      ...series.flatMap((item) => item.points.map((point) => [
        item.stationLabel,
        ...(depthPresentation.showDepth ? [item.depthLabel] : []),
        selectedMetric,
        point.observedAt,
        point.value,
        backendUnit,
      ].map(safeCsvCell).join(","))),
    ];
    const blob = new Blob([[...meta, ...rows].join("\n")], {
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
          <>
          <button className={styles.exportButton} disabled={hierarchy.loading} onClick={hierarchy.reload}>
            <RefreshCw size={13} />Refresh
          </button>
          <button className={styles.exportButton} disabled={series.length === 0} onClick={exportCsv}>
            <Download size={13} />
            Export CSV
          </button>
          </>
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
              onChange={(event) => handleDaysChange(Number(event.target.value) as HistoryDays)}
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

        {Object.entries(failedStations).map(([stId, errText]) => {
          const st = hierarchy.stations.find((s) => s.id === stId);
          const isRet = Boolean(stationRecords[stId]?.isRetained);
          return (
            <p key={stId} className={styles.chartInfo} role="alert">
              Station {st?.code ?? stId}: {errText}
              {isRet ? " (showing last known measurements)" : ""}
              {" "}
              <button
                type="button"
                style={{ marginLeft: 8, cursor: "pointer", textDecoration: "underline", background: "none", border: "none", color: "inherit", font: "inherit" }}
                disabled={stationRecords[stId]?.pending}
                onClick={() => retryStation(stId)}
              >
                Retry
              </button>
            </p>
          );
        })}

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
        {!hierarchy.loading && hierarchy.stations.map((station) => {
          const record = stationRecords[station.id];
          const provenance = getHonestProvenanceAndCoverage(record?.data ?? null,
            Boolean(record?.isRetained), Boolean(record?.error || record?.pending));
          return <p key={station.id} className={styles.chartInfo}>
            {station.code}: {record?.data ? provenance.provenanceLabel : "unavailable"}
            {record?.isStale ? " · Stale" : ""}{record?.pending ? " · Checking" : ""}
            {" · Coverage: "}{provenance.coverageLabel}
            {record?.fetchedAt ? ` · Last fetch: ${formatVietnamDateTime(record.fetchedAt)}` : ""}
          </p>;
        })}
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
