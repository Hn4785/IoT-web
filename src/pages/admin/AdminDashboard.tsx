import { useMemo, useState } from "react";
import {
  Activity,
  Cpu,
  Database,
  Gauge,
  RefreshCw,
  Server,
  Users,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/common/Button";
import StatusBadge from "@/components/common/StatusBadge";
import LineChart from "@/components/charts/LineChart";
import DonutChart from "@/components/charts/DonutChart";
import BarChart from "@/components/charts/BarChart";

import { farms } from "@/data/farms";
import { stations } from "@/data/stations";
import { gateways } from "@/data/gateways";
import { sensors } from "@/data/sensors";
import { users } from "@/data/user";

import styles from "./AdminDashboard.module.css";

const healthTrend = [
  { label: "08:00", value: 94 },
  { label: "10:00", value: 92 },
  { label: "12:00", value: 95 },
  { label: "14:00", value: 93 },
  { label: "16:00", value: 96 },
  { label: "18:00", value: 95 },
];

const recentEvents = [
  {
    time: "16:42",
    event: "Updated station configuration",
    user: "Alex Morgan",
    resource: "ST-001",
    status: "success",
  },
  {
    time: "16:28",
    event: "Created alert rule",
    user: "Daniel Nguyen",
    resource: "RULE-003",
    status: "success",
  },
  {
    time: "16:15",
    event: "Rotated gateway credential",
    user: "Alex Morgan",
    resource: "GW-004",
    status: "success",
  },
  {
    time: "15:58",
    event: "Configuration update failed",
    user: "Emily Tran",
    resource: "ST-004",
    status: "failed",
  },
];

export default function AdminDashboard() {
  const [farmId, setFarmId] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");

  const visibleStations = useMemo(() => {
    if (farmId === "all") {
      return stations;
    }

    return stations.filter((station) => station.farmId === farmId);
  }, [farmId]);

  const stationHealth = useMemo(
    () => [
      {
        label: "Online",
        value: visibleStations.filter(
          (station) => station.status === "online",
        ).length,
      },
      {
        label: "Offline",
        value: visibleStations.filter(
          (station) => station.status === "offline",
        ).length,
      },
      {
        label: "Stale",
        value: visibleStations.filter(
          (station) => station.status === "stale",
        ).length,
      },
    ],
    [visibleStations],
  );

  const filteredEvents = useMemo(() => {
    if (eventFilter === "failed") {
      return recentEvents.filter((event) => event.status === "failed");
    }

    return recentEvents;
  }, [eventFilter]);

  const totalPlots = farms.reduce(
    (total, farm) => total + (farm.plotCount ?? 0),
    0,
  );

  const kpis = [
    {
      label: "Total Farms",
      value: farms.length,
      change: "+8.3%",
      icon: Database,
    },
    {
      label: "Total Plots",
      value: totalPlots,
      change: "+12.5%",
      icon: Activity,
    },
    {
      label: "Total Stations",
      value: stations.length,
      change: "+6.8%",
      icon: Server,
    },
    {
      label: "Total Gateways",
      value: gateways.length,
      change: "+5.1%",
      icon: Cpu,
    },
    {
      label: "Total Sensors",
      value: sensors.length,
      change: "+9.4%",
      icon: Gauge,
    },
    {
      label: "Total Users",
      value: users.length,
      change: "+4.2%",
      icon: Users,
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="System Overview"
        description="Monitor platform health, devices, users, and recent system activity."
        actions={
          <Button
            variant="outline"
            icon={<RefreshCw size={16} />}
          >
            Refresh
          </Button>
        }
      />

      <section className={styles.filters}>
        <select
          value={farmId}
          onChange={(event) => setFarmId(event.target.value)}
        >
          <option value="all">All Farms</option>

          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </select>

        <select>
          <option>All Stations</option>

          {visibleStations.map((station) => (
            <option key={station.id} value={station.id}>
              {station.name}
            </option>
          ))}
        </select>

        <select>
          <option>All Device Types</option>
          <option>Station</option>
          <option>Gateway</option>
          <option>Sensor</option>
        </select>

        <select
          value={eventFilter}
          onChange={(event) => setEventFilter(event.target.value)}
        >
          <option value="all">All Events</option>
          <option value="failed">Failed Events</option>
        </select>
      </section>

      <section className={styles.kpiGrid}>
        {kpis.map(({ label, value, change, icon: Icon }) => (
          <article
            className={styles.kpiCard}
            key={label}
          >
            <div className={styles.kpiTop}>
              <span>{label}</span>
              <Icon size={18} />
            </div>

            <strong>{value}</strong>

            <span className={styles.change}>
              ↑ {change}
              <small> vs previous period</small>
            </span>
          </article>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>System Health</h2>
            <p>
              Connectivity state across monitored stations.
            </p>
          </div>

          <div className={styles.healthSummary}>
            {stationHealth.map((item) => (
              <div key={item.label}>
                <StatusBadge
                  status={
                    item.label.toLowerCase() as
                      | "online"
                      | "offline"
                      | "stale"
                  }
                />

                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.chartGrid}>
        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Station Health Over Time</h2>
              <p>Healthy station percentage.</p>
            </div>

            <strong className={styles.metric}>95%</strong>
          </div>

          <LineChart
            data={healthTrend}
            min={80}
            max={100}
            unit="%"
            showArea
            showDots
          />
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Station Distribution</h2>
              <p>Current connectivity status.</p>
            </div>
          </div>

          <DonutChart
            data={stationHealth}
            centerValue={visibleStations.length}
            centerLabel="Stations"
          />
        </article>
      </section>

      <section className={styles.chartGrid}>
        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Sensor Health</h2>
              <p>Distribution by current device state.</p>
            </div>
          </div>

          <BarChart
            data={[
              {
                label: "Active",
                value: sensors.filter(
                  (sensor) => sensor.status === "active",
                ).length,
              },
              {
                label: "Error",
                value: sensors.filter(
                  (sensor) => sensor.status === "error",
                ).length,
              },
              {
                label: "Inactive",
                value: sensors.filter(
                  (sensor) => sensor.status === "inactive",
                ).length,
              },
              {
                label: "Uncalibrated",
                value: sensors.filter(
                  (sensor) => sensor.status === "uncalibrated",
                ).length,
              },
            ]}
            showValues
          />
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Gateway Health</h2>
              <p>Current gateway status.</p>
            </div>
          </div>

          <div className={styles.gatewayList}>
            {["online", "stale", "offline"].map((status) => (
              <div key={status}>
                <StatusBadge
                  status={
                    status as
                      | "online"
                      | "stale"
                      | "offline"
                  }
                />

                <strong>
                  {
                    gateways.filter(
                      (gateway) => gateway.status === status,
                    ).length
                  }
                </strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Recent System Events</h2>
            <p>
              Latest administrative and system activity.
            </p>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>User</th>
                <th>Resource</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredEvents.map((event) => (
                <tr
                  key={`${event.time}-${event.resource}`}
                >
                  <td>{event.time}</td>
                  <td>{event.event}</td>
                  <td>{event.user}</td>
                  <td className={styles.mono}>
                    {event.resource}
                  </td>
                  <td>
                    <StatusBadge
                      status={
                        event.status === "success"
                          ? "active"
                          : "critical"
                      }
                      label={
                        event.status === "success"
                          ? "Success"
                          : "Failed"
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}