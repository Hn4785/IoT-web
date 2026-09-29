import { useEffect, useState } from "react";
import { Activity, AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "../../components/common/Button.tsx";
import PageHeader from "../../components/layout/PageHeader.tsx";
import { useStationHierarchy } from "../../hooks/useStationHierarchy.ts";
import { alertService } from "../../services/alertService.ts";
import { stationBrowserService } from "../../services/stationBrowserService.ts";
import type { AlertDto } from "../../types/alertApi.ts";
import type { LatestSoilDataDto } from "../../types/soil.ts";
import { normalizeApiError } from "../../utils/apiError.ts";
import styles from "./ConnectedSoil.module.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

interface FarmDashboardState {
  stationId: string;
  reloadKey: number;
  latest: LatestSoilDataDto | null;
  alerts: AlertDto[];
  error: string;
}

export default function FarmDashboard() {
  const hierarchy = useStationHierarchy();
  const [dataState, setDataState] = useState<FarmDashboardState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const stationId = hierarchy.selectedStationId;
    if (!stationId) {
      return () => { active = false; };
    }
    Promise.all([
      stationBrowserService.getLatest(stationId),
      alertService.listAlerts({ stationId, limit: 20 }),
    ]).then(
      ([soil, alertPage]) => {
        if (!active) return;
        setDataState({
          stationId,
          reloadKey,
          latest: soil,
          alerts: alertPage.items.filter((item) => item.status !== "RESOLVED"),
          error: "",
        });
      },
      (reason) => {
        if (!active) return;
        setDataState({
          stationId,
          reloadKey,
          latest: null,
          alerts: [],
          error: normalizeApiError(reason).message,
        });
      },
    );
    return () => { active = false; };
  }, [hierarchy.selectedStationId, reloadKey]);

  const currentData = (dataState?.stationId === hierarchy.selectedStationId && dataState?.reloadKey === reloadKey)
    ? dataState
    : null;
  const latest = currentData?.latest ?? null;
  const alerts = currentData?.alerts ?? [];
  const error = currentData?.error ?? "";

  return (
    <div className={styles.page}>
      <PageHeader title="Farm Dashboard" description="Live soil measurements from the current backend scope." actions={
        <Button variant="outline" icon={<RefreshCw size={16} />} onClick={() => setReloadKey((value) => value + 1)}>Refresh</Button>
      } />
      <section className={styles.filters}>
        <label>Farm<select value={hierarchy.selectedFarmId} onChange={(event) => hierarchy.setSelectedFarmId(event.target.value)}><option value="">Select a farm</option>{hierarchy.farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label>
        <label>Plot<select value={hierarchy.selectedPlotId} onChange={(event) => hierarchy.setSelectedPlotId(event.target.value)} disabled={!hierarchy.selectedFarmId}><option value="">Select a plot</option>{hierarchy.plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select></label>
        <label>Station<select value={hierarchy.selectedStationId} onChange={(event) => hierarchy.setSelectedStationId(event.target.value)} disabled={!hierarchy.selectedPlotId}><option value="">Select a station</option>{hierarchy.stations.map((station) => <option key={station.id} value={station.id}>{station.code} — {station.name}</option>)}</select></label>
      </section>
      {(error || hierarchy.error) && <p className={styles.error} role="alert">{error || hierarchy.error}</p>}
      <section className={styles.summary}>
        <article><Activity size={20} /><div><span>Data state</span><strong>{latest ? latest.isStale ? "Stale" : "Live" : "Unavailable"}</strong></div></article>
        <article><AlertTriangle size={20} /><div><span>Active alerts</span><strong>{alerts.length}</strong></div></article>
        <article><div><span>Fetched at</span><strong>{latest ? formatDate(latest.fetchedAt) : "—"}</strong></div></article>
      </section>
      <section className={styles.metrics}>
        {latest?.fields.length ? latest.fields.map((field) => (
          <article key={`${field.field}-${field.sensorId ?? "none"}`}>
            <span>{field.field.replaceAll("_", " ")}</span>
            <strong>{field.value} <small>{field.unit ?? ""}</small></strong>
            <footer>{field.quality} · {formatDate(field.observedAt)}</footer>
          </article>
        )) : <p className={styles.empty}>Select an authorized station with available soil data.</p>}
      </section>
      {alerts.length > 0 && <section className={styles.card}><h2>Open alerts</h2>{alerts.map((alert) => <div className={styles.alertRow} key={alert.id}><strong>{alert.severity} · {alert.field}</strong><span>{alert.latestValue} {alert.unit} · {alert.status}</span></div>)}</section>}
    </div>
  );
}
