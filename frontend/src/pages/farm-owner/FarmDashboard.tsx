import { useEffect, useState } from "react";
import { Activity, AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "../../components/common/Button.tsx";
import PageHeader from "../../components/layout/PageHeader.tsx";
import { useStationHierarchy } from "../../hooks/useStationHierarchy.ts";
import { alertService } from "../../services/alertService.ts";
import { stationBrowserService } from "../../services/stationBrowserService.ts";
import type { AlertDto } from "../../types/alertApi.ts";
import {
  formatLatestSummaryState,
  createInitialFarmerState,
  mergeFarmerLatest,
  mergeFarmerSibling,
  type FarmerStationState,
} from "../../utils/retainedStationData.ts";
import styles from "./ConnectedSoil.module.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function FarmDashboard() {
  const hierarchy = useStationHierarchy();
  const [dataState, setDataState] = useState<FarmerStationState<AlertDto[]> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  if (!hierarchy.selectedStationId && !hierarchy.loading && dataState) setDataState(null);
  else if (hierarchy.selectedStationId && (dataState?.stationId !== hierarchy.selectedStationId || dataState?.reloadKey !== reloadKey)) {
    setDataState(createInitialFarmerState(hierarchy.selectedStationId, reloadKey, dataState));
  }

  useEffect(() => {
    let active = true;
    const stationId = hierarchy.selectedStationId;
    if (!stationId) {
      return () => { active = false; };
    }
    stationBrowserService.getLatest(stationId).then(
      data => { if (active) setDataState(prev => prev && active ? mergeFarmerLatest(prev, stationId, reloadKey, { ok: true, data }) : prev); },
      error => { if (active) setDataState(prev => prev && active ? mergeFarmerLatest(prev, stationId, reloadKey, { ok: false, error }) : prev); },
    );
    alertService.listAlerts({ stationId, limit: 20 }).then(
      page => { if (active) setDataState(prev => prev && active ? mergeFarmerSibling(prev, stationId, reloadKey,
        { ok: true, data: page.items.filter(item => item.status !== "RESOLVED") }) : prev); },
      error => { if (active) setDataState(prev => prev && active ? mergeFarmerSibling(prev, stationId, reloadKey,
        { ok: false, error, label: "active alerts" }) : prev); },
    );

    return () => { active = false; };
  }, [hierarchy.selectedStationId, reloadKey]);

  const currentData = (dataState?.stationId === hierarchy.selectedStationId && dataState?.reloadKey === reloadKey)
    ? dataState
    : null;
  const latest = currentData?.latest ?? null;
  const isRetained = currentData?.isRetained ?? false;
  const alerts = currentData?.sibling ?? [];
  const latestError = currentData?.latestError ?? "";
  const alertsError = currentData?.siblingError ?? "";

  return (
    <div className={styles.page}>
      <PageHeader title="Farm Dashboard" description="Live soil measurements from the current backend scope." actions={
        <Button variant="outline" disabled={hierarchy.loading || currentData?.latestPending} icon={<RefreshCw size={16} />} onClick={() => { hierarchy.reload(); setReloadKey((value) => value + 1); }}>Refresh</Button>
      } />
      <section className={styles.filters}>
        <label>Farm<select value={hierarchy.selectedFarmId} onChange={(event) => hierarchy.setSelectedFarmId(event.target.value)}><option value="">Select a farm</option>{hierarchy.farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label>
        <label>Plot<select value={hierarchy.selectedPlotId} onChange={(event) => hierarchy.setSelectedPlotId(event.target.value)} disabled={!hierarchy.selectedFarmId}><option value="">Select a plot</option>{hierarchy.plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select></label>
        <label>Station<select value={hierarchy.selectedStationId} onChange={(event) => hierarchy.setSelectedStationId(event.target.value)} disabled={!hierarchy.selectedPlotId}><option value="">Select a station</option>{hierarchy.stations.map((station) => <option key={station.id} value={station.id}>{station.code} — {station.name}</option>)}</select></label>
      </section>
      {hierarchy.error && <p className={styles.error} role="alert">{hierarchy.error}</p>}
      {latestError && (
        <p className={styles.error} role="alert">
          {isRetained && latest
            ? `Failed to refresh live data: ${latestError}. Showing last-known reading from ${formatDate(latest.fetchedAt)}.`
            : latestError}
        </p>
      )}
      {alertsError && <p className={styles.error} role="alert">{alertsError}</p>}
      <section className={styles.summary}>
        <article><Activity size={20} /><div><span>Data state{latest?.dataOrigin === "stored" ? " · Stored" : ""}{isRetained ? " · Last known" : ""}</span><strong>{currentData?.latestPending ? "Refreshing..." : formatLatestSummaryState(latest, isRetained)}</strong></div></article>
        <article><AlertTriangle size={20} /><div><span>Active alerts</span><strong>{currentData?.siblingPending ? "Loading..." : alertsError ? "Unavailable" : alerts.length}</strong></div></article>
        <article><div><span>{isRetained ? "Last known fetch" : "Fetched at"}</span><strong>{latest ? formatDate(latest.fetchedAt) : "—"}</strong></div></article>
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
