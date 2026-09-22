import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Cpu,
  Database,
  Gauge,
  RefreshCw,
  Server,
  Users,
} from "lucide-react";

import Button from "@/components/common/Button";
import ErrorState from "@/components/common/ErrorState";
import Loading from "@/components/common/Loading";
import DonutChart from "@/components/charts/DonutChart";
import PageHeader from "@/components/layout/PageHeader";
import {
  stationBrowserService,
  type BrowserFarm,
  type BrowserPlot,
  type BrowserStation,
} from "@/services/stationBrowserService";
import { userService } from "@/services/userService";
import { normalizeApiError } from "@/utils/apiError";

import styles from "./AdminDashboard.module.css";

interface DashboardData {
  farms: BrowserFarm[];
  plots: BrowserPlot[];
  stations: BrowserStation[];
  userCount: number;
}

const EMPTY_DATA: DashboardData = {
  farms: [],
  plots: [],
  stations: [],
  userCount: 0,
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [farmId, setFarmId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      const [farmPage, userPage] = await Promise.all([
        stationBrowserService.listFarms(),
        userService.getUsers({ limit: 100 }),
      ]);
      const plotPages = await Promise.all(
        farmPage.items.map((farm) => stationBrowserService.listPlots(farm.id)),
      );
      const plots = plotPages.flatMap((page) => page.items);
      const stationPages = await Promise.all(
        plots.map((plot) => stationBrowserService.listStations(plot.id)),
      );

      setData({
        farms: farmPage.items,
        plots,
        stations: stationPages.flatMap((page) => page.items),
        userCount: userPage.items.length,
      });
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDashboard = useCallback(() => {
    setLoading(true);
    setError("");
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    // Initial load synchronizes the dashboard with the backend inventory.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  const visibleStations = useMemo(
    () => farmId === "all"
      ? data.stations
      : data.stations.filter((station) => station.farmId === farmId),
    [data.stations, farmId],
  );

  const stationDistribution = useMemo(
    () => data.farms.map((farm) => ({
      label: farm.name,
      value: data.stations.filter((station) => station.farmId === farm.id).length,
    })),
    [data.farms, data.stations],
  );

  const kpis = [
    { label: "Total Farms", value: data.farms.length, icon: Database, available: true },
    { label: "Total Plots", value: data.plots.length, icon: Activity, available: true },
    { label: "Total Stations", value: data.stations.length, icon: Server, available: true },
    { label: "Total Gateways", value: 0, icon: Cpu, available: false },
    { label: "Total Sensors", value: 0, icon: Gauge, available: false },
    { label: "Total Users", value: data.userCount, icon: Users, available: true },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="System Overview"
        description="Current platform inventory available from the backend."
        actions={
          <Button
            variant="outline"
            icon={<RefreshCw size={16} />}
            onClick={refreshDashboard}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      {loading && <Loading label="Loading system overview..." />}
      {error && <ErrorState description={error} onRetry={refreshDashboard} />}

      <section className={styles.filters}>
        <label>
          <span className={styles.srOnly}>Filter by farm</span>
          <select value={farmId} onChange={(event) => setFarmId(event.target.value)}>
            <option value="all">All Farms</option>
            {data.farms.map((farm) => (
              <option key={farm.id} value={farm.id}>{farm.name}</option>
            ))}
          </select>
        </label>
      </section>

      <section className={styles.kpiGrid} aria-label="System inventory">
        {kpis.map(({ label, value, icon: Icon, available }) => (
          <article className={styles.kpiCard} key={label}>
            <div className={styles.kpiTop}>
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{available ? value : "N/A"}</strong>
            <span className={styles.sourceNote}>
              {available ? "Live backend data" : "Backend contract not available"}
            </span>
          </article>
        ))}
      </section>

      <section className={styles.chartGrid}>
        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Registered Stations</h2>
              <p>Stations in the selected farm scope.</p>
            </div>
            <strong className={styles.metric}>{visibleStations.length}</strong>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Stations by Farm</h2>
              <p>Distribution from the current backend hierarchy.</p>
            </div>
          </div>
          <DonutChart
            data={stationDistribution}
            centerValue={data.stations.length}
            centerLabel="Stations"
          />
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Operational Health</h2>
            <p>
              Online, stale, sensor and gateway health will appear when the backend exposes
              those status contracts. No values are estimated.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
