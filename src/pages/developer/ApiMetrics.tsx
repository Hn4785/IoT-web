import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  TrendingUp,
} from "lucide-react";
import styles from "./ApiMetrics.module.css";

const requestData = [
  { label: "08:00", value: 640 },
  { label: "10:00", value: 910 },
  { label: "12:00", value: 1240 },
  { label: "14:00", value: 1120 },
  { label: "16:00", value: 1580 },
  { label: "18:00", value: 1310 },
];

const requestLogs = [
  {
    timestamp: "17:02:41",
    endpoint: "/api/v1/data/latest",
    method: "GET",
    status: 200,
    responseTime: "142 ms",
    key: "key_7f3a92",
    ip: "10.0.4.18",
    requestId: "req_81af21",
  },
  {
    timestamp: "17:01:58",
    endpoint: "/api/v1/stations",
    method: "GET",
    status: 200,
    responseTime: "96 ms",
    key: "key_7f3a92",
    ip: "10.0.4.18",
    requestId: "req_71c842",
  },
  {
    timestamp: "16:59:32",
    endpoint: "/api/v1/data/history",
    method: "GET",
    status: 200,
    responseTime: "284 ms",
    key: "key_31bc81",
    ip: "10.0.4.24",
    requestId: "req_52a912",
  },
  {
    timestamp: "16:57:11",
    endpoint: "/api/v1/data/latest",
    method: "GET",
    status: 429,
    responseTime: "31 ms",
    key: "key_31bc81",
    ip: "10.0.4.24",
    requestId: "req_2f8c11",
  },
];

const metrics = [
  {
    label: "Requests Today",
    value: "18,426",
    change: "+12.8%",
    icon: <Activity size={19} />,
  },
  {
    label: "Requests This Month",
    value: "482,913",
    change: "+8.4%",
    icon: <TrendingUp size={19} />,
  },
  {
    label: "Requests / Minute",
    value: "84",
    change: "70% of limit",
    icon: <Gauge size={19} />,
  },
  {
    label: "Remaining Quota",
    value: "67%",
    change: "Healthy",
    icon: <Gauge size={19} />,
  },
  {
    label: "Error Rate",
    value: "1.24%",
    change: "-0.31%",
    icon: <AlertTriangle size={19} />,
  },
  {
    label: "Avg Response Time",
    value: "168 ms",
    change: "-12 ms",
    icon: <Clock3 size={19} />,
  },
];

export default function ApiMetrics() {
  const maxValue = Math.max(...requestData.map((item) => item.value));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>DEVELOPER PORTAL / ANALYTICS</div>
          <h1>API Metrics</h1>
          <p>Track API traffic, latency, errors, and rate-limit usage.</p>
        </div>

        <select className={styles.period}>
          <option>Today</option>
          <option>Last 7 days</option>
          <option>Last 30 days</option>
        </select>
      </div>

      <section className={styles.metricGrid}>
        {metrics.map((metric) => (
          <article className={styles.metricCard} key={metric.label}>
            <div className={styles.metricIcon}>{metric.icon}</div>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.change}</small>
          </article>
        ))}
      </section>

      <section className={styles.chartGrid}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Requests Over Time</h2>
              <p>Number of API requests by period.</p>
            </div>
          </div>

          <div className={styles.chart}>
            {requestData.map((item) => (
              <div className={styles.chartColumn} key={item.label}>
                <span>{item.value}</span>

                <div className={styles.track}>
                  <div
                    className={styles.column}
                    style={{
                      height: `${Math.max((item.value / maxValue) * 100, 8)}%`,
                    }}
                  />
                </div>

                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Successful vs Failed</h2>
              <p>Current request outcome distribution.</p>
            </div>
          </div>

          <div className={styles.outcome}>
            <div className={styles.donut}>
              <div>
                <strong>98.76%</strong>
                <span>Success</span>
              </div>
            </div>

            <div className={styles.legend}>
              <div>
                <span className={styles.successDot} />
                <span>Successful</span>
                <strong>18,198</strong>
              </div>

              <div>
                <span className={styles.errorDot} />
                <span>Failed</span>
                <strong>228</strong>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Rate Limit Usage</h2>
              <p>Current requests compared with the configured limit.</p>
            </div>
          </div>

          <div className={styles.rateLimit}>
            <div className={styles.rateTop}>
              <strong>84 / 120 requests</strong>
              <span>70%</span>
            </div>

            <div className={styles.progressTrack}>
              <div className={styles.progress} />
            </div>

            <div className={styles.rateFooter}>
              <span>Current</span>
              <span>Limit: 120/min</span>
            </div>
          </div>

          <div className={styles.latency}>
            <div>
              <span>P50</span>
              <strong>102 ms</strong>
            </div>
            <div>
              <span>P95</span>
              <strong>412 ms</strong>
            </div>
            <div>
              <span>P99</span>
              <strong>781 ms</strong>
            </div>
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Response Latency</h2>
              <p>Current service latency distribution.</p>
            </div>
          </div>

          <div className={styles.latencyBars}>
            <div>
              <span>&lt; 100 ms</span>
              <div>
                <i style={{ width: "64%" }} />
              </div>
              <strong>64%</strong>
            </div>

            <div>
              <span>100–300 ms</span>
              <div>
                <i style={{ width: "27%" }} />
              </div>
              <strong>27%</strong>
            </div>

            <div>
              <span>&gt; 300 ms</span>
              <div>
                <i style={{ width: "9%" }} />
              </div>
              <strong>9%</strong>
            </div>
          </div>

          <div className={styles.health}>
            <CheckCircle2 size={17} />
            API latency is within the current monitoring baseline.
          </div>
        </article>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2>API Request Log</h2>
            <p>Recent requests across your API keys.</p>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Endpoint</th>
                <th>Method</th>
                <th>Status Code</th>
                <th>Response Time</th>
                <th>API Key</th>
                <th>IP</th>
                <th>Request ID</th>
              </tr>
            </thead>

            <tbody>
              {requestLogs.map((log) => (
                <tr key={log.requestId}>
                  <td className={styles.mono}>{log.timestamp}</td>
                  <td className={styles.endpoint}>{log.endpoint}</td>
                  <td className={styles.mono}>{log.method}</td>
                  <td>
                    <span
                      className={
                        log.status === 200
                          ? styles.successStatus
                          : styles.errorStatus
                      }
                    >
                      {log.status}
                    </span>
                  </td>
                  <td>{log.responseTime}</td>
                  <td className={styles.mono}>{log.key}</td>
                  <td className={styles.mono}>{log.ip}</td>
                  <td className={styles.mono}>{log.requestId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}