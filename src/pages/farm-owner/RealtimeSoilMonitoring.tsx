import { useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Circle,
  Wifi,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import LineChart from "@/components/charts/LineChart";

import { farms } from "@/data/farms";
import { plots } from "@/data/plots";
import { stations } from "@/data/stations";
import { latestSoilData, soilHistory } from "@/data/soilData";

import type { SoilField, SoilValue } from "@/types/soil";

import styles from "./RealtimeSoilMonitoring.module.css";

const FARM_OWNER_ID = "USR-006";

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

function buildChartData(field: SoilField) {
  return (soilHistory[field] ?? []).map((point) => ({
    label: new Date(point.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    value: point.value,
    timestamp: point.timestamp,
    quality: point.quality,
  }));
}

export default function RealtimeSoilMonitoring() {
  const ownedFarms = useMemo(
    () =>
      farms.filter(
        (farm) =>
          farm.ownerId === FARM_OWNER_ID &&
          farm.status === "active",
      ),
    [],
  );

  const [selectedFarmId, setSelectedFarmId] = useState(
    ownedFarms[0]?.id ?? "",
  );

  const farm = ownedFarms.find(
    (item) => item.id === selectedFarmId,
  );

  const farmPlots = useMemo(
    () =>
      plots.filter(
        (plot) => plot.farmId === selectedFarmId,
      ),
    [selectedFarmId],
  );

  const [selectedPlotId, setSelectedPlotId] = useState(
    farmPlots[0]?.id ?? "",
  );

  const selectedPlot =
    farmPlots.find((plot) => plot.id === selectedPlotId) ??
    farmPlots[0];

  const farmStations = useMemo(
    () =>
      stations.filter(
        (station) =>
          station.farmId === selectedFarmId &&
          (!selectedPlot?.id || station.plotId === selectedPlot.id),
      ),
    [selectedFarmId, selectedPlot?.id],
  );

  const [selectedStationId, setSelectedStationId] = useState(
    farmStations[0]?.id ?? "",
  );

  const selectedStation =
    farmStations.find(
      (station) => station.id === selectedStationId,
    ) ?? farmStations[0];

  const stationData =
    latestSoilData.find(
      (item) =>
        item.stationId === selectedStation?.id &&
        item.farmId === selectedFarmId,
    ) ??
    latestSoilData.find(
      (item) => item.farmId === selectedFarmId,
    );

  const currentDepth = stationData?.depth ?? 20;

  const handleFarmChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const farmId = event.target.value;

    setSelectedFarmId(farmId);

    const nextPlot = plots.find(
      (plot) => plot.farmId === farmId,
    );

    setSelectedPlotId(nextPlot?.id ?? "");

    const nextStation = stations.find(
      (station) =>
        station.farmId === farmId &&
        station.plotId === nextPlot?.id,
    );

    setSelectedStationId(nextStation?.id ?? "");
  };

  const handlePlotChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const plotId = event.target.value;

    setSelectedPlotId(plotId);

    const nextStation = stations.find(
      (station) =>
        station.farmId === selectedFarmId &&
        station.plotId === plotId,
    );

    setSelectedStationId(nextStation?.id ?? "");
  };

  const handleStationChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setSelectedStationId(event.target.value);
  };

  const getMetricValue = (field: SoilField) =>
    stationData?.telemetry[field];

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

      <div className={styles.liveBar}>
        <div className={styles.liveStatus}>
          <span className={styles.liveDot} />
          <strong>Live</strong>
          <span>Updated {formatUpdatedAt(stationData?.lastUpdated ?? new Date().toISOString())}</span>
        </div>

        <div className={styles.connectionStatus}>
          <Wifi size={13} />
          <span>
            {selectedStation?.status === "online"
              ? "Connected"
              : "Disconnected"}
          </span>
        </div>
      </div>

      <section className={styles.filterBar}>
        <FilterSelect
          label="Farm"
          value={selectedFarmId}
          onChange={handleFarmChange}
          options={ownedFarms.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <FilterSelect
          label="Plot"
          value={selectedPlot?.id ?? ""}
          onChange={handlePlotChange}
          options={farmPlots.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <FilterSelect
          label="Station"
          value={selectedStation?.id ?? ""}
          onChange={handleStationChange}
          options={farmStations.map((item) => ({
            value: item.id,
            label: item.id,
          }))}
        />

        <div className={styles.filterItem}>
          <span>Depth:</span>
          <div className={styles.staticSelect}>
            <span>{currentDepth}cm</span>
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
              data={buildChartData(chart.field)}
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
              values={(soilHistory.nitrogen ?? []).map(
                (point) => point.value,
              )}
              className={styles.nitrogenLine}
            />

            <NpkLine
              values={(soilHistory.phosphorus ?? []).map(
                (point) => point.value,
              )}
              className={styles.phosphorusLine}
            />

            <NpkLine
              values={(soilHistory.potassium ?? []).map(
                (point) => point.value,
              )}
              className={styles.potassiumLine}
            />
          </div>
        </article>
      </section>

      {!farm && (
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