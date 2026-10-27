import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import Button from "@/components/common/Button";
import ErrorState from "@/components/common/ErrorState";
import Loading from "@/components/common/Loading";
import PageHeader from "@/components/layout/PageHeader";
import { stationBrowserService, type BrowserStation } from "@/services/stationBrowserService";
import {
  createInitialFarmerState,
  mergeFarmerLatest,
  mergeStationMetadata,
  fenceStationDetailView,
  type FarmerStationState,
} from "@/utils/retainedStationData";
import { formatVietnamDateTime } from "@/utils/formatDateTime";
import { useAuth } from "@/hooks/useAuth";

import styles from "./AdminStationBrowser.module.css";

export default function StationDetail() {
  const { stationId } = useParams<{ stationId: string }>();
  const { user } = useAuth();
  const [dataState, setDataState] = useState<FarmerStationState<BrowserStation> | null>(null);
  const [refreshId, setRefreshId] = useState(0);

  if (stationId && (dataState?.stationId !== stationId || dataState?.reloadKey !== refreshId)) {
    setDataState(createInitialFarmerState(stationId, refreshId, dataState));
  }

  useEffect(() => {
    if (!stationId) return;
    let active = true;
    stationBrowserService.getStation(stationId).then(
      data => { if (active) setDataState(prev => prev && active ? mergeStationMetadata(prev, stationId, refreshId,
        { ok: true, data }) : prev); },
      error => { if (active) setDataState(prev => prev && active ? mergeStationMetadata(prev, stationId, refreshId,
        { ok: false, error }) : prev); },
    );
    stationBrowserService.getLatest(stationId).then(
      data => { if (active) setDataState(prev => prev && active ? mergeFarmerLatest(prev, stationId, refreshId,
        { ok: true, data }) : prev); },
      error => { if (active) setDataState(prev => prev && active ? mergeFarmerLatest(prev, stationId, refreshId,
        { ok: false, error }) : prev); },
    );
    return () => { active = false; };
  }, [stationId, refreshId]);

  const currentData = dataState?.stationId === stationId && dataState?.reloadKey === refreshId ? dataState : null;
  const view = fenceStationDetailView({
    routeStationId: stationId ?? "", metaStationId: currentData?.stationId ?? null,
    metaStation: currentData?.sibling ?? null, metaAccessDenied: currentData?.accessDenied ?? false,
    metaError: currentData?.siblingError ?? "", metaPending: currentData?.siblingPending ?? true,
    latestStationId: currentData?.stationId ?? null, latest: currentData?.latest ?? null,
    isRetained: currentData?.isRetained ?? false, latestError: currentData?.latestError ?? "",
    latestPending: currentData?.latestPending ?? true,
  });
  const { station: currentStation, latest: currentLatest, isRetained: currentIsRetained,
    metaError: currentError, latestError: currentLatestError, loading: currentLoading } = view;
  function refresh() { setRefreshId(value => value + 1); }

  return (
    <div className={styles.page}>
      <PageHeader
        title={currentStation?.name ?? "Station Detail"}
        description="Station metadata and latest soil readings from the backend."
        actions={<Button variant="outline" icon={<RefreshCw size={16} />} onClick={refresh}>Refresh</Button>}
      />
      <Link to={user?.role === "FARMER" ? "/farm-owner/soil-dashboard" : "/admin/devices"}>
        ← Back to stations
      </Link>
      {currentLoading && <Loading label="Loading station..." />}
      {currentError && <ErrorState description={currentError} onRetry={refresh} />}
      {currentData?.accessDenied && currentData.latestError && <ErrorState description={currentData.latestError} onRetry={refresh} />}
      {!currentData?.accessDenied && (
        <>
          {currentStation && <section className={styles.panel}>
            <h2>Station</h2>
            <p><strong>Code:</strong> {currentStation.code}</p>
            <p><strong>Station ID:</strong> <code>{currentStation.id}</code></p>
            <p><strong>Farm / Plot IDs:</strong> <code>{currentStation.farmId}</code> / <code>{currentStation.plotId}</code></p>
          </section>}
          <section className={styles.panel}>
            <h2>Latest soil readings</h2>
            {currentLatestError && <ErrorState description={currentLatestError} onRetry={refresh} />}
            {currentLatest && (
              <>
                <p className={styles.note}>
                  Fetched {formatVietnamDateTime(currentLatest.fetchedAt)}
                  {currentIsRetained ? " · Last Known (Stale)" : currentLatest.isStale ? " · Stale" : ""}
                  {currentLatest.isFromCache ? " · Cached" : ""}
                  {currentLatest.dataOrigin === "stored" ? " · Stored" : currentLatest.dataOrigin === "upstream" ? " · Upstream" : ""}
                </p>
                {currentLatest.fields.length === 0 ? <p>No soil readings available.</p> : (
                  <ul className={styles.readings}>{currentLatest.fields.map((field) => (
                    <li key={field.field}>
                      <strong>{field.field}</strong>
                      <span>{field.value} {field.unit ?? ""}</span>
                      <small>{field.quality} · {formatVietnamDateTime(field.observedAt)}</small>
                    </li>
                  ))}</ul>
                )}
              </>
            )}
          </section>
          <p className={styles.note}>This page monitors soil data only; alert thresholds are managed in Alert Center.</p>
        </>
      )}
    </div>
  );
}
