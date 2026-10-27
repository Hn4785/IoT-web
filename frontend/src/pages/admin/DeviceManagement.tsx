import { Link } from "react-router-dom";
import { RefreshCw, RadioTower } from "lucide-react";

import Button from "@/components/common/Button";
import EmptyState from "@/components/common/EmptyState";
import ErrorState from "@/components/common/ErrorState";
import Loading from "@/components/common/Loading";
import PageHeader from "@/components/layout/PageHeader";
import { useStationHierarchy } from "@/hooks/useStationHierarchy";

import styles from "./AdminStationBrowser.module.css";

export default function DeviceManagement() {
  const hierarchy = useStationHierarchy();

  return (
    <div className={styles.page}>
      <PageHeader
        title="Stations & Devices"
        description="Browse the farms, plots and stations available to this account. Hardware controls are not enabled."
        actions={<Button variant="outline" icon={<RefreshCw size={16} />} onClick={hierarchy.reload}>Refresh</Button>}
      />
      {hierarchy.error && <ErrorState description={hierarchy.error} onRetry={hierarchy.reload} />}
      <section className={styles.panel} aria-label="Station filters">
        <div className={styles.filters}>
          <label>Farm
            <select value={hierarchy.selectedFarmId} onChange={(event) => hierarchy.setSelectedFarmId(event.target.value)}>
              {hierarchy.farms.length === 0 && <option value="">No farms available</option>}
              {hierarchy.farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}
            </select>
          </label>
          <label>Plot
            <select value={hierarchy.selectedPlotId} onChange={(event) => hierarchy.setSelectedPlotId(event.target.value)} disabled={!hierarchy.selectedFarmId}>
              {hierarchy.plots.length === 0 && <option value="">No plots available</option>}
              {hierarchy.plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}
            </select>
          </label>
        </div>
      </section>
      {hierarchy.loading && <Loading label="Loading station inventory..." />}
      {!hierarchy.loading && !hierarchy.error && hierarchy.stations.length === 0 && (
        <EmptyState title="No stations in this plot" description="Choose another farm or plot, or ask an administrator to check station access." />
      )}
      {!hierarchy.loading && !hierarchy.error && hierarchy.stations.length > 0 && (
        <section className={styles.panel} aria-label="Stations">
          <h2>Stations in {hierarchy.selectedPlot?.name}</h2>
          <ul className={styles.stationList}>
            {hierarchy.stations.map((station) => (
              <li key={station.id}>
                <RadioTower size={20} aria-hidden="true" />
                <div><strong>{station.name}</strong><span>{station.code}</span></div>
                <Link to={`/admin/stations/${station.id}`}>View station</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className={styles.note}>The backend has not approved gateway/sensor health or device-write contracts. Those values and actions are intentionally not shown.</p>
    </div>
  );
}
