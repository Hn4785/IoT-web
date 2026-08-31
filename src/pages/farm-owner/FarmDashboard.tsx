import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Droplets,
  Gauge,
  Leaf,
  MapPin,
  Thermometer,
  Wifi,
} from "lucide-react";

import { Button } from "@/components/common/Button";
import StatusBadge from "@/components/common/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";

import { farms } from "@/data/farms";
import { plots } from "@/data/plots";
import { stations } from "@/data/stations";
import { alerts } from "@/data/alerts";
import { latestSoilData } from "@/data/soilData";

import styles from "./FarmDashboard.module.css";

const farmOwnerId = "USR-006";

function formatValue(value?: number, digits = 1) {
  return value == null ? "—" : value.toFixed(digits);
}

function metricUnit(field: string) {
  switch (field) {
    case "temperature":
      return "°C";

    case "moisture":
      return "%";

    case "ec":
      return "µS/cm";

    case "ph":
      return "pH";

    default:
      return "mg/kg";
  }
}

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  return `${hours}h ago`;
}

export default function FarmDashboard() {
  const ownedFarms = useMemo(
    () =>
      farms.filter(
        (farm) =>
          farm.ownerId === farmOwnerId &&
          farm.status === "active",
      ),
    [],
  );

  const [selectedFarmId, setSelectedFarmId] = useState(
    ownedFarms[0]?.id ?? "",
  );

  const farm =
    ownedFarms.find((item) => item.id === selectedFarmId) ??
    ownedFarms[0];

  const farmPlots = useMemo(
    () =>
      plots.filter(
        (plot) => plot.farmId === farm?.id,
      ),
    [farm?.id],
  );

  const farmStations = useMemo(
    () =>
      stations.filter(
        (station) => station.farmId === farm?.id,
      ),
    [farm?.id],
  );

  const farmAlerts = useMemo(
    () =>
      alerts
        .filter(
          (alert) =>
            alert.farmId === farm?.id &&
            alert.status !== "resolved",
        )
        .sort(
          (a, b) =>
            new Date(b.triggeredAt).getTime() -
            new Date(a.triggeredAt).getTime(),
        ),
    [farm?.id],
  );

  const latestByPlot = useMemo(() => {
    const map = new Map<
      string,
      (typeof latestSoilData)[number]
    >();

    latestSoilData
      .filter(
        (item) => item.farmId === farm?.id,
      )
      .forEach((item) => {
        map.set(item.plotId, item);
      });

    return map;
  }, [farm?.id]);

  const onlineStations = farmStations.filter(
    (station) => station.status === "online",
  ).length;

  const activeStations = farmStations.filter(
    (station) => station.status !== "disabled",
  ).length;

  const warningAlerts = farmAlerts.filter(
    (alert) => alert.severity === "warning",
  ).length;

  const criticalAlerts = farmAlerts.filter(
    (alert) => alert.severity === "critical",
  ).length;

  const healthScore =
    farmStations.length === 0
      ? 0
      : Math.round(
          (onlineStations / farmStations.length) * 80 +
            Math.max(
              0,
              20 -
                criticalAlerts * 10 -
                warningAlerts * 3,
            ),
        );

  if (!farm) {
    return (
      <main className={styles.page}>
        <PageHeader
          title="Farm Dashboard"
          description="Monitor the health and soil conditions of your farm."
        />

        <section className={styles.emptyState}>
          <Leaf size={28} />

          <h2>No farm available</h2>

          <p>
            No active farm is currently assigned to
            this farm owner.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <PageHeader
        title="Farm Dashboard"
        description="Monitor your farm health, soil conditions, and recent alerts."
        actions={
          <label className={styles.selector}>
            <span>Farm</span>

            <select
              value={selectedFarmId}
              onChange={(event) =>
                setSelectedFarmId(event.target.value)
              }
              aria-label="Select farm"
            >
              {ownedFarms.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <section className={styles.farmSummary}>
        <div>
          <div className={styles.farmTitleRow}>
            <h2>{farm.name}</h2>

            <StatusBadge
              status={
                farm.status === "active"
                  ? "online"
                  : "offline"
              }
            />
          </div>

          <p className={styles.farmMeta}>
            <MapPin size={14} />

            {farm.address ??
              "Location not available"}

            {" · "}

            {farm.code}
          </p>
        </div>

        <div className={styles.healthScore}>
          <div
            className={styles.healthRing}
            aria-label={`Farm health ${healthScore}%`}
          >
            <strong>{healthScore}%</strong>
          </div>

          <div>
            <span>Farm Health</span>

            <small>
              Based on station availability and
              active alerts
            </small>
          </div>
        </div>
      </section>

      <section
        className={styles.kpiGrid}
        aria-label="Farm overview"
      >
        <article className={styles.kpiCard}>
          <span className={styles.kpiIcon}>
            <Leaf size={18} />
          </span>

          <span className={styles.kpiLabel}>
            Total Plots
          </span>

          <strong>{farmPlots.length}</strong>

          <small>
            Active agricultural plots
          </small>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiIcon}>
            <Gauge size={18} />
          </span>

          <span className={styles.kpiLabel}>
            Active Stations
          </span>

          <strong>{activeStations}</strong>

          <small>
            {farmStations.length} configured stations
          </small>
        </article>

        <article className={styles.kpiCard}>
          <span
            className={`${styles.kpiIcon} ${styles.successIcon}`}
          >
            <Wifi size={18} />
          </span>

          <span className={styles.kpiLabel}>
            Online Stations
          </span>

          <strong>{onlineStations}</strong>

          <small>
            {farmStations.length
              ? Math.round(
                  (onlineStations /
                    farmStations.length) *
                    100,
                )
              : 0}
            % availability
          </small>
        </article>

        <article className={styles.kpiCard}>
          <span
            className={`${styles.kpiIcon} ${styles.warningIcon}`}
          >
            <AlertTriangle size={18} />
          </span>

          <span className={styles.kpiLabel}>
            Warning Alerts
          </span>

          <strong>{warningAlerts}</strong>

          <small>
            Requires attention
          </small>
        </article>

        <article className={styles.kpiCard}>
          <span
            className={`${styles.kpiIcon} ${styles.dangerIcon}`}
          >
            <Activity size={18} />
          </span>

          <span className={styles.kpiLabel}>
            Critical Alerts
          </span>

          <strong>{criticalAlerts}</strong>

          <small>
            Priority actions
          </small>
        </article>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Plot Overview</h2>

            <p>
              Current soil conditions across your
              agricultural plots.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
          >
            Refresh
          </Button>
        </div>

        <div className={styles.plotGrid}>
          {farmPlots.map((plot) => {
            const data =
              latestByPlot.get(plot.id);

            const station =
              farmStations.find(
                (item) =>
                  item.plotId === plot.id,
              );

            const moisture =
              data?.telemetry.moisture;

            const temperature =
              data?.telemetry.temperature;

            const ph =
              data?.telemetry.ph;

            const ec =
              data?.telemetry.ec;

            const nitrogen =
              data?.telemetry.nitrogen;

            const phosphorus =
              data?.telemetry.phosphorus;

            const potassium =
              data?.telemetry.potassium;

            return (
              <article
                key={plot.id}
                className={styles.plotCard}
              >
                <div className={styles.plotHeader}>
                  <div>
                    <h3>{plot.name}</h3>

                    <span>
                      {plot.code}
                      {" · "}
                      {plot.crop ??
                        "Crop not specified"}
                    </span>
                  </div>

                  {station && (
                    <StatusBadge
                      status={station.status}
                      size="sm"
                    />
                  )}
                </div>

                <div
                  className={
                    styles.metricsGrid
                  }
                >
                  <div>
                    <Droplets size={15} />

                    <span>Moisture</span>

                    <strong>
                      {formatValue(
                        moisture?.value,
                      )}{" "}
                      {moisture
                        ? metricUnit("moisture")
                        : ""}
                    </strong>
                  </div>

                  <div>
                    <Thermometer size={15} />

                    <span>Temperature</span>

                    <strong>
                      {formatValue(
                        temperature?.value,
                      )}{" "}
                      {temperature
                        ? metricUnit(
                            "temperature",
                          )
                        : ""}
                    </strong>
                  </div>

                  <div>
                    <span
                      className={
                        styles.metricSymbol
                      }
                    >
                      pH
                    </span>

                    <span>pH</span>

                    <strong>
                      {formatValue(
                        ph?.value,
                        2,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span
                      className={
                        styles.metricSymbol
                      }
                    >
                      EC
                    </span>

                    <span>EC</span>

                    <strong>
                      {formatValue(
                        ec?.value,
                        0,
                      )}{" "}
                      {ec
                        ? metricUnit("ec")
                        : ""}
                    </strong>
                  </div>
                </div>

                <div className={styles.npkRow}>
                  <span>
                    N{" "}
                    <strong>
                      {formatValue(
                        nitrogen?.value,
                        0,
                      )}
                    </strong>
                  </span>

                  <span>
                    P{" "}
                    <strong>
                      {formatValue(
                        phosphorus?.value,
                        0,
                      )}
                    </strong>
                  </span>

                  <span>
                    K{" "}
                    <strong>
                      {formatValue(
                        potassium?.value,
                        0,
                      )}
                    </strong>
                  </span>
                </div>

                <div
                  className={styles.plotFooter}
                >
                  <span>
                    {station?.name ??
                      "No station assigned"}
                  </span>

                  <span>
                    {data
                      ? `Updated ${relativeTime(
                          data.lastUpdated,
                        )}`
                      : "No telemetry"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.alertSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Recent Alerts</h2>

            <p>
              Open alerts that may require your
              attention.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
          >
            View all alerts
          </Button>
        </div>

        {farmAlerts.length === 0 ? (
          <div className={styles.noAlerts}>
            <div>
              <Activity size={20} />
            </div>

            <div>
              <strong>
                No active alerts
              </strong>

              <p>
                Your farm currently has no
                unresolved alerts.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.alertList}>
            {farmAlerts
              .slice(0, 5)
              .map((alert) => {
                const station =
                  farmStations.find(
                    (item) =>
                      item.id ===
                      alert.stationId,
                  );

                const plot =
                  farmPlots.find(
                    (item) =>
                      item.id ===
                      alert.plotId,
                  );

                return (
                  <article
                    key={alert.id}
                    className={styles.alertRow}
                  >
                    <div
                      className={
                        styles.alertSeverity
                      }
                    >
                      <StatusBadge
                        status={alert.severity}
                        size="sm"
                      />
                    </div>

                    <div
                      className={
                        styles.alertContent
                      }
                    >
                      <strong>
                        {alert.title}
                      </strong>

                      <span>
                        {station?.name ??
                          "Unknown station"}
                        {" · "}
                        {plot?.name ??
                          "Unknown plot"}
                      </span>
                    </div>

                    <div
                      className={
                        styles.alertValue
                      }
                    >
                      {alert.currentValue !=
                      null
                        ? `${alert.currentValue} ${
                            alert.unit ?? ""
                          }`
                        : "—"}
                    </div>

                    <time
                      dateTime={
                        alert.triggeredAt
                      }
                    >
                      {relativeTime(
                        alert.triggeredAt,
                      )}
                    </time>
                  </article>
                );
              })}
          </div>
        )}
      </section>
    </main>
  );
}