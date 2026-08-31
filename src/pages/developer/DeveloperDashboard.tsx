import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  KeyRound,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import styles from "./DeveloperDashboard.module.css";

interface DeveloperKpi {
  label: string;
  value: string;
  description: string;
  trend?: string;
  icon: React.ReactNode;
}

const kpis: DeveloperKpi[] = [
  {
    label: "Active API Keys",
    value: "4",
    description: "Currently active",
    trend: "+1 this month",
    icon: <KeyRound size={20} />,
  },
  {
    label: "Requests Today",
    value: "18,426",
    description: "API requests",
    trend: "+12.8%",
    icon: <Activity size={20} />,
  },
  {
    label: "Requests This Month",
    value: "482,913",
    description: "Monthly usage",
    trend: "+8.4%",
    icon: <BarChart3 size={20} />,
  },
  {
    label: "Current Rate Limit",
    value: "120/min",
    description: "Configured limit",
    icon: <Clock3 size={20} />,
  },
  {
    label: "Remaining Quota",
    value: "67%",
    description: "Monthly quota",
    trend: "Healthy",
    icon: <ShieldCheck size={20} />,
  },
  {
    label: "API Errors",
    value: "1.24%",
    description: "Current error rate",
    trend: "-0.31%",
    icon: <AlertCircle size={20} />,
  },
];

const requestActivity = [
  { label: "08:00", value: 820 },
  { label: "10:00", value: 1240 },
  { label: "12:00", value: 1680 },
  { label: "14:00", value: 1430 },
  { label: "16:00", value: 1960 },
  { label: "18:00", value: 1540 },
];

const recentRequests = [
  {
    time: "17:02:41",
    method: "GET",
    endpoint: "/api/v1/data/latest",
    status: 200,
    responseTime: "142 ms",
  },
  {
    time: "17:01:58",
    method: "GET",
    endpoint: "/api/v1/stations",
    status: 200,
    responseTime: "96 ms",
  },
  {
    time: "16:59:32",
    method: "GET",
    endpoint: "/api/v1/data/history",
    status: 200,
    responseTime: "284 ms",
  },
  {
    time: "16:57:11",
    method: "GET",
    endpoint: "/api/v1/data/latest",
    status: 429,
    responseTime: "31 ms",
  },
];

function getBarHeight(value: number, max: number): string {
  return `${Math.max((value / max) * 100, 8)}%`;
}

export default function DeveloperDashboard() {
  const maxActivity = Math.max(...requestActivity.map((item) => item.value));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>DEVELOPER PORTAL</div>
          <h1>Developer Overview</h1>
          <p>
            Monitor API usage, credentials, quotas, and integration activity.
          </p>
        </div>

        <div className={styles.headerStatus}>
          <span className={styles.statusDot} />
          API Service Operational
        </div>
      </div>

      <section className={styles.kpiGrid}>
        {kpis.map((kpi) => (
          <article className={styles.kpiCard} key={kpi.label}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiIcon}>{kpi.icon}</span>
              {kpi.trend && (
                <span className={styles.kpiTrend}>
                  <TrendingUp size={13} />
                  {kpi.trend}
                </span>
              )}
            </div>

            <div className={styles.kpiValue}>{kpi.value}</div>
            <div className={styles.kpiLabel}>{kpi.label}</div>
            <div className={styles.kpiDescription}>{kpi.description}</div>
          </article>
        ))}
      </section>

      <section className={styles.mainGrid}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Request Activity</h2>
              <p>API requests throughout today</p>
            </div>

            <span className={styles.period}>Today</span>
          </div>

          <div className={styles.chart}>
            {requestActivity.map((item) => (
              <div className={styles.barColumn} key={item.label}>
                <div className={styles.barValue}>{item.value}</div>

                <div className={styles.barTrack}>
                  <div
                    className={styles.bar}
                    style={{ height: getBarHeight(item.value, maxActivity) }}
                  />
                </div>

                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>API Health</h2>
              <p>Current service indicators</p>
            </div>
          </div>

          <div className={styles.healthList}>
            <div className={styles.healthItem}>
              <CheckCircle2 size={18} />
              <div>
                <strong>API Gateway</strong>
                <span>Operational</span>
              </div>
              <b>99.99%</b>
            </div>

            <div className={styles.healthItem}>
              <CheckCircle2 size={18} />
              <div>
                <strong>Data Service</strong>
                <span>Operational</span>
              </div>
              <b>99.97%</b>
            </div>

            <div className={styles.healthItem}>
              <CheckCircle2 size={18} />
              <div>
                <strong>Authentication</strong>
                <span>Operational</span>
              </div>
              <b>100%</b>
            </div>

            <div className={styles.healthItem}>
              <AlertCircle size={18} />
              <div>
                <strong>Rate Limiting</strong>
                <span>2 throttled requests</span>
              </div>
              <b>98.7%</b>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2>Recent API Requests</h2>
            <p>Latest requests made through your API keys</p>
          </div>

          <button className={styles.textButton}>View request logs</button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Response Time</th>
              </tr>
            </thead>

            <tbody>
              {recentRequests.map((request) => (
                <tr key={`${request.time}-${request.endpoint}`}>
                  <td className={styles.mono}>{request.time}</td>
                  <td>
                    <span className={styles.method}>{request.method}</span>
                  </td>
                  <td className={styles.endpoint}>{request.endpoint}</td>
                  <td>
                    <span
                      className={
                        request.status === 200
                          ? styles.successStatus
                          : styles.errorStatus
                      }
                    >
                      {request.status}
                    </span>
                  </td>
                  <td>{request.responseTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.quickLinks}>
        <div>
          <ArrowUpRight size={18} />
          <span>
            API documentation provides endpoint parameters, headers and
            response examples.
          </span>
        </div>

        <div>
          <ShieldCheck size={18} />
          <span>
            Never expose an API secret in public frontend applications.
          </span>
        </div>
      </section>
    </div>
  );
}