import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Circle,
  RefreshCw,
  Wifi,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import LineChart, { type LineChartSeries } from "@/components/charts/LineChart";
import { mapQualityLabel } from "@/components/charts/soilChartPresentation";
import { Button } from "@/components/common/Button";
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
  const [reloadKey, setReloadKey] = useState(0);
  const [dataState, setDataState] = useState<{
    stationId: string;
    reloadKey: number;
    latest: LatestSoilDataDto | null;
    history: SoilHistoryData | null;
    error: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    if (!hierarchy.selectedStationId) return () => { active = false; };
    const currentStationId = hierarchy.selectedStationId;
    const currentReloadKey = reloadKey;

    const end = new Date();
    const begin = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    Promise.all([
      stationBrowserService.getLatest(currentStationId),
      stationBrowserService.getHistory(currentStationId, {
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
          stationId: currentStationId,
          reloadKey: currentReloadKey,
          latest: nextLatest,
          history: nextHistory,
          error: "",
        });
      },
      (reason) => {
        if (!active) return;
        setDataState({
          stationId: currentStationId,
          reloadKey: currentReloadKey,
          latest: null,
          history: null,
          error: normalizeApiError(reason).message,
        });
      },
    );
    return () => { active = false; };
  }, [hierarchy.selectedStationId, reloadKey]);

  const currentData = (dataState?.stationId === hierarchy.selectedStationId && dataState?.reloadKey === reloadKey)
    ? dataState
    : null;
  const latest = currentData?.latest ?? null;
  const history = currentData?.history ?? null;
  const dataError = currentData?.error ?? "";
  const dataLoading = Boolean(hierarchy.selectedStationId && !currentData);
  const latestView = useMemo(() => latest ? adaptLatestSoilData(latest) : null, [latest]);
  const getMetricValue = (field: SoilField): SoilValue | undefined => {
    const reading = latestView?.fields[field];
    const metric = METRICS.find((m) => m.field === field);
    return reading ? {
      value: reading.value,
      unit: reading.unit || metric?.unit || "",
      quality: reading.quality,
      measuredAt: reading.observedAt,
    } : undefined;
  };

  const chartCards = [
    {
      field: "moisture" as SoilField,
      title: "Soil Moisture Over Time (24h)",
      helper: "Hourly mean over 24h",
      unit: "%",
    },
    {
      field: "temperature" as SoilField,
      title: "Soil Temperature Over Time (24h)",
      helper: "Hourly mean over 24h",
      unit: "°C",
    },
    {
      field: "ph" as SoilField,
      title: "pH Over Time (24h)",
      helper: "Hourly mean over 24h",
      unit: "pH",
    },
    {
      field: "ec" as SoilField,
      title: "Electrical Conductivity (24h)",
      helper: "Hourly mean over 24h",
      unit: "µS/cm",
    },
  ];

  const npkSeries: LineChartSeries[] = useMemo(
    () => [
      {
        name: "Nitrogen (N)",
        color: "var(--color-primary, #16a34a)",
        data: buildChartData(history, "nitrogen"),
      },
      {
        name: "Phosphorus (P)",
        color: "var(--color-info, #0284c7)",
        data: buildChartData(history, "phosphorus"),
      },
      {
        name: "Potassium (K)",
        color: "var(--color-warning, #d97706)",
        data: buildChartData(history, "potassium"),
      },
    ],
    [history],
  );

  return (
    <main className={styles.page}>
      <PageHeader
        title="Soil Monitoring Dashboard"
        description="Latest station snapshot and 24-hour historical trends for active plot soil probes."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw size={14} className={dataLoading ? styles.spin : undefined} />}
            disabled={!hierarchy.selectedStationId || dataLoading}
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Refresh
          </Button>
        }
      />

      {hierarchy.loading && <Loading label="Loading authorized stations..." />}
      {hierarchy.error && (
        <ErrorState description={hierarchy.error} onRetry={hierarchy.reload} />
      )}
      {dataError && <ErrorState description={dataError} />}

      <div className={styles.liveBar}>
        <div className={styles.liveStatus}>
          <span className={styles.liveDot} />
          <strong>{latest ? "Snapshot" : "Waiting"}</strong>
          <span>{latest ? `Fetched ${formatUpdatedAt(latest.fetchedAt)}` : "No snapshot loaded"}</span>
        </div>

        <div className={styles.connectionStatus}>
          <Wifi size={13} />
          <span>
            {dataLoading
              ? "Refreshing..."
              : latest?.isStale
                ? "Stale"
                : latest?.isFromCache
                  ? "Cached"
                  : latest
                    ? "Connected"
                    : "Unavailable"}
          </span>
          {history?.isFromCache && <span className={styles.cacheBadge}>Cache</span>}
        </div>
      </div>

      <section className={styles.filterBar}>
        <FilterSelect
          label="Farm"
          value={hierarchy.selectedFarmId}
          onChange={(event) => hierarchy.setSelectedFarmId(event.target.value)}
          placeholder="Select a farm"
          options={hierarchy.farms.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <FilterSelect
          label="Plot"
          value={hierarchy.selectedPlotId}
          onChange={(event) => hierarchy.setSelectedPlotId(event.target.value)}
          placeholder="Select a plot"
          disabled={!hierarchy.selectedFarmId}
          options={hierarchy.plots.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <FilterSelect
          label="Station"
          value={hierarchy.selectedStationId}
          onChange={(event) => hierarchy.setSelectedStationId(event.target.value)}
          placeholder="Select a station"
          disabled={!hierarchy.selectedPlotId}
          options={hierarchy.stations.map((item) => ({
            value: item.id,
            label: `${item.code} — ${item.name}`,
          }))}
        />
      </section>

      <div className={styles.qualityNotice}>
        <span>
          Reported quality reflects telemetry and sample status (&lsquo;Data valid&rsquo; indicates normal sensor transmission, not agronomic suitability or guaranteed soil health). For configured alert thresholds, visit the{" "}
          <Link to="/farm-owner/alert-center" className={styles.alertLink}>
            Alert Center
          </Link>
          .
        </span>
      </div>

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
              unit={history?.series.find((s) => s.field === chart.field)?.unit || chart.unit}
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
              <h2>NPK Macronutrient Concentration Trends (24h)</h2>
              <span>Hourly mean over 24h</span>
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

          <LineChart
            series={npkSeries}
            unit="mg/kg"
            height={220}
            showDots={false}
            showArea={false}
            showQuality
            showTimestamp
            showLabels
            showGrid
            ariaLabel="NPK Macronutrient Concentration Trends (24h)"
          />
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
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className={styles.filterItem}>
      <span>{label}:</span>

      <div className={styles.selectWrapper}>
        <select value={value} onChange={onChange} disabled={disabled}>
          {placeholder && <option value="">{placeholder}</option>}
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
  const quality = mapQualityLabel(value?.quality);
  const badgeClass =
    quality.variant === "warning"
      ? `${styles.qualityBadge} ${styles.warning}`
      : quality.variant === "neutral"
        ? `${styles.qualityBadge} ${styles.neutral}`
        : styles.qualityBadge;

  return (
    <article className={styles.metricCard}>
      <span className={styles.metricLabel}>
        {metric.label}
      </span>

      <div className={styles.metricValue}>
        {value?.value != null
          ? value.value.toFixed(metric.decimals)
          : "—"}

        <small>{value?.unit || metric.unit}</small>
      </div>

      <div className={badgeClass}>
        {quality.variant === "good" ? (
          <CheckCircle2 size={10} />
        ) : (
          <Circle size={10} />
        )}

        {quality.label}
      </div>

      <span className={styles.metricUpdated}>
        {value?.measuredAt
          ? `Sampled ${formatUpdatedAt(value.measuredAt)}`
          : "No recent data"}
      </span>
    </article>
  );
}
