import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Database,
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
  inventoryLimited: boolean;
}

const EMPTY_DATA: DashboardData = {
  farms: [],
  plots: [],
  stations: [],
  userCount: 0,
  inventoryLimited: false,
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
        inventoryLimited: Boolean(farmPage.nextCursor || userPage.nextCursor || plotPages.some((page) => page.nextCursor) || stationPages.some((page) => page.nextCursor)),
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
    { label: "Farms", value: data.farms.length, icon: Database },
    { label: "Plots", value: data.plots.length, icon: Activity },
    { label: "Soil Stations", value: data.stations.length, icon: Server },
    { label: "Users", value: data.userCount, icon: Users },
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
      {data.inventoryLimited && <p role="status">Only the first page of some resources is shown. These counts are not system-wide totals.</p>}

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
        {kpis.map(({ label, value, icon: Icon }) => (
          <article className={styles.kpiCard} key={label}>
            <div className={styles.kpiTop}>
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <span className={styles.sourceNote}>Live backend data</span>
          </article>
        ))}
      </section>

      <section className={styles.chartGrid}>
        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Registered Soil Stations</h2>
              <p>Soil stations in the selected farm.</p>
            </div>
            <strong className={styles.metric}>{visibleStations.length}</strong>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Soil Stations by Farm</h2>
              <p>Distribution across the farms shown above.</p>
            </div>
          </div>
          <DonutChart
            data={stationDistribution}
            centerValue={data.stations.length}
            centerLabel="Soil stations"
          />
        </article>
      </section>
    </div>
  );
}
