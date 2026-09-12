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

import { useStationHierarchy } from "@/hooks/useStationHierarchy";
import {
  stationBrowserService,
  type SoilHistoryData,
} from "@/services/stationBrowserService";
import { normalizeApiError } from "@/utils/apiError";
import type { SoilField } from "@/types/soil";

import styles from "./HistoricalAnalysis.module.css";

const EMPTY_HISTORY: Record<string, SoilHistoryData> = {};

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

function linePoints(values: number[]) {
  const width = 900;
  const height = 250;
  const padding = 16;

  if (values.length < 2) return "";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x =
        padding +
        (index / (values.length - 1)) *
          (width - padding * 2);

      const y =
        height -
        padding -
        ((value - min) / range) *
          (height - padding * 2);

      return `${x},${y}`;
    })
    .join(" ");
}

export default function HistoricalAnalysis() {
  const hierarchy = useStationHierarchy();
  const [historyState, setHistoryState] = useState<{
    key: string;
    data: Record<string, SoilHistoryData>;
    error: string;
  } | null>(null);

  const [selectedMetric, setSelectedMetric] =
    useState<SoilField>("moisture");

  const [selectedDepths, setSelectedDepths] = useState<number[]>([]);

  const metric =
    metricOptions.find(
      (item) => item.value === selectedMetric,
    ) ?? metricOptions[0];

  const historyKey = `${selectedMetric}:${hierarchy.stations.map((station) => station.id).join(",")}`;

  useEffect(() => {
    let active = true;
    if (hierarchy.stations.length === 0) return () => { active = false; };

    const end = new Date();
    const begin = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    Promise.all(hierarchy.stations.map(async (station) => [
      station.id,
      await stationBrowserService.getHistory(station.id, {
        fields: [selectedMetric],
        begin: begin.toISOString(),
        end: end.toISOString(),
        interval: "1d",
        aggregate: "mean",
        limit: 500,
      }),
    ] as const)).then(
      (entries) => {
        if (!active) return;
        setHistoryState({ key: historyKey, data: Object.fromEntries(entries), error: "" });
      },
      (reason) => {
        if (!active) return;
        setHistoryState({ key: historyKey, data: {}, error: normalizeApiError(reason).message });
      },
    );
    return () => { active = false; };
  }, [hierarchy.stations, historyKey, selectedMetric]);

  const currentHistory = historyState?.key === historyKey ? historyState : null;
  const historyByStation = currentHistory?.data ?? EMPTY_HISTORY;
  const historyError = currentHistory?.error ?? "";
  const historyLoading = hierarchy.stations.length > 0 && !currentHistory;

  const availableDepths = useMemo(() => Array.from(new Set(
    Object.values(historyByStation).flatMap((history) =>
      history.series.flatMap((item) => item.depthCm == null ? [] : [item.depthCm]),
    ),
  )).sort((left, right) => left - right), [historyByStation]);

  const series = useMemo(() => hierarchy.stations.flatMap((station) =>
    (historyByStation[station.id]?.series ?? [])
      .filter((item) => item.field === selectedMetric)
      .filter((item) => item.depthCm == null || selectedDepths.length === 0 || selectedDepths.includes(item.depthCm))
      .map((item, index) => {
        const depthLabel = item.depthCm == null ? "N/A" : `${item.depthCm}cm`;
        return {
        id: `${station.id}-${item.sensorId ?? index}-${item.depthCm ?? "na"}`,
        stationLabel: station.code,
        depthLabel,
        label: `${station.code} (${depthLabel})`,
        points: item.points,
        values: item.points.map((point) => point.value),
      };}),
  ), [hierarchy.stations, historyByStation, selectedDepths, selectedMetric]);

  const exportCsv = () => {
    const safeCell = (value: string | number) => {
      const text = String(value);
      const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${guarded.replaceAll('"', '""')}"`;
    };
    const rows = [
      ["station", "depth", "metric", "observedAt", "value", "unit"],
      ...series.flatMap((item) => item.points.map((point) => [
        item.stationLabel,
        item.depthLabel,
        selectedMetric,
        point.observedAt,
        point.value,
        metric.unit,
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

  const average =
    allValues.length > 0
      ? allValues.reduce((sum, value) => sum + value, 0) /
        allValues.length
      : 0;

  const minimum =
    allValues.length > 0
      ? Math.min(...allValues)
      : 0;

  const maximum =
    allValues.length > 0
      ? Math.max(...allValues)
      : 0;

  const variance =
    allValues.length > 0
      ? allValues.reduce(
          (sum, value) =>
            sum + Math.pow(value - average, 2),
          0,
        ) / allValues.length
      : 0;

  const standardDeviation = Math.sqrt(variance);

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
        title="Historical Analysis & Correlation"
        description="Compare soil profiles across depths and multiple stations."
        actions={
          <button className={styles.exportButton} disabled={series.length === 0} onClick={exportCsv}>
            <Download size={13} />
            Export CSV
          </button>
        }
      />

      {hierarchy.loading && <Loading label="Loading authorized stations..." />}
      {historyLoading && <Loading label="Loading soil history..." />}
      {hierarchy.error && <ErrorState description={hierarchy.error} onRetry={hierarchy.reload} />}
      {historyError && <ErrorState description={historyError} />}

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

        <div className={styles.filter}>
          <span>Depths:</span>

          <div className={styles.depthSelector}>
            {availableDepths.length === 0 && <span>Not provided by source</span>}
            {availableDepths.map((depth) => (
              <button
                key={depth}
                type="button"
                className={
                  selectedDepths.includes(depth)
                    ? styles.depthActive
                    : styles.depthButton
                }
                onClick={() => toggleDepth(depth)}
              >
                {depth}cm
              </button>
            ))}
          </div>
        </div>

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
            Last 30 Days
            <ChevronDown size={12} />
          </div>
        </div>
      </section>

      <section className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div>
            <h2>{metric.label} Multi-Series Correlation</h2>
            <span>
              Compare stations and depths over the selected
              period.
            </span>
          </div>

          <div className={styles.chartControls}>
            <button className={styles.activeView}>
              Line
            </button>
            <button>Area</button>
            <button title="Chart information">
              <Info size={12} />
            </button>
          </div>
        </div>

        <div className={styles.chart}>
          <div className={styles.gridLines}>
            <span />
            <span />
            <span />
            <span />
          </div>

          <svg
            viewBox="0 0 900 250"
            preserveAspectRatio="none"
            className={styles.svg}
          >
            {series.map((item, index) => (
              <polyline
                key={item.id}
                points={linePoints(item.values)}
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={
                  index % 4 === 0
                    ? styles.lineGreen
                    : index % 4 === 1
                      ? styles.lineBlue
                      : index % 4 === 2
                        ? styles.lineOrange
                        : styles.lineSlate
                }
              />
            ))}
          </svg>
        </div>

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
      </section>

      <section className={styles.bottomGrid}>
        <div className={styles.statisticsCard}>
          <h2>Summary Statistics</h2>

          <table>
            <thead>
              <tr>
                <th>Station</th>
                <th>Depth</th>
                <th>Average</th>
                <th>Minimum</th>
                <th>Maximum</th>
                <th>Std Deviation</th>
              </tr>
            </thead>

            <tbody>
              {series.map((item) => {
                const values = item.values;

                const avg =
                  values.reduce(
                    (sum, value) => sum + value,
                    0,
                  ) / values.length;

                const min = Math.min(...values);
                const max = Math.max(...values);

                const variance =
                  values.reduce(
                    (sum, value) =>
                      sum + Math.pow(value - avg, 2),
                    0,
                  ) / values.length;

                const std = Math.sqrt(variance);

                return (
                  <tr key={item.id}>
                    <td>{item.stationLabel}</td>
                    <td>{item.depthLabel}</td>
                    <td>{avg.toFixed(1)}{metric.unit}</td>
                    <td>{min.toFixed(1)}{metric.unit}</td>
                    <td>{max.toFixed(1)}{metric.unit}</td>
                    <td>{std.toFixed(1)}{metric.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.insights}>
          <InsightCard
            title="Highest Moisture Node"
            value={
              `${average.toFixed(1)}${metric.unit} average across selected data.`
            }
            icon="↗"
          />

          <InsightCard
            title="Root Zone Depletion Warning"
            value={
              minimum > 0
                ? `${minimum.toFixed(1)}${metric.unit} is the lowest observed value in the selected range.`
                : "No depletion warning available."
            }
            icon="△"
            warning
          />

          <InsightCard
            title="Total Observations Calculated"
            value={`${allValues.length} telemetry points analyzed for selected station/depth combinations.`}
            icon="▤"
          />
        </div>
      </section>

      <div className={styles.summaryFooter}>
        Average {average.toFixed(1)}
        {metric.unit} · Min {minimum.toFixed(1)}
        {metric.unit} · Max {maximum.toFixed(1)}
        {metric.unit} · Std Dev{" "}
        {standardDeviation.toFixed(1)}
        {metric.unit}
      </div>
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
