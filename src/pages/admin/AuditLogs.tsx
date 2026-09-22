import { useMemo, useState } from "react";
import {
  Activity,
  Radio,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/common/Button";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import DateRangePicker from "@/components/common/DateRangePicker";
import Pagination from "@/components/common/Pagination";
import { formatVietnamDateTime } from "@/utils/formatDateTime";

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

const auditLogs: AuditLog[] = [];

const services: ReadonlyArray<readonly [
  string,
  typeof Radio,
  string,
  string,
  string,
  string,
]> = [];

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
type ServiceName = string;

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
                      <time dateTime={log.timestamp} title={log.timestamp}>
                        {formatVietnamDateTime(log.timestamp)}
                      </time>
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
