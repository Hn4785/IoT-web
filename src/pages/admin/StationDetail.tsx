import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Battery,
  CalendarClock,
  MapPin,
  Radio,
  Settings2,
  TestTube2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import Button from "@/components/common/Button";
import StatusBadge from "@/components/common/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";

import { stations } from "@/data/stations";
import { farms } from "@/data/farms";
import { plots } from "@/data/plots";
import { gateways } from "@/data/gateways";
import { sensors } from "@/data/sensors";

import styles from "./StationDetail.module.css";

function formatDateTime(value?: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function StationDetail() {
  const { stationId } = useParams();

  const navigate = useNavigate();

  const station = stations.find(
    (item) => item.id === stationId,
  );

  const gateway = useMemo(
    () =>
      gateways.find(
        (item) =>
          item.id === station?.gatewayId,
      ),
    [station?.gatewayId],
  );

  const farm = farms.find(
    (item) => item.id === station?.farmId,
  );

  const plot = plots.find(
    (item) => item.id === station?.plotId,
  );

  const stationSensors = sensors.filter(
    (sensor) =>
      station?.sensorIds.includes(
        sensor.id,
      ),
  );

  /*
   * =========================
   * STATION NOT FOUND
   * =========================
   */

  if (!station) {
    return (
      <div className={styles.page}>
        <Button
          variant="ghost"
          icon={<ArrowLeft size={16} />}
          onClick={() =>
            navigate("/admin/device-health")
          }
        >
          Back
        </Button>

        <section className={styles.notFound}>
          <h1>Station not found</h1>

          <p>
            The requested station does not
            exist in the current dataset.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* =========================
          BACK BUTTON
      ========================== */}

      <Button
        variant="ghost"
        size="sm"
        icon={<ArrowLeft size={15} />}
        onClick={() =>
          navigate("/admin/device-health")
        }
      >
        Device Health
      </Button>

      {/* =========================
          PAGE HEADER
      ========================== */}

      <PageHeader
        title={station.name}
        description={`${station.id} · ${
          farm?.name ?? station.farmId
        } · ${
          plot?.name ?? station.plotId
        }`}
        actions={
          <div className={styles.actions}>
            <Button
              variant="outline"
              icon={
                <TestTube2 size={16} />
              }
            >
              Trigger Test Reading
            </Button>

            <Button
              icon={
                <Settings2 size={16} />
              }
            >
              Edit Node Config
            </Button>
          </div>
        }
      />

      {/* =========================
          STATION SUMMARY
      ========================== */}

      <section className={styles.hero}>
        <div className={styles.heroIdentity}>
          <div
            className={
              styles.stationAvatar
            }
          >
            <Radio size={24} />
          </div>

          <div>
            <div className={styles.idLine}>
              <span
                className={styles.mono}
              >
                {station.id}
              </span>

              <StatusBadge
                status={station.status}
                size="sm"
              />
            </div>

            <h2>{station.name}</h2>

            <p>
              {farm?.name ??
                station.farmId}{" "}
              /{" "}
              {plot?.name ??
                station.plotId}
            </p>
          </div>
        </div>

        <div className={styles.lastSeen}>
          <span>Last Seen</span>

          <strong>
            {formatDateTime(
              station.lastSeen,
            )}
          </strong>
        </div>
      </section>

      {/* =========================
          INFORMATION CARDS
      ========================== */}

      <section className={styles.grid}>
        <InfoCard
          label="Gateway"
          value={
            gateway?.id ??
            station.gatewayId ??
            "—"
          }
          sub={gateway?.serialNumber}
        />

        <InfoCard
          label="Firmware"
          value={
            station.firmwareVersion ??
            "—"
          }
          sub={gateway?.protocol?.toUpperCase()}
        />

        <InfoCard
          label="Battery"
          value={`${station.batteryPercent ?? "—"}%`}
          sub="Station battery"
        >
          <Battery size={18} />
        </InfoCard>

        <InfoCard
          label="Signal Strength"
          value={`${station.rssiDbm ?? "—"} dBm`}
          sub={
            station.rssiDbm &&
            station.rssiDbm <= -85
              ? "Weak signal"
              : "Healthy signal"
          }
        >
          <Radio size={18} />
        </InfoCard>

        <InfoCard
          label="Active Config"
          value="CFG-2026.08.4"
          sub="Current version"
        />

        <InfoCard
          label="Location"
          value={
            station.location
              ? `${station.location.latitude.toFixed(
                  4,
                )}, ${station.location.longitude.toFixed(
                  4,
                )}`
              : "—"
          }
          sub="GPS coordinates"
        >
          <MapPin size={18} />
        </InfoCard>
      </section>

      {/* =========================
          CONNECTED SENSORS
      ========================== */}

      <section className={styles.panel}>
        <div
          className={
            styles.sectionHeader
          }
        >
          <div>
            <h2>
              Connected Sensors
            </h2>

            <p>
              {stationSensors.length}{" "}
              sensors assigned to this
              station
            </p>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Sensor ID</th>
                <th>Type</th>
                <th>Model</th>
                <th>Depth</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Calibration</th>
              </tr>
            </thead>

            <tbody>
              {stationSensors.map(
                (sensor) => (
                  <tr key={sensor.id}>
                    <td
                      className={
                        styles.mono
                      }
                    >
                      {sensor.id}
                    </td>

                    <td>
                      {sensor.field}
                    </td>

                    <td
                      className={
                        styles.mono
                      }
                    >
                      {sensor.model}
                    </td>

                    <td>
                      {sensor.depth !==
                      undefined
                        ? `${sensor.depth} ${
                            sensor.depthUnit ??
                            "cm"
                          }`
                        : "—"}
                    </td>

                    <td>
                      {sensor.unit}
                    </td>

                    <td>
                      <StatusBadge
                        status={
                          sensor.status
                        }
                        size="sm"
                      />
                    </td>

                    <td>
                      <StatusBadge
                        status={
                          sensor
                            .calibration
                            ?.status ??
                          "uncalibrated"
                        }
                        size="sm"
                      />
                    </td>
                  </tr>
                ),
              )}

              {stationSensors.length ===
                0 && (
                <tr>
                  <td
                    colSpan={7}
                    className={
                      styles.emptyCell
                    }
                  >
                    No sensors assigned
                    to this station.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* =========================
          LOWER TWO COLUMNS
      ========================== */}

      <section className={styles.twoCol}>
        {/* CALIBRATION */}

        <section className={styles.panel}>
          <div
            className={
              styles.sectionHeader
            }
          >
            <div>
              <h2>
                Calibration Records
              </h2>

              <p>
                Latest calibration state
                by sensor
              </p>
            </div>
          </div>

          <div className={styles.records}>
            {stationSensors.map(
              (sensor) => (
                <article
                  className={
                    styles.record
                  }
                  key={`${sensor.id}-calibration`}
                >
                  <div
                    className={
                      styles.recordIcon
                    }
                  >
                    <CalendarClock
                      size={17}
                    />
                  </div>

                  <div
                    className={
                      styles.recordBody
                    }
                  >
                    <div
                      className={
                        styles.recordTop
                      }
                    >
                      <strong>
                        {sensor.id}
                      </strong>

                      <StatusBadge
                        status={
                          sensor
                            .calibration
                            ?.status ??
                          "uncalibrated"
                        }
                        size="sm"
                      />
                    </div>

                    <span>
                      Calibrated:{" "}
                      {formatDateTime(
                        sensor
                          .calibration
                          ?.calibratedAt,
                      )}
                    </span>

                    <span>
                      Expires:{" "}
                      {formatDateTime(
                        sensor
                          .calibration
                          ?.expiresAt,
                      )}
                    </span>

                    {sensor.calibration
                      ?.conversionFactor !==
                      undefined && (
                      <span>
                        Conversion factor:{" "}
                        {
                          sensor
                            .calibration
                            .conversionFactor
                        }
                      </span>
                    )}
                  </div>
                </article>
              ),
            )}

            {stationSensors.length ===
              0 && (
              <div
                className={styles.empty}
              >
                No calibration records.
              </div>
            )}
          </div>
        </section>

        {/* EVENT LOG */}

        <section className={styles.panel}>
          <div
            className={
              styles.sectionHeader
            }
          >
            <div>
              <h2>
                Maintenance & Event Log
              </h2>

              <p>
                Recent station activity
              </p>
            </div>
          </div>

          <div className={styles.timeline}>
            <TimelineItem
              title="Station health check completed"
              time={formatDateTime(
                station.updatedAt,
              )}
              detail="Connectivity and telemetry metadata reviewed."
            />

            <TimelineItem
              title="Configuration version applied"
              time="Aug 28, 2026 · 16:05"
              detail="CFG-2026.08.4 is the active configuration."
            />

            <TimelineItem
              title="Calibration review"
              time="Aug 25, 2026 · 09:20"
              detail="Calibration status synchronized for connected sensors."
            />
          </div>
        </section>
      </section>
    </div>
  );
}

/* =========================
   INFO CARD
========================= */

function InfoCard({
  label,
  value,
  sub,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <article
      className={styles.infoCard}
    >
      <div
        className={
          styles.infoIcon
        }
      >
        {children}
      </div>

      <span>{label}</span>

      <strong>{value}</strong>

      {sub && (
        <small>{sub}</small>
      )}
    </article>
  );
}

/* =========================
   TIMELINE ITEM
========================= */

function TimelineItem({
  title,
  time,
  detail,
}: {
  title: string;
  time: string;
  detail: string;
}) {
  return (
    <article
      className={
        styles.timelineItem
      }
    >
      <div className={styles.dot} />

      <div>
        <strong>{title}</strong>

        <time>{time}</time>

        <p>{detail}</p>
      </div>
    </article>
  );
}