import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BatteryLow,
  CheckCircle2,
  CircleAlert,
  Eye,
  Radio,
  Search,
  ShieldAlert,
  WifiOff,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/common/Button";
import StatusBadge from "@/components/common/StatusBadge";

import { stations } from "@/data/stations";
import { sensors } from "@/data/sensors";
import { farms } from "@/data/farms";
import { plots } from "@/data/plots";

import styles from "./DeviceHealth.module.css";

type ProblemFilter =
  | "all"
  | "low_battery"
  | "sensor_error"
  | "calibration"
  | "signal"
  | "stale";

const formatLastSeen = (value?: string) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getProblem = (
  stationId: string,
  problem: ProblemFilter,
): boolean => {
  const station = stations.find(
    (item) => item.id === stationId,
  );

  const stationSensors = sensors.filter(
    (sensor) => sensor.stationId === stationId,
  );

  if (!station) {
    return false;
  }

  if (problem === "low_battery") {
    return (station.batteryPercent ?? 100) < 20;
  }

  if (problem === "sensor_error") {
    return (
      station.sensorErrorCount > 0 ||
      stationSensors.some(
        (sensor) => sensor.status === "error",
      )
    );
  }

  if (problem === "calibration") {
    return (
      station.calibrationStatus === "expired" ||
      station.calibrationStatus === "uncalibrated"
    );
  }

  if (problem === "signal") {
    return (station.rssiDbm ?? 0) <= -85;
  }

  if (problem === "stale") {
    return station.status === "stale";
  }

  return false;
};

export default function DeviceHealth() {
  const [query, setQuery] = useState("");
  const [farmId, setFarmId] = useState("all");
  const [status, setStatus] = useState("all");

  const [problem, setProblem] =
    useState<ProblemFilter>("all");

  const [firmware, setFirmware] = useState("all");

  const firmwareOptions = useMemo(
    () =>
      [
        ...new Set(
          stations
            .map(
              (station) =>
                station.firmwareVersion,
            )
            .filter(Boolean),
        ),
      ] as string[],
    [],
  );

  const visibleStations = useMemo(() => {
    const q = query.trim().toLowerCase();

    return stations.filter((station) => {
      const matchesQuery =
        !q ||
        `${station.id} ${station.name}`
          .toLowerCase()
          .includes(q);

      const matchesFarm =
        farmId === "all" ||
        station.farmId === farmId;

      const matchesStatus =
        status === "all" ||
        station.status === status;

      const matchesProblem =
        problem === "all" ||
        getProblem(
          station.id,
          problem,
        );

      const matchesFirmware =
        firmware === "all" ||
        station.firmwareVersion === firmware;

      return (
        matchesQuery &&
        matchesFarm &&
        matchesStatus &&
        matchesProblem &&
        matchesFirmware
      );
    });
  }, [
    farmId,
    firmware,
    problem,
    query,
    status,
  ]);

  const stats = useMemo(
    () => ({
      online: stations.filter(
        (station) =>
          station.status === "online",
      ).length,

      offline: stations.filter(
        (station) =>
          station.status === "offline",
      ).length,

      lowBattery: stations.filter(
        (station) =>
          (station.batteryPercent ?? 100) < 20,
      ).length,

      stale: stations.filter(
        (station) =>
          station.status === "stale",
      ).length,

      sensorErrors: stations.filter(
        (station) =>
          station.sensorErrorCount > 0,
      ).length,

      calibration: stations.filter(
        (station) =>
          station.calibrationStatus ===
            "expired" ||
          station.calibrationStatus ===
            "uncalibrated",
      ).length,
    }),
    [],
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Device Health"
        description="Monitor station connectivity, power, signal quality, sensor errors, and calibration status."
      />

      {/* =========================
          STATISTICS
      ========================== */}

      <section
        className={styles.stats}
        aria-label="Device health summary"
      >
        <Stat
          icon={CheckCircle2}
          label="Stations Online"
          value={stats.online}
          tone="success"
        />

        <Stat
          icon={WifiOff}
          label="Stations Offline"
          value={stats.offline}
          tone="danger"
        />

        <Stat
          icon={BatteryLow}
          label="Low Battery (<20%)"
          value={stats.lowBattery}
          tone="warning"
        />

        <Stat
          icon={AlertTriangle}
          label="Stale Data"
          value={stats.stale}
          tone="warning"
        />

        <Stat
          icon={CircleAlert}
          label="Sensor Errors"
          value={stats.sensorErrors}
          tone="danger"
        />

        <Stat
          icon={ShieldAlert}
          label="Calibration Expired"
          value={stats.calibration}
          tone="danger"
        />
      </section>

      {/* =========================
          MAIN PANEL
      ========================== */}

      <section className={styles.panel}>
        {/* FILTERS */}

        <div className={styles.filters}>
          <label className={styles.search}>
            <Search
              size={16}
              aria-hidden="true"
            />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search Station ID or name..."
              aria-label="Search Station ID or name"
            />
          </label>

          <select
            value={farmId}
            onChange={(event) =>
              setFarmId(event.target.value)
            }
            aria-label="Farm"
          >
            <option value="all">
              All Farms
            </option>

            {farms.map((farm) => (
              <option
                key={farm.id}
                value={farm.id}
              >
                {farm.name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
            aria-label="Status"
          >
            <option value="all">
              All Statuses
            </option>

            <option value="online">
              Online
            </option>

            <option value="offline">
              Offline
            </option>

            <option value="stale">
              Stale
            </option>

            <option value="maintenance">
              Maintenance
            </option>

            <option value="disabled">
              Disabled
            </option>
          </select>

          <select
            value={problem}
            onChange={(event) =>
              setProblem(
                event.target
                  .value as ProblemFilter,
              )
            }
            aria-label="Problem type"
          >
            <option value="all">
              All Problems
            </option>

            <option value="low_battery">
              Low Battery
            </option>

            <option value="sensor_error">
              Sensor Error
            </option>

            <option value="calibration">
              Calibration
            </option>

            <option value="signal">
              Weak Signal
            </option>

            <option value="stale">
              Stale Data
            </option>
          </select>

          <select
            value={firmware}
            onChange={(event) =>
              setFirmware(
                event.target.value,
              )
            }
            aria-label="Firmware"
          >
            <option value="all">
              All Firmware
            </option>

            {firmwareOptions.map(
              (version) => (
                <option
                  key={version}
                  value={version}
                >
                  {version}
                </option>
              ),
            )}
          </select>
        </div>

        {/* TABLE HEADER */}

        <div className={styles.tableHeader}>
          <div>
            <h2>Station Health</h2>

            <span>
              {visibleStations.length}{" "}
              station
              {visibleStations.length === 1
                ? ""
                : "s"}{" "}
              shown
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
          >
            Refresh
          </Button>
        </div>

        {/* TABLE */}

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Station</th>
                <th>Farm / Plot</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Battery</th>
                <th>RSSI</th>
                <th>Firmware</th>
                <th>Sensor Errors</th>
                <th>Calibration</th>
                <th aria-label="Action" />
              </tr>
            </thead>

            <tbody>
              {visibleStations.map(
                (station) => {
                  const plot =
                    plots.find(
                      (item) =>
                        item.id ===
                        station.plotId,
                    );

                  const farm =
                    farms.find(
                      (item) =>
                        item.id ===
                        station.farmId,
                    );

                  const sensorError =
                    station.sensorErrorCount >
                    0;

                  const lowBattery =
                    (station.batteryPercent ??
                      100) < 20;

                  return (
                    <tr
                      key={station.id}
                    >
                      {/* STATION */}

                      <td>
                        <div
                          className={
                            styles.stationCell
                          }
                        >
                          <strong>
                            {station.name}
                          </strong>

                          <span
                            className={
                              styles.mono
                            }
                          >
                            {station.id}
                          </span>
                        </div>
                      </td>

                      {/* FARM / PLOT */}

                      <td>
                        <div
                          className={
                            styles.locationCell
                          }
                        >
                          <strong>
                            {farm?.name ??
                              station.farmId}
                          </strong>

                          <span>
                            {plot?.name ??
                              station.plotId}
                          </span>
                        </div>
                      </td>

                      {/* STATUS */}

                      <td>
                        <StatusBadge
                          status={
                            station.status
                          }
                          size="sm"
                        />
                      </td>

                      {/* LAST SEEN */}

                      <td>
                        {formatLastSeen(
                          station.lastSeen,
                        )}
                      </td>

                      {/* BATTERY */}

                      <td>
                        <span
                          className={
                            lowBattery
                              ? styles.dangerValue
                              : ""
                          }
                        >
                          {station.batteryPercent ??
                            "—"}
                          %
                        </span>
                      </td>

                      {/* RSSI */}

                      <td>
                        <span
                          className={
                            (station.rssiDbm ??
                              0) <= -85
                              ? styles.dangerValue
                              : ""
                          }
                        >
                          {station.rssiDbm ??
                            "—"}{" "}
                          dBm
                        </span>
                      </td>

                      {/* FIRMWARE */}

                      <td
                        className={
                          styles.mono
                        }
                      >
                        {station.firmwareVersion ??
                          "—"}
                      </td>

                      {/* SENSOR ERROR */}

                      <td>
                        <span
                          className={
                            sensorError
                              ? styles.errorCount
                              : styles.okValue
                          }
                        >
                          {
                            station.sensorErrorCount
                          }
                        </span>
                      </td>

                      {/* CALIBRATION */}

                      <td>
                        <StatusBadge
                          status={
                            station.calibrationStatus ??
                            "valid"
                          }
                          size="sm"
                        />
                      </td>

                      {/* ACTION */}

                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={
                            <Eye
                              size={15}
                            />
                          }
                          onClick={() =>
                            window.location.assign(
                              `/admin/stations/${station.id}`,
                            )
                          }
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                },
              )}

              {visibleStations.length ===
                0 && (
                <tr>
                  <td
                    colSpan={10}
                  >
                    <div
                      className={
                        styles.empty
                      }
                    >
                      No stations match the
                      selected filters.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
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
  tone,
}: {
  icon: typeof Radio;
  label: string;
  value: number;
  tone:
    | "success"
    | "danger"
    | "warning";
}) {
  return (
    <article
      className={`${styles.stat} ${styles[tone]}`}
    >
      <div className={styles.statIcon}>
        <Icon size={18} />
      </div>

      <span>{label}</span>

      <strong>{value}</strong>
    </article>
  );
}