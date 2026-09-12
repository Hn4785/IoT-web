import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CircleAlert,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import AlertTable from "@/components/alerts/AlertTable";
import AlertDetail from "@/components/alerts/AlertDetail";
import Drawer from "@/components/common/Drawer";
import StatusBadge from "@/components/common/StatusBadge";

import { alerts } from "@/data/alerts";
import { stations } from "@/data/stations";

import type {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertType,
} from "@/types/alert";

import styles from "./AdminAlertCenter.module.css";

const technicalTypes: AlertType[] = [
  "offline",
  "low_battery",
  "sensor_error",
  "signal_loss",
  "stale_data",
  "calibration_expired",
];

const typeLabels: Record<
  string,
  string
> = {
  offline: "Offline",
  low_battery: "Low Battery",
  sensor_error: "Sensor Error",
  signal_loss: "Signal Loss",
  stale_data: "Stale Data",
  calibration_expired:
    "Calibration Expired",
};

export default function AdminAlertCenter() {
  const [severity, setSeverity] =
    useState<
      "all" | AlertSeverity
    >("all");

  const [type, setType] =
    useState<
      "all" | AlertType
    >("all");

  const [station, setStation] =
    useState("all");

  const [status, setStatus] =
    useState<
      "all" | AlertStatus
    >("all");

  const [selected, setSelected] =
    useState<Alert | null>(null);

  const technicalAlerts =
    useMemo(
      () =>
        alerts.filter((alert) =>
          technicalTypes.includes(
            alert.type,
          ),
        ),
      [],
    );

  const visible =
    useMemo(
      () =>
        technicalAlerts.filter(
          (alert) =>
            (
              severity ===
                "all" ||
              alert.severity ===
                severity
            ) &&
            (
              type === "all" ||
              alert.type === type
            ) &&
            (
              station === "all" ||
              alert.stationId ===
                station
            ) &&
            (
              status === "all" ||
              alert.status === status
            ),
        ),
      [
        severity,
        station,
        status,
        technicalAlerts,
        type,
      ],
    );

  const activeCount =
    technicalAlerts.filter(
      (alert) =>
        alert.status !==
        "resolved",
    ).length;

  const criticalCount =
    technicalAlerts.filter(
      (alert) =>
        alert.severity ===
          "critical" &&
        alert.status !==
          "resolved",
    ).length;

  const warningCount =
    technicalAlerts.filter(
      (alert) =>
        alert.severity ===
          "warning" &&
        alert.status !==
          "resolved",
    ).length;

  const acknowledgedCount =
    technicalAlerts.filter(
      (alert) =>
        alert.status ===
          "acknowledged" ||
        alert.status ===
          "assigned",
    ).length;

  const updateStatus = (
    alert: Alert,
    next: AlertStatus,
  ) => {
    /*
     * UI-only state.
     *
     * Backend alert mutation API
     * is not available yet.
     */
    setSelected({
      ...alert,
      status: next,
    });
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Alert Center"
        description="Review technical alerts affecting station connectivity, sensors, signal, battery, and calibration."
      />

      {/* =========================
          SUMMARY
      ========================== */}

      <section className={styles.stats}>
        <Stat
          icon={BellRing}
          label="Active Alerts"
          value={activeCount}
        />

        <Stat
          icon={CircleAlert}
          label="Critical Priority"
          value={criticalCount}
          tone="critical"
        />

        <Stat
          icon={AlertTriangle}
          label="Warning Priority"
          value={warningCount}
          tone="warning"
        />

        <Stat
          icon={CheckCircle2}
          label="Acknowledged"
          value={acknowledgedCount}
          tone="info"
        />
      </section>

      {/* =========================
          ALERT TABLE
      ========================== */}

      <section className={styles.panel}>
        <div className={styles.filters}>
          <select
            value={severity}
            onChange={(event) =>
              setSeverity(
                event.target
                  .value as
                  | "all"
                  | AlertSeverity,
              )
            }
          >
            <option value="all">
              All Severity
            </option>

            <option value="critical">
              Critical
            </option>

            <option value="warning">
              Warning
            </option>
          </select>

          <select
            value={type}
            onChange={(event) =>
              setType(
                event.target
                  .value as
                  | "all"
                  | AlertType,
              )
            }
          >
            <option value="all">
              All Alert Types
            </option>

            {technicalTypes.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {typeLabels[item]}
                </option>
              ),
            )}
          </select>

          <select
            value={station}
            onChange={(event) =>
              setStation(
                event.target.value,
              )
            }
          >
            <option value="all">
              All Stations
            </option>

            {stations.map(
              (item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.id} —{" "}
                  {item.name}
                </option>
              ),
            )}
          </select>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target
                  .value as
                  | "all"
                  | AlertStatus,
              )
            }
          >
            <option value="all">
              All Status
            </option>

            <option value="open">
              Open
            </option>

            <option value="acknowledged">
              Acknowledged
            </option>

            <option value="assigned">
              Assigned
            </option>

            <option value="resolved">
              Resolved
            </option>
          </select>
        </div>

        <div
          className={
            styles.tableTitle
          }
        >
          <div>
            <h2>
              Technical Alerts
            </h2>

            <span>
              {visible.length} alert
              {visible.length === 1
                ? ""
                : "s"}{" "}
              shown
            </span>
          </div>

          <StatusBadge
            status={
              activeCount > 0
                ? "warning"
                : "valid"
            }
            label={
              activeCount > 0
                ? `${activeCount} active`
                : "All clear"
            }
            size="sm"
          />
        </div>

        <AlertTable
          alerts={visible}
          onView={setSelected}
          onAcknowledge={(
            alert,
          ) =>
            updateStatus(
              alert,
              "acknowledged",
            )
          }
          onAssign={(alert) =>
            updateStatus(
              alert,
              "assigned",
            )
          }
          onResolve={(alert) =>
            updateStatus(
              alert,
              "resolved",
            )
          }
          showActions
        />
      </section>

      {/* =========================
          DETAIL DRAWER
      ========================== */}

      <Drawer
        isOpen={Boolean(
          selected,
        )}
        onClose={() =>
          setSelected(null)
        }
        title={
          selected
            ? "Alert Details"
            : undefined
        }
        size="lg"
      >
        {selected && (
          <AlertDetail
            alert={selected}
            onClose={() =>
              setSelected(null)
            }
            onAcknowledge={(
              alert,
            ) =>
              updateStatus(
                alert,
                "acknowledged",
              )
            }
            onAssign={(alert) =>
              updateStatus(
                alert,
                "assigned",
              )
            }
            onResolve={(alert) =>
              updateStatus(
                alert,
                "resolved",
              )
            }
          />
        )}
      </Drawer>
    </div>
  );
}

/* =========================
   STAT CARD
========================= */

function Stat({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof BellRing;
  label: string;
  value: number;
  tone?:
    | "default"
    | "critical"
    | "warning"
    | "info";
}) {
  return (
    <article
      className={`${styles.stat} ${styles[tone]}`}
    >
      <div className={styles.icon}>
        <Icon size={18} />
      </div>

      <span>{label}</span>

      <strong>{value}</strong>
    </article>
  );
}