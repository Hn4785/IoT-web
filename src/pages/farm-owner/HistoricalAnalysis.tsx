import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Download,
  Info,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";

import { farms } from "@/data/farms";
import { plots } from "@/data/plots";
import { stations } from "@/data/stations";
import { soilHistory } from "@/data/soilData";

import type { SoilField } from "@/types/soil";

import styles from "./HistoricalAnalysis.module.css";

const FARM_OWNER_ID = "USR-006";

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

const depths = [20, 40];

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

function buildSeries(
  stationIndex: number,
  depth: number,
  metric: SoilField,
) {
  const source = soilHistory[metric] ?? [];

  return source.map((point, index) => {
    const depthOffset =
      depth === 40 ? -index * 0.18 : index * 0.08;

    const stationOffset =
      stationIndex === 0
        ? 0
        : stationIndex === 1
          ? 1.2
          : 2.1;

    return Number(
      (point.value + depthOffset + stationOffset).toFixed(2),
    );
  });
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

  const farmPlots = plots.filter(
    (plot) => plot.farmId === selectedFarmId,
  );

  const [selectedPlotId, setSelectedPlotId] = useState(
    farmPlots[0]?.id ?? "",
  );

  const plotStations = stations.filter(
    (station) =>
      station.farmId === selectedFarmId &&
      station.plotId === selectedPlotId,
  );

  const [selectedMetric, setSelectedMetric] =
    useState<SoilField>("moisture");

  const [selectedDepths, setSelectedDepths] = useState<
    number[]
  >([20, 40]);

  const metric =
    metricOptions.find(
      (item) => item.value === selectedMetric,
    ) ?? metricOptions[0];

  const series = useMemo(() => {
    const stationList =
      plotStations.length > 0
        ? plotStations
        : stations.filter(
            (station) =>
              station.farmId === selectedFarmId,
          );

    return stationList
      .slice(0, 2)
      .flatMap((station, stationIndex) =>
        selectedDepths.map((depth) => ({
          id: `${station.id}-${depth}`,
          label: `${station.id} (${depth}cm)`,
          values: buildSeries(
            stationIndex,
            depth,
            selectedMetric,
          ),
        })),
      );
  }, [
    plotStations,
    selectedFarmId,
    selectedDepths,
    selectedMetric,
  ]);

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
          <button className={styles.exportButton}>
            <Download size={13} />
            Export CSV
          </button>
        }
      />

      <section className={styles.filterBar}>
        <SelectBox
          label="Farm"
          value={selectedFarmId}
          onChange={(event) => {
            const farmId = event.target.value;
            setSelectedFarmId(farmId);

            const nextPlot = plots.find(
              (plot) => plot.farmId === farmId,
            );

            setSelectedPlotId(nextPlot?.id ?? "");
          }}
        >
          {ownedFarms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </SelectBox>

        <SelectBox
          label="Plot"
          value={selectedPlotId}
          onChange={(event) =>
            setSelectedPlotId(event.target.value)
          }
        >
          {farmPlots.map((plot) => (
            <option key={plot.id} value={plot.id}>
              {plot.name}
            </option>
          ))}
        </SelectBox>

        <div className={styles.filter}>
          <span>Stations:</span>
          <div className={styles.staticFilter}>
            {plotStations.length > 0
              ? plotStations.map((station) => station.id).join(", ")
              : "All Stations"}
          </div>
        </div>

        <div className={styles.filter}>
          <span>Depths:</span>

          <div className={styles.depthSelector}>
            {depths.map((depth) => (
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

                const [stationId, depthText] =
                  item.label.split(" ");

                return (
                  <tr key={item.id}>
                    <td>{stationId}</td>
                    <td>{depthText?.replace(/[()]/g, "")}</td>
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