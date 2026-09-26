import { Check, Database, KeyRound, RefreshCw, Shield } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { apiKeyService, type AvailableApiKeyStation, type DeveloperApiKey } from "@/services/apiKeyService";
import { normalizeApiError } from "@/utils/apiError";
import { getApiKeyStatus, getGrantedKeyStations } from "@/utils/developerOverview";
import styles from "./ApiPermissions.module.css";

const permissions = [
  ["List authorized stations", "GET /client/stations"],
  ["Read latest soil data", "GET /client/data/latest"],
  ["Read bounded soil history", "GET /client/data/history"],
] as const;

export default function ApiPermissions() {
  const [keys, setKeys] = useState<DeveloperApiKey[]>([]);
  const [stations, setStations] = useState<AvailableApiKeyStation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [loadedKeys, loadedStations] = await Promise.all([apiKeyService.list(), apiKeyService.listAvailableStations()]);
      setKeys(loadedKeys); setStations(loadedStations);
      setSelectedId((current) => current && loadedKeys.some((key) => key.id === current) ? current : loadedKeys[0]?.id ?? "");
    } catch (reason) { setError(normalizeApiError(reason).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);
  const selectedKey = useMemo(() => keys.find((key) => key.id === selectedId) ?? null, [keys, selectedId]);
  const grantedStations = useMemo(() => selectedKey ? getGrantedKeyStations(selectedKey, stations) : [], [selectedKey, stations]);
  const status = selectedKey ? getApiKeyStatus(selectedKey) : null;

  return <div className={styles.page}>
    <div className={styles.header}><div><div className={styles.eyebrow}>DEVELOPER PORTAL / AUTHORIZATION</div><h1>API Permissions</h1><p>Read-only view of the effective access returned by the backend.</p></div></div>
    {error && <section className={styles.keySelector} role="alert"><RefreshCw size={18} /><strong>{error}</strong><button onClick={() => void load()}>Retry</button></section>}
    <section className={styles.keySelector} aria-busy={loading}><div className={styles.selectorIcon}><KeyRound size={18} /></div><div><span>API Key</span><strong>{selectedKey ? `${selectedKey.name} · ${status}` : loading ? "Loading…" : "No key available"}</strong></div><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={loading || keys.length === 0}><option value="">No API key selected</option>{keys.map((key) => <option key={key.id} value={key.id}>{key.name} · {key.prefix}</option>)}</select></section>
    <div className={styles.grid}>
      <section className={styles.card}><div className={styles.cardHeader}><div><h2>Supported capabilities</h2><p>The current public client API is read-only.</p></div><Shield size={19} /></div><div className={styles.permissionList}>{permissions.map(([label, endpoint]) => <div className={`${styles.permissionItem} ${selectedKey && status === "active" ? styles.permissionSelected : ""}`} key={endpoint}><span className={styles.checkbox}>{selectedKey && status === "active" && <Check size={14} />}</span><span className={styles.permissionContent}><strong>{label}</strong><span>{endpoint}</span></span></div>)}</div></section>
      <section className={styles.card}><div className={styles.cardHeader}><div><h2>Effective station scope</h2><p>Key scope intersected with current account grants.</p></div><Database size={19} /></div><div className={styles.resourceTree}>{!selectedKey ? <p>Select an API key to inspect its scope.</p> : grantedStations.length === 0 ? <p>No current station access. An empty key scope never expands to all account grants.</p> : <div className={styles.stationList}>{grantedStations.map((station) => <div className={styles.station} key={station.id}><Check size={15} /><span>{station.name} ({station.code})</span></div>)}</div>}</div></section>
    </div>
    <section className={styles.summary}><div><span>Selected key status</span><strong>{status ?? "N/A"}</strong></div><div><span>Account grants</span><strong>{stations.length}</strong></div><div><span>Effective stations</span><strong>{grantedStations.length}</strong></div><Link className={styles.saveButton} to="/developer/api-keys">Change scope by creating or rotating a key</Link></section>
  </div>;
}
