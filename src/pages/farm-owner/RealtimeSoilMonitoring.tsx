import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Circle,
  Wifi,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import LineChart from "@/components/charts/LineChart";
import ErrorState from "@/components/common/ErrorState";
import Loading from "@/components/common/Loading";

import { useStationHierarchy } from "@/hooks/useStationHierarchy";
import {
  stationBrowserService,
  type SoilHistoryData,
} from "@/services/stationBrowserService";
import { normalizeApiError } from "@/utils/apiError";
import {
  adaptLatestSoilData,
  type LatestSoilDataDto,
  type SoilField,
  type SoilValue,
} from "@/types/soil";

import styles from "./RealtimeSoilMonitoring.module.css";

type MetricConfig = {
  field: SoilField;
  label: string;
  shortLabel: string;
  unit: string;
  decimals: number;
};

const METRICS: MetricConfig[] = [
  {
    field: "moisture",
    label: "Soil Moisture",
    shortLabel: "Soil Moisture",
    unit: "%",
    decimals: 1,
  },
  {
    field: "temperature",
    label: "Soil Temp",
    shortLabel: "Soil Temperature",
    unit: "°C",
    decimals: 1,
  },
  {
    field: "ph",
    label: "pH Level",
    shortLabel: "pH",
    unit: "pH",
    decimals: 1,
  },
  {
    field: "ec",
    label: "EC (Salinity)",
    shortLabel: "Electrical Conductivity",
    unit: "µS/cm",
    decimals: 0,
  },
  {
    field: "nitrogen",
    label: "Nitrogen (N)",
    shortLabel: "Nitrogen (N)",
    unit: "mg/kg",
    decimals: 0,
  },
  {
    field: "phosphorus",
    label: "Phosphorus (P)",
    shortLabel: "Phosphorus (P)",
    unit: "mg/kg",
    decimals: 0,
  },
  {
    field: "potassium",
    label: "Potassium (K)",
    shortLabel: "Potassium (K)",
    unit: "mg/kg",
    decimals: 0,
  },
];

function formatUpdatedAt(value: string) {
  const diff = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );

  if (diff < 60) return `${diff}s ago`;

  const minutes = Math.floor(diff / 60);

  if (minutes < 60) return `${minutes}m ago`;

  return `${Math.floor(minutes / 60)}h ago`;
}

function qualityLabel(quality?: string) {
  if (!quality) return "Unknown";

  return quality
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildChartData(history: SoilHistoryData | null, field: SoilField) {
  const points = history?.series.find((series) => series.field === field)?.points ?? [];
  return points.map((point) => ({
    label: new Date(point.observedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    value: point.value,
    timestamp: point.observedAt,
    quality: point.quality,
  }));
}

export default function RealtimeSoilMonitoring() {
  const hierarchy = useStationHierarchy();
  const [dataState, setDataState] = useState<{
    stationId: string;
    latest: LatestSoilDataDto | null;
    history: SoilHistoryData | null;
    error: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    if (!hierarchy.selectedStationId) return () => { active = false; };

    const end = new Date();
    const begin = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    Promise.all([
      stationBrowserService.getLatest(hierarchy.selectedStationId),
      stationBrowserService.getHistory(hierarchy.selectedStationId, {
        fields: METRICS.map((metric) => metric.field),
        begin: begin.toISOString(),
        end: end.toISOString(),
        interval: "1h",
        aggregate: "mean",
        limit: 500,
      }),
    ]).then(
      ([nextLatest, nextHistory]) => {
        if (!active) return;
        setDataState({
          stationId: hierarchy.selectedStationId,
          latest: nextLatest,
          history: nextHistory,
          error: "",
        });
      },
      (reason) => {
        if (!active) return;
        setDataState({
          stationId: hierarchy.selectedStationId,
          latest: null,
          history: null,
          error: normalizeApiError(reason).message,
        });
      },
    );
    return () => { active = false; };
  }, [hierarchy.selectedStationId]);

  const currentData = dataState?.stationId === hierarchy.selectedStationId ? dataState : null;
  const latest = currentData?.latest ?? null;
  const history = currentData?.history ?? null;
  const dataError = currentData?.error ?? "";
  const dataLoading = Boolean(hierarchy.selectedStationId && !currentData);
  const latestView = useMemo(() => latest ? adaptLatestSoilData(latest) : null, [latest]);
  const currentDepth = latest?.fields.find((field) => field.depthCm != null)?.depthCm;
  const getMetricValue = (field: SoilField): SoilValue | undefined => {
    const reading = latestView?.fields[field];
    return reading ? {
      value: reading.value,
      unit: reading.unit ?? "",
      quality: reading.quality,
      measuredAt: reading.observedAt,
    } : undefined;
  };

  const chartCards = [
    {
      field: "moisture" as SoilField,
      title: "Soil Moisture Over Time (24h)",
      helper: "Optimal Target: 30% - 40%",
    },
    {
      field: "temperature" as SoilField,
      title: "Soil Temperature Over Time (24h)",
      helper: "Optimal Range: 18°C - 26°C",
    },
    {
      field: "ph" as SoilField,
      title: "pH Over Time (24h)",
      helper: "Acidic Warning threshold < 5.5",
    },
    {
      field: "ec" as SoilField,
      title: "Electrical Conductivity (24h)",
      helper: "Target: 0.8 - 1.5 mS/cm",
    },
  ];

  return (
    <main className={styles.page}>
      <PageHeader
        title="Realtime Soil Monitoring"
        description="Live telemetry streaming directly from active Plot soil probes."
      />

      {hierarchy.loading && <Loading label="Loading authorized stations..." />}
      {hierarchy.error && (
        <ErrorState description={hierarchy.error} onRetry={hierarchy.reload} />
      )}
      {dataError && <ErrorState description={dataError} />}

      <div className={styles.liveBar}>
        <div className={styles.liveStatus}>
          <span className={styles.liveDot} />
          <strong>{latest ? "Live" : "Waiting"}</strong>
          <span>{latest ? `Updated ${formatUpdatedAt(latest.fetchedAt)}` : "No measurement loaded"}</span>
        </div>

        <div className={styles.connectionStatus}>
          <Wifi size={13} />
          <span>
            {dataLoading ? "Loading" : latest?.isStale ? "Stale" : latest ? "Connected" : "Unavailable"}
          </span>
        </div>
      </div>

      <section className={styles.filterBar}>
        <FilterSelect
          label="Farm"
          value={hierarchy.selectedFarmId}
          onChange={(event) => hierarchy.setSelectedFarmId(event.target.value)}
          options={hierarchy.farms.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <FilterSelect
          label="Plot"
          value={hierarchy.selectedPlotId}
          onChange={(event) => hierarchy.setSelectedPlotId(event.target.value)}
          options={hierarchy.plots.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <FilterSelect
          label="Station"
          value={hierarchy.selectedStationId}
          onChange={(event) => hierarchy.setSelectedStationId(event.target.value)}
          options={hierarchy.stations.map((item) => ({
            value: item.id,
            label: `${item.code} — ${item.name}`,
          }))}
        />

        <div className={styles.filterItem}>
          <span>Depth:</span>
          <div className={styles.staticSelect}>
            <span>{currentDepth == null ? "N/A" : `${currentDepth}cm`}</span>
            <ChevronDown size={13} />
          </div>
        </div>
      </section>

      <section className={styles.metricGrid}>
        {METRICS.map((metric) => {
          const value = getMetricValue(metric.field);

          return (
            <MetricCard
              key={metric.field}
              metric={metric}
              value={value}
            />
          );
        })}
      </section>

      <section className={styles.chartGrid}>
        {chartCards.map((chart) => (
          <article className={styles.chartCard} key={chart.field}>
            <div className={styles.chartHeader}>
              <h2>{chart.title}</h2>
              <span>{chart.helper}</span>
            </div>

            <LineChart
              data={buildChartData(history, chart.field)}
              height={210}
              showDots={false}
              showArea={false}
              showQuality
              showTimestamp
              showLabels
              showGrid
              ariaLabel={chart.title}
            />
          </article>
        ))}

        <article className={`${styles.chartCard} ${styles.npkCard}`}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitleWithIcon}>
              <Activity size={14} />
              <h2>NPK Daily Macronutrient Concentration Trends (7 Days)</h2>
            </div>

            <div className={styles.legend}>
              <span>
                <i className={styles.nitrogen} />
                Nitrogen (N)
              </span>
              <span>
                <i className={styles.phosphorus} />
                Phosphorus (P)
              </span>
              <span>
                <i className={styles.potassium} />
                Potassium (K)
              </span>
            </div>
          </div>

          <div className={styles.npkChart}>
            <NpkLine
              values={buildChartData(history, "nitrogen").map((point) => point.value)}
              className={styles.nitrogenLine}
            />

            <NpkLine
              values={buildChartData(history, "phosphorus").map((point) => point.value)}
              className={styles.phosphorusLine}
            />

            <NpkLine
              values={buildChartData(history, "potassium").map((point) => point.value)}
              className={styles.potassiumLine}
            />
          </div>
        </article>
      </section>

      {!hierarchy.loading && !hierarchy.selectedFarm && (
        <div className={styles.noData}>
          <Circle size={16} />
          No active farm is currently available.
        </div>
      )}
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className={styles.filterItem}>
      <span>{label}:</span>

      <div className={styles.selectWrapper}>
        <select value={value} onChange={onChange}>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown size={13} />
      </div>
    </label>
  );
}

function MetricCard({
  metric,
  value,
}: {
  metric: MetricConfig;
  value?: SoilValue;
}) {
  const isWarning =
    value?.quality === "out_of_range" ||
    value?.quality === "stale" ||
    value?.quality === "uncalibrated";

  return (
    <article className={styles.metricCard}>
      <span className={styles.metricLabel}>
        {metric.label}
      </span>

      <div className={styles.metricValue}>
        {value?.value != null
          ? value.value.toFixed(metric.decimals)
          : "—"}

        <small>{metric.unit}</small>
      </div>

      <div
        className={
          isWarning
            ? `${styles.qualityBadge} ${styles.warning}`
            : styles.qualityBadge
        }
      >
        {value?.quality === "good" ? (
          <CheckCircle2 size={10} />
        ) : (
          <Circle size={10} />
        )}

        {qualityLabel(value?.quality)}
      </div>

      <span className={styles.metricUpdated}>
        {value?.measuredAt
          ? `Updated ${formatUpdatedAt(value.measuredAt)}`
          : "No recent data"}
      </span>
    </article>
  );
}

function NpkLine({
  values,
  className,
}: {
  values: number[];
  className: string;
}) {
  if (values.length < 2) return null;

  const width = 760;
  const height = 150;
  const padding = 12;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
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

  return (
    <svg
      className={styles.npkSvg}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        className={className}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
