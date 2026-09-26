import { AlertTriangle, BarChart3, Clock3, FileSearch, Gauge, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import styles from "./ApiMetrics.module.css";

const unavailableMetrics = [
  ["Requests Today", <BarChart3 key="requests-today" size={19} />],
  ["Requests This Month", <FileSearch key="requests-month" size={19} />],
  ["Requests / Minute", <Gauge key="requests-minute" size={19} />],
  ["Remaining Quota", <ShieldCheck key="quota" size={19} />],
  ["Error Rate", <AlertTriangle key="error-rate" size={19} />],
  ["Average Response Time", <Clock3 key="response-time" size={19} />],
] as const;

export default function ApiMetrics() {
  return <div className={styles.page}>
    <div className={styles.header}><div><div className={styles.eyebrow}>DEVELOPER PORTAL / ANALYTICS</div><h1>API Metrics</h1><p>Account-scoped usage analytics are not available in the current backend contract.</p></div></div>
    <section className={styles.metricGrid}>{unavailableMetrics.map(([label, icon]) => <article className={styles.metricCard} key={label}><div className={styles.metricIcon}>{icon}</div><span>{label}</span><strong>N/A</strong><small>Backend contract not available</small></article>)}</section>
    <section className={styles.card}><div className={styles.cardHeader}><div><h2>Why this page is unavailable</h2><p>The backend does not currently expose trustworthy per-account request totals, latency distributions, errors, quotas or request logs.</p></div></div><div className={styles.rateLimit}><div className={styles.health}><AlertTriangle size={17} />No mock traffic or invented production metrics are shown.</div><p>Use API Explorer to inspect a real request and its rate-limit headers. API Keys shows each credential's configured requests-per-minute limit.</p><div className={styles.rateFooter}><Link to="/developer/api-explorer">Open API Explorer</Link><Link to="/developer/api-keys">Open API Keys</Link></div></div></section>
  </div>;
}
