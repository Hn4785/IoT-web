import { Activity, AlertCircle, KeyRound, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiKeyService, type AvailableApiKeyStation, type DeveloperApiKey } from "@/services/apiKeyService";
import { clientHealthService } from "@/services/clientHealthService";
import type { ClientApiHealth } from "@/types/clientApi";
import { normalizeApiError } from "@/utils/apiError";
import { summarizeDeveloperAccess } from "@/utils/developerOverview";
import styles from "./DeveloperDashboard.module.css";

export default function DeveloperDashboard() {
  const [keys, setKeys] = useState<DeveloperApiKey[]>([]);
  const [stations, setStations] = useState<AvailableApiKeyStation[]>([]);
  const [health, setHealth] = useState<ClientApiHealth | null>(null);
  const [now] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [loadedKeys, loadedStations, loadedHealth] = await Promise.all([
        apiKeyService.list(), apiKeyService.listAvailableStations(), clientHealthService.getHealth(),
      ]);
      setKeys(loadedKeys);
      setStations(loadedStations);
      setHealth(loadedHealth);
    } catch (reason) {
      setError(normalizeApiError(reason).message);
      setHealth(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);
  const summary = useMemo(() => summarizeDeveloperAccess(keys, stations, now), [keys, now, stations]);
  const activeRateLimits = keys.filter((key) => !key.revokedAt && Date.parse(key.expiresAt) > now).map((key) => key.requestsPerMinute);
  const highestRateLimit = activeRateLimits.length ? Math.max(...activeRateLimits) : null;
  const healthy = health?.status === "healthy";
  const kpis = [
    { label: "Active API Keys", value: loading ? "…" : String(summary.active), description: `${summary.expired} expired · ${summary.revoked} revoked`, icon: <KeyRound size={20} /> },
    { label: "Available Stations", value: loading ? "…" : String(summary.availableStations), description: "Current account grants", icon: <Server size={20} /> },
    { label: "Covered Stations", value: loading ? "…" : String(summary.coveredStations), description: "Covered by active key scopes", icon: <ShieldCheck size={20} /> },
    { label: "Highest Rate Limit", value: loading ? "…" : highestRateLimit === null ? "N/A" : `${highestRateLimit}/min`, description: "Highest active credential limit", icon: <Activity size={20} /> },
  ];

  return <div className={styles.page}>
    <div className={styles.header}><div><div className={styles.eyebrow}>DEVELOPER PORTAL</div><h1>Developer Overview</h1><p>Live credential scope and public API service health.</p></div><div className={styles.headerStatus}><span className={styles.statusDot} />{health ? `API ${health.status}` : "API status unavailable"}</div></div>
    {error && <section className={styles.quickLinks} role="alert"><div><AlertCircle size={18} /><span>{error}</span><button className={styles.textButton} onClick={() => void load()}><RefreshCw size={14} /> Retry</button></div></section>}
    <section className={styles.kpiGrid} aria-busy={loading}>{kpis.map((kpi) => <article className={styles.kpiCard} key={kpi.label}><div className={styles.kpiTop}><span className={styles.kpiIcon}>{kpi.icon}</span></div><div className={styles.kpiValue}>{kpi.value}</div><div className={styles.kpiLabel}>{kpi.label}</div><div className={styles.kpiDescription}>{kpi.description}</div></article>)}</section>
    <section className={styles.mainGrid}>
      <article className={styles.card}><div className={styles.cardHeader}><div><h2>Credential inventory</h2><p>Current keys returned by the backend.</p></div></div><div className={styles.tableWrapper}><table className={styles.table}><thead><tr><th>Total loaded</th><th>Active</th><th>Expired</th><th>Revoked</th><th>Station grants</th></tr></thead><tbody><tr><td>{summary.loaded}</td><td>{summary.active}</td><td>{summary.expired}</td><td>{summary.revoked}</td><td>{summary.availableStations}</td></tr></tbody></table></div></article>
      <article className={styles.card}><div className={styles.cardHeader}><div><h2>API Health</h2><p>Public health contract from the connected backend.</p></div></div><div className={styles.healthList}><div className={styles.healthItem}>{healthy ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}<div><strong>{health?.service ?? "Service unavailable"}</strong><span>{health?.status ?? "No health response"}</span></div><b>{health?.version ?? "N/A"}</b></div><div className={styles.healthItem}><Server size={18} /><div><strong>Environment</strong><span>{health?.environment ?? "Unavailable"}</span></div><b>{health?.time ? new Date(health.time).toLocaleString() : "N/A"}</b></div></div></article>
    </section>
    <section className={styles.quickLinks}><div><AlertCircle size={18} /><span>Request totals, latency, error rate and request logs are not exposed by the current backend contract, so this portal does not invent those values.</span></div><div><ShieldCheck size={18} /><span>Effective station access is always the intersection of the current account grants and each API key scope.</span></div></section>
  </div>;
}
