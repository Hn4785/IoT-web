import { useMemo, useState } from "react";
import {
  Activity,
  Database,
  MessageSquare,
  Radio,
  Server,
  Wifi,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/common/Button";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import DateRangePicker from "@/components/common/DateRangePicker";
import Pagination from "@/components/common/Pagination";

import type { DateRange } from "react-day-picker";

import styles from "./AuditLogs.module.css";

type AuditResult =
  | "success"
  | "failed";

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  resourceId: string;
  previous: string;
  next: string;
  source: string;
  result: AuditResult;
}

const auditLogs: AuditLog[] = [
  {
    id: "AUD-001",
    timestamp: "2026-08-30T16:42:11Z",
    user: "Alex Morgan",
    action: "Changed sensor threshold",
    resource: "Alert Rule",
    resourceId: "RULE-001",
    previous: "30%",
    next: "25%",
    source: "10.20.4.18",
    result: "success",
  },
  {
    id: "AUD-002",
    timestamp: "2026-08-30T16:28:34Z",
    user: "Daniel Nguyen",
    action: "Updated station configuration",
    resource: "Station",
    resourceId: "ST-001",
    previous: "10s",
    next: "5s",
    source: "10.20.4.21",
    result: "success",
  },
  {
    id: "AUD-003",
    timestamp: "2026-08-30T16:15:02Z",
    user: "Alex Morgan",
    action: "Rotated gateway credential",
    resource: "Gateway",
    resourceId: "GW-004",
    previous: "credential-v3",
    next: "credential-v4",
    source: "10.20.4.18",
    result: "success",
  },
  {
    id: "AUD-004",
    timestamp: "2026-08-30T15:58:46Z",
    user: "Emily Tran",
    action: "Updated station configuration",
    resource: "Station",
    resourceId: "ST-004",
    previous: "20s",
    next: "15s",
    source: "10.20.4.25",
    result: "failed",
  },
  {
    id: "AUD-005",
    timestamp: "2026-08-30T15:41:20Z",
    user: "Alex Morgan",
    action: "Created alert rule",
    resource: "Alert Rule",
    resourceId: "RULE-004",
    previous: "—",
    next: "pH < 5.5",
    source: "10.20.4.18",
    result: "success",
  },
  {
    id: "AUD-006",
    timestamp: "2026-08-30T15:22:05Z",
    user: "System",
    action: "Device heartbeat processed",
    resource: "Station",
    resourceId: "ST-003",
    previous: "offline",
    next: "online",
    source: "MQTT",
    result: "success",
  },
  {
    id: "AUD-007",
    timestamp: "2026-08-30T14:58:09Z",
    user: "Daniel Nguyen",
    action: "Changed user role",
    resource: "User",
    resourceId: "USR-008",
    previous: "operator",
    next: "technician",
    source: "10.20.4.21",
    result: "success",
  },
];

const services = [
  [
    "MQTT Broker",
    Radio,
    "99.98%",
    "0.02%",
    "1,842 msg/s",
    "84 ms",
  ],
  [
    "Ingestion",
    Database,
    "99.94%",
    "0.06%",
    "1,817 msg/s",
    "112 ms",
  ],
  [
    "Notification",
    MessageSquare,
    "99.91%",
    "0.09%",
    "42 msg/s",
    "238 ms",
  ],
  [
    "WebSocket",
    Wifi,
    "99.97%",
    "0.03%",
    "684 conn/s",
    "96 ms",
  ],
  [
    "Dead Letter Queue",
    Server,
    "100%",
    "0%",
    "2 msg/min",
    "—",
  ],
] as const;

/**
 * FIX TYPE:
 * Tạo union type từ tên các service trong mảng services.
 *
 * Kết quả:
 * "MQTT Broker"
 * | "Ingestion"
 * | "Notification"
 * | "WebSocket"
 * | "Dead Letter Queue"
 */
type ServiceName = (typeof services)[number][0];

export default function AuditLogs() {
  const [query, setQuery] = useState("");

  const [result, setResult] =
    useState<"all" | AuditResult>("all");

  const [dateRange, setDateRange] =
    useState<DateRange | undefined>();

  const [page, setPage] = useState(1);

  /**
   * FIX ERROR TS2345:
   * Không để TypeScript tự suy luận chỉ là "MQTT Broker".
   * Khai báo rõ selectedService có kiểu ServiceName.
   */
  const [selectedService, setSelectedService] =
    useState<ServiceName>(services[0][0]);

  const pageSize = 6;

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const searchableText = `
        ${log.user}
        ${log.action}
        ${log.resource}
        ${log.resourceId}
      `.toLowerCase();

      const matchesSearch =
        !query ||
        searchableText.includes(
          query.toLowerCase(),
        );

      const matchesResult =
        result === "all" ||
        log.result === result;

      return matchesSearch && matchesResult;
    });
  }, [query, result]);

  const selectedServiceData =
    services.find(
      (service) =>
        service[0] === selectedService,
    ) ?? services[0];

  const ServiceIcon =
    selectedServiceData[1];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Audit Logs & System Monitoring"
        description="Track administrative changes and monitor critical platform services."
        actions={
          <Button variant="outline">
            Export Logs
          </Button>
        }
      />

      {/* Filters */}
      <section className={styles.filters}>
        <SearchInput
          onSearch={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="Search audit logs..."
        />

        <select
          value={result}
          onChange={(event) => {
            setResult(
              event.target.value as
                | "all"
                | AuditResult,
            );
            setPage(1);
          }}
        >
          <option value="all">
            All Results
          </option>

          <option value="success">
            Success
          </option>

          <option value="failed">
            Failed
          </option>
        </select>

        <select>
          <option>
            All Actions
          </option>

          <option>
            Configuration
          </option>

          <option>
            Permission
          </option>

          <option>
            Credential
          </option>

          <option>
            Alert Rule
          </option>
        </select>

        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="Time range"
        />
      </section>

      {/* Audit Activity */}
      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>
              Audit Activity
            </h2>

            <p>
              Administrative activity records.
            </p>
          </div>

          <span className={styles.count}>
            {filteredLogs.length} visible events
          </span>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Resource ID</th>
                <th>Previous Value</th>
                <th>New Value</th>
                <th>IP / Source</th>
                <th>Result</th>
              </tr>
            </thead>

            <tbody>
              {filteredLogs
                .slice(
                  (page - 1) * pageSize,
                  page * pageSize,
                )
                .map((log) => (
                  <tr key={log.id}>
                    <td>
                      {log.timestamp}
                    </td>

                    <td>
                      {log.user}
                    </td>

                    <td>
                      {log.action}
                    </td>

                    <td>
                      {log.resource}
                    </td>

                    <td
                      className={styles.mono}
                    >
                      {log.resourceId}
                    </td>

                    <td>
                      {log.previous}
                    </td>

                    <td>
                      {log.next}
                    </td>

                    <td
                      className={styles.mono}
                    >
                      {log.source}
                    </td>

                    <td>
                      <StatusBadge
                        status={
                          log.result === "success"
                            ? "active"
                            : "critical"
                        }
                        label={
                          log.result === "success"
                            ? "Success"
                            : "Failed"
                        }
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalItems={filteredLogs.length}
          pageSize={pageSize}
          onPageChange={setPage}
          itemLabel="events"
        />
      </section>

      {/* System Monitoring */}
      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>
              System Monitoring
            </h2>

            <p>
              Health of critical platform services.
            </p>
          </div>

          <span className={styles.live}>
            <span />
            Live
          </span>
        </div>

        <div className={styles.serviceTabs}>
          {services.map(([name, Icon]) => (
            <button
              key={name}
              className={
                selectedService === name
                  ? styles.activeService
                  : ""
              }
              onClick={() =>
                setSelectedService(name)
              }
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </div>

        <div className={styles.serviceDetail}>
          <div className={styles.serviceTitle}>
            <span className={styles.serviceIcon}>
              <ServiceIcon size={20} />
            </span>

            <div>
              <h3>
                {selectedServiceData[0]}
              </h3>

              <StatusBadge
                status="active"
                label="Operational"
              />
            </div>
          </div>

          <div className={styles.metrics}>
            <div>
              <span>
                Uptime
              </span>

              <strong>
                {selectedServiceData[2]}
              </strong>
            </div>

            <div>
              <span>
                Error Rate
              </span>

              <strong>
                {selectedServiceData[3]}
              </strong>
            </div>

            <div>
              <span>
                Throughput
              </span>

              <strong>
                {selectedServiceData[4]}
              </strong>
            </div>

            <div>
              <span>
                Latency
              </span>

              <strong>
                {selectedServiceData[5]}
              </strong>
            </div>
          </div>
        </div>

        <div className={styles.monitoringFooter}>
          <Activity size={16} />

          Last health check: 30 Aug 2026,
          16:59:42 · All monitored
          services responding normally.
        </div>
      </section>
    </div>
  );
}