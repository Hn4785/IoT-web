import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";

import { alerts } from "@/data/alerts";
import { farms } from "@/data/farms";
import { plots } from "@/data/plots";
import { stations } from "@/data/stations";

import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
} from "@/types/alert";

import styles from "./AgriculturalAlerts.module.css";

const FARM_OWNER_ID = "USR-006";

const alertTypeLabels: Record<AlertType, string> = {
  soil_moisture: "Soil Moisture",
  temperature: "Temperature",
  ph: "pH Level",
  ec: "EC Conductivity",
  npk: "NPK",
  offline: "Offline",
  low_battery: "Low Battery",
  sensor_error: "Sensor Error",
  signal_loss: "Signal Loss",
  stale_data: "Stale Data",
  calibration_expired: "Calibration Expired",
};

function formatDuration(seconds?: number) {
  if (!seconds) return "—";

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return `${hours}h ${remaining}m`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default function AgriculturalAlerts() {
  const ownedFarms = useMemo(
    () =>
      farms.filter(
        (farm) =>
          farm.ownerId === FARM_OWNER_ID &&
          farm.status === "active",
      ),
    [],
  );

  const ownedFarmIds = new Set(
    ownedFarms.map((farm) => farm.id),
  );

  const farmAlerts = alerts.filter(
    (alert) =>
      alert.farmId &&
      ownedFarmIds.has(alert.farmId),
  );

  const [category, setCategory] = useState<"all" | AlertType>(
    "all",
  );

  const [severity, setSeverity] = useState<
    "all" | AlertSeverity
  >("all");

  const [status, setStatus] = useState<
    "active" | "acknowledged" | "all"
  >("active");

  const [search, setSearch] = useState("");

  const [localStatuses, setLocalStatuses] =
    useState<Record<string, AlertStatus>>({});

  const filteredAlerts = farmAlerts.filter((alert) => {
    const currentStatus =
      localStatuses[alert.id] ?? alert.status;

    const categoryMatch =
      category === "all" || alert.type === category;

    const severityMatch =
      severity === "all" ||
      alert.severity === severity;

    const statusMatch =
      status === "all" ||
      (status === "active"
        ? currentStatus !== "resolved"
        : currentStatus === "acknowledged");

    const text =
      `${alert.title} ${alert.stationId ?? ""} ${
        alert.metric ?? ""
      }`.toLowerCase();

    const searchMatch =
      !search.trim() ||
      text.includes(search.toLowerCase());

    return (
      categoryMatch &&
      severityMatch &&
      statusMatch &&
      searchMatch
    );
  });

  const totalAlerts = farmAlerts.length;

  const warningAlerts = farmAlerts.filter(
    (alert) => alert.severity === "warning",
  ).length;

  const criticalAlerts = farmAlerts.filter(
    (alert) => alert.severity === "critical",
  ).length;

  const acknowledgedAlerts = farmAlerts.filter(
    (alert) =>
      (localStatuses[alert.id] ?? alert.status) ===
      "acknowledged",
  ).length;

  const acknowledge = (alertId: string) => {
    setLocalStatuses((current) => ({
      ...current,
      [alertId]: "acknowledged",
    }));
  };

  return (
    <main className={styles.page}>
      <PageHeader
        title="Agricultural Alerts"
        description="Monitor IoT-triggered warnings, soil telemetry thresholds and trigger policies."
      />

      <section className={styles.filterBar}>
        <Filter size={13} />

        <FilterSelect
          label="Category"
          value={category}
          onChange={(event) =>
            setCategory(
              event.target.value as "all" | AlertType,
            )
          }
        >
          <option value="all">All Telemetry</option>

          {Object.entries(alertTypeLabels).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </FilterSelect>

        <FilterSelect
          label="Severity"
          value={severity}
          onChange={(event) =>
            setSeverity(
              event.target.value as
                | "all"
                | AlertSeverity,
            )
          }
        >
          <option value="all">All</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </FilterSelect>

        <FilterSelect
          label="Status"
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value as
                | "active"
                | "acknowledged"
                | "all",
            )
          }
        >
          <option value="active">
            Active & Acknowledged
          </option>
          <option value="acknowledged">
            Acknowledged
          </option>
          <option value="all">All</option>
        </FilterSelect>

        <div className={styles.dateFilter}>
          Last 7 Days
          <ChevronDown size={12} />
        </div>

        <label className={styles.search}>
          <Search size={12} />
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search alerts..."
          />
        </label>
      </section>

      <section className={styles.kpiGrid}>
        <KpiCard
          title="Total Alerts"
          value={totalAlerts}
          helper="Triggered past week"
          tone="neutral"
        />

        <KpiCard
          title="Warning Alerts"
          value={warningAlerts}
          helper="Requires attention"
          tone="warning"
        />

        <KpiCard
          title="Critical Alerts"
          value={criticalAlerts}
          helper="Action required"
          tone="critical"
        />

        <KpiCard
          title="Acknowledged"
          value={acknowledgedAlerts}
          helper="Under review"
          tone="info"
        />
      </section>

      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div>Alert / Issue</div>
          <div>Station</div>
          <div>Plot</div>
          <div>Metric</div>
          <div>Current Value</div>
          <div>Threshold</div>
          <div>Triggered At</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className={styles.empty}>
            No alerts match the selected filters.
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const currentStatus =
              localStatuses[alert.id] ?? alert.status;

            const plot = plots.find(
              (item) => item.id === alert.plotId,
            );

            const station = stations.find(
              (item) => item.id === alert.stationId,
            );

            return (
              <div
                className={styles.tableRow}
                key={alert.id}
              >
                <div className={styles.alertCell}>
                  <strong>{alert.title}</strong>
                  <span>
                    {alert.description ??
                      "Telemetry threshold condition detected."}
                  </span>
                </div>

                <div>{station?.id ?? alert.stationId ?? "—"}</div>

                <div>
                  {plot?.name ?? alert.plotId ?? "—"}
                </div>

                <div>
                  {alert.metric
                    ? alertTypeLabels[
                        alert.metric as AlertType
                      ] ?? alert.metric
                    : alertTypeLabels[alert.type]}
                </div>

                <div className={styles.value}>
                  {alert.currentValue != null
                    ? `${alert.currentValue} ${alert.unit ?? ""}`
                    : "N/A"}
                </div>

                <div>
                  {alert.threshold != null
                    ? `${alert.threshold} ${alert.unit ?? ""}`
                    : "—"}
                </div>

                <div className={styles.date}>
                  {formatDate(alert.triggeredAt)}
                </div>

                <div>
                  <StatusBadge
                    status={
                      currentStatus === "resolved"
                        ? "resolved"
                        : alert.severity
                    }
                    size="sm"
                  />
                </div>

                <div className={styles.actions}>
                  {currentStatus !== "acknowledged" &&
                    currentStatus !== "resolved" && (
                      <button
                        type="button"
                        onClick={() =>
                          acknowledge(alert.id)
                        }
                        className={styles.ackButton}
                      >
                        Ack
                      </button>
                    )}

                  <button
                    type="button"
                    className={styles.detailButton}
                    title={`Duration ${formatDuration(alert.duration)}`}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => void;
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

function KpiCard({
  title,
  value,
  helper,
  tone,
}: {
  title: string;
  value: number;
  helper: string;
  tone: "neutral" | "warning" | "critical" | "info";
}) {
  return (
    <article
      className={`${styles.kpiCard} ${styles[tone]}`}
    >
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}