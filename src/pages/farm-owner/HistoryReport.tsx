import { useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
} from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/common/Button";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import PageHeader from "@/components/layout/PageHeader";

import LineChart, {
  type LineChartPoint,
} from "@/components/charts/LineChart";

import AreaChart from "@/components/charts/AreaChart";

import { farms } from "@/data/farms";
import { plots } from "@/data/plots";
import { stations } from "@/data/stations";
import { soilHistory } from "@/data/soilData";

import styles from "./HistoryReport.module.css";

const farmOwnerId = "USR-006";

type MetricKey = keyof typeof soilHistory;

const metricOptions: Array<{
  value: MetricKey;
  label: string;
  unit: string;
}> = [
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
    label: "pH",
    unit: "pH",
  },
  {
    value: "ec",
    label: "EC",
    unit: "µS/cm",
  },
];

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(value));
}

function downloadFile(
  content: string,
  filename: string,
  type: string,
) {
  const blob = new Blob([content], {
    type,
  });

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  anchor.click();

  URL.revokeObjectURL(url);
}

export default function HistoryReport() {
  const ownedFarms = useMemo(
    () =>
      farms.filter(
        (farm) =>
          farm.ownerId === farmOwnerId &&
          farm.status === "active",
      ),
    [],
  );

  const [farmId, setFarmId] =
    useState(ownedFarms[0]?.id ?? "");

  const [plotId, setPlotId] =
    useState("all");

  const [stationId, setStationId] =
    useState("all");

  const [metric, setMetric] =
    useState<MetricKey>("moisture");

  const [chartVariant, setChartVariant] =
    useState<"line" | "area">("line");

  const [dateRange, setDateRange] =
    useState<DateRange | undefined>();

  const farmPlots = plots.filter(
    (plot) =>
      plot.farmId === farmId,
  );

  const farmStations =
    stations.filter(
      (station) =>
        station.farmId === farmId,
    );

  const points = useMemo<
    LineChartPoint[]
  >(() => {
    const source =
      soilHistory[metric] ?? [];

    const from =
      dateRange?.from?.getTime();

    const to =
      dateRange?.to?.getTime();

    return source
      .filter((item) => {
        const timestamp =
          new Date(
            item.timestamp,
          ).getTime();

        if (
          from != null &&
          timestamp < from
        ) {
          return false;
        }

        if (
          to != null &&
          timestamp > to
        ) {
          return false;
        }

        return true;
      })
      .map((item) => ({
        label:
          new Intl.DateTimeFormat(
            "en-US",
            {
              hour: "2-digit",
              minute: "2-digit",
            },
          ).format(
            new Date(
              item.timestamp,
            ),
          ),

        value: item.value,

        timestamp:
          item.timestamp,

        quality:
          item.quality,
      }));
  }, [metric, dateRange]);

  const selectedMetric =
    metricOptions.find(
      (item) =>
        item.value === metric,
    ) ?? metricOptions[0];

  const statistics = useMemo(() => {
    const values = points
      .map(
        (point) => point.value,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );

    if (values.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        stdDev: 0,
      };
    }

    const average =
      values.reduce(
        (sum, value) =>
          sum + value,
        0,
      ) / values.length;

    const variance =
      values.reduce(
        (sum, value) =>
          sum +
          (value - average) ** 2,
        0,
      ) / values.length;

    return {
      average,
      min: Math.min(...values),
      max: Math.max(...values),
      stdDev: Math.sqrt(
        variance,
      ),
    };
  }, [points]);

  const exportReport = (
    format: "csv" | "excel",
  ) => {
    const headers = [
      "Timestamp",
      "Metric",
      "Value",
      "Unit",
      "Quality",
    ];

    const rows = points.map(
      (point) => [
        point.timestamp ?? "",
        selectedMetric.label,
        String(
          point.value ?? "",
        ),
        selectedMetric.unit,
        point.quality ?? "",
      ],
    );

    if (format === "csv") {
      const csv = [
        headers,
        ...rows,
      ]
        .map((row) =>
          row
            .map(
              (cell) =>
                `"${cell.replaceAll(
                  '"',
                  '""',
                )}"`,
            )
            .join(","),
        )
        .join("\n");

      downloadFile(
        csv,
        "soil-history-report.csv",
        "text/csv;charset=utf-8",
      );

      return;
    }

    const table = `
      <table>
        <thead>
          <tr>
            ${headers
              .map(
                (header) =>
                  `<th>${header}</th>`,
              )
              .join("")}
          </tr>
        </thead>

        <tbody>
          ${rows
            .map(
              (row) =>
                `<tr>
                  ${row
                    .map(
                      (cell) =>
                        `<td>${cell}</td>`,
                    )
                    .join("")}
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `;

    downloadFile(
      `<html><body>${table}</body></html>`,
      "soil-history-report.xls",
      "application/vnd.ms-excel",
    );
  };

  const handleFarmChange = (
    value: string,
  ) => {
    setFarmId(value);
    setPlotId("all");
    setStationId("all");
  };

  return (
    <main className={styles.page}>
      <PageHeader
        title="History & Report"
        description="Review historical soil trends and export farm reports."
        actions={
          <div
            className={
              styles.headerActions
            }
          >
            <Button
              variant="outline"
              size="sm"
              icon={
                <FileText size={15} />
              }
              onClick={() =>
                exportReport("csv")
              }
              disabled={
                points.length === 0
              }
            >
              Export CSV
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={
                <FileSpreadsheet
                  size={15}
                />
              }
              onClick={() =>
                exportReport("excel")
              }
              disabled={
                points.length === 0
              }
            >
              Export Excel
            </Button>
          </div>
        }
      />

      <section
        className={
          styles.filterCard
        }
      >
        <div
          className={
            styles.filterGrid
          }
        >
          <label>
            <span>Farm</span>

            <select
              value={farmId}
              onChange={(event) =>
                handleFarmChange(
                  event.target.value,
                )
              }
            >
              {ownedFarms.map(
                (farm) => (
                  <option
                    key={farm.id}
                    value={farm.id}
                  >
                    {farm.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>Plot</span>

            <select
              value={plotId}
              onChange={(event) =>
                setPlotId(
                  event.target.value,
                )
              }
            >
              <option value="all">
                All plots
              </option>

              {farmPlots.map(
                (plot) => (
                  <option
                    key={plot.id}
                    value={plot.id}
                  >
                    {plot.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>Station</span>

            <select
              value={stationId}
              onChange={(event) =>
                setStationId(
                  event.target.value,
                )
              }
            >
              <option value="all">
                All stations
              </option>

              {farmStations.map(
                (station) => (
                  <option
                    key={station.id}
                    value={station.id}
                  >
                    {station.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>Metric</span>

            <select
              value={metric}
              onChange={(event) =>
                setMetric(
                  event.target.value as MetricKey,
                )
              }
            >
              {metricOptions.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </label>

          <div
            className={
              styles.dateField
            }
          >
            <span>Date range</span>

            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder="Select date range"
            />
          </div>
        </div>
      </section>

      <section
        className={
          styles.chartCard
        }
      >
        <div
          className={
            styles.cardHeader
          }
        >
          <div>
            <div
              className={
                styles.titleWithIcon
              }
            >
              <BarChart3
                size={18}
              />

              <h2>
                {selectedMetric.label}
              </h2>
            </div>

            <p>
              Historical measurements
              for the selected
              reporting scope.
            </p>
          </div>

          <div
            className={
              styles.chartControls
            }
          >
            <button
              type="button"
              className={
                chartVariant ===
                "line"
                  ? styles.activeControl
                  : ""
              }
              onClick={() =>
                setChartVariant(
                  "line",
                )
              }
            >
              Line
            </button>

            <button
              type="button"
              className={
                chartVariant ===
                "area"
                  ? styles.activeControl
                  : ""
              }
              onClick={() =>
                setChartVariant(
                  "area",
                )
              }
            >
              Area
            </button>
          </div>
        </div>

        <div className={styles.chart}>
          {chartVariant ===
          "line" ? (
            <LineChart
              data={points}
              height={320}
              unit={
                selectedMetric.unit
              }
              showTooltip
              ariaLabel={`${selectedMetric.label} history`}
              emptyMessage="No historical data for the selected filters."
            />
          ) : (
            <AreaChart
              data={points}
              height={320}
              unit={
                selectedMetric.unit
              }
              showTooltip
              ariaLabel={`${selectedMetric.label} history`}
              emptyMessage="No historical data for the selected filters."
            />
          )}
        </div>

        <div
          className={
            styles.chartFooter
          }
        >
          <span>
            {points.length} measurements
          </span>

          {points.length > 0 && (
            <span>
              {formatTimestamp(
                points[0]
                  .timestamp ?? "",
              )}
              {" — "}
              {formatTimestamp(
                points[
                  points.length - 1
                ].timestamp ?? "",
              )}
            </span>
          )}
        </div>
      </section>

      <section
        className={
          styles.statsGrid
        }
      >
        <article>
          <TrendingUp size={18} />

          <span>Average</span>

          <strong>
            {statistics.average.toFixed(
              2,
            )}{" "}
            {selectedMetric.unit}
          </strong>
        </article>

        <article>
          <Download size={18} />

          <span>Minimum</span>

          <strong>
            {statistics.min.toFixed(
              2,
            )}{" "}
            {selectedMetric.unit}
          </strong>
        </article>

        <article>
          <Download size={18} />

          <span>Maximum</span>

          <strong>
            {statistics.max.toFixed(
              2,
            )}{" "}
            {selectedMetric.unit}
          </strong>
        </article>

        <article>
          <TrendingUp size={18} />

          <span>
            Standard deviation
          </span>

          <strong>
            {statistics.stdDev.toFixed(
              2,
            )}{" "}
            {selectedMetric.unit}
          </strong>
        </article>
      </section>

      <p className={styles.note}>
        Historical values are displayed
        from the current mock data source.
        Production API integration is not
        configured yet.
      </p>
    </main>
  );
}