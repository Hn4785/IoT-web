import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import Button from "@/components/common/Button";
import ErrorState from "@/components/common/ErrorState";
import Loading from "@/components/common/Loading";
import PageHeader from "@/components/layout/PageHeader";
import { stationBrowserService, type BrowserStation } from "@/services/stationBrowserService";
import type { LatestSoilDataDto } from "@/types/soil";
import { normalizeApiError } from "@/utils/apiError";
import { formatVietnamDateTime } from "@/utils/formatDateTime";

import styles from "./AdminStationBrowser.module.css";

export default function StationDetail() {
  const { stationId } = useParams<{ stationId: string }>();
  const [station, setStation] = useState<BrowserStation | null>(null);
  const [latest, setLatest] = useState<LatestSoilDataDto | null>(null);
  const [error, setError] = useState("");
  const [latestError, setLatestError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshId, setRefreshId] = useState(0);

  useEffect(() => {
    if (!stationId) return;
    let active = true;
    Promise.allSettled([
      stationBrowserService.getStation(stationId),
      stationBrowserService.getLatest(stationId),
    ]).then(([stationResult, latestResult]) => {
      if (!active) return;
      if (stationResult.status === "fulfilled") setStation(stationResult.value);
      else setError(normalizeApiError(stationResult.reason).message);
      if (latestResult.status === "fulfilled") setLatest(latestResult.value);
      else setLatestError(normalizeApiError(latestResult.reason).message);
      setLoading(false);
    });
    return () => { active = false; };
  }, [stationId, refreshId]);

  function refresh() {
    setError("");
    setLatestError("");
    setLoading(true);
    setRefreshId((value) => value + 1);
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={station?.name ?? "Station Detail"}
        description="Station metadata and latest soil readings from the backend."
        actions={<Button variant="outline" icon={<RefreshCw size={16} />} onClick={refresh}>Refresh</Button>}
      />
      <Link to="/admin/devices">← Back to stations</Link>
      {loading && <Loading label="Loading station..." />}
      {error && <ErrorState description={error} onRetry={refresh} />}
      {!loading && station && !error && (
        <>
          <section className={styles.panel}>
            <h2>Station</h2>
            <p><strong>Code:</strong> {station.code}</p>
            <p><strong>Station ID:</strong> <code>{station.id}</code></p>
            <p><strong>Farm / Plot IDs:</strong> <code>{station.farmId}</code> / <code>{station.plotId}</code></p>
          </section>
          <section className={styles.panel}>
            <h2>Latest soil readings</h2>
            {latestError && <ErrorState description={latestError} onRetry={refresh} />}
            {latest && (
              <>
                <p className={styles.note}>Fetched {formatVietnamDateTime(latest.fetchedAt)}{latest.isStale ? " · Stale" : ""}{latest.isFromCache ? " · Cached" : ""}</p>
                {latest.fields.length === 0 ? <p>No soil readings available.</p> : (
                  <ul className={styles.readings}>{latest.fields.map((field) => (
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
          <p className={styles.note}>Device health and configuration writes remain unavailable until a real hardware contract is approved.</p>
        </>
      )}
    </div>
  );
}
