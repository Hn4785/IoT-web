import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";

import { useStationHierarchy } from "../../hooks/useStationHierarchy.ts";
import { alertService } from "../../services/alertService.ts";
import type { AlertDto, AlertRuleDto, AlertSeverity, AlertStatus } from "../../types/alertApi.ts";
import { normalizeApiError } from "../../utils/apiError.ts";
import { Button } from "../common/Button.tsx";
import PageHeader from "../layout/PageHeader.tsx";
import styles from "./AlertWorkspace.module.css";

interface AlertWorkspaceProps {
  title: string;
  description: string;
  canAct?: boolean;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AlertWorkspace({ title, description, canAct = true }: AlertWorkspaceProps) {
  const hierarchy = useStationHierarchy();
  const [alerts, setAlerts] = useState<AlertDto[]>([]);
  const [rules, setRules] = useState<AlertRuleDto[]>([]);
  const [status, setStatus] = useState<"" | AlertStatus>("");
  const [severity, setSeverity] = useState<"" | AlertSeverity>("");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState("");
  const [error, setError] = useState("");

  const loadAlerts = useCallback(async () => {
    try {
      const page = await alertService.listAlerts({
        stationId: hierarchy.selectedStationId || undefined,
        status: status || undefined,
        severity: severity || undefined,
        limit: 100,
      });
      setAlerts(page.items);
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setLoading(false);
    }
  }, [hierarchy.selectedStationId, severity, status]);

  useEffect(() => {
    let active = true;
    alertService.listAlerts({
      stationId: hierarchy.selectedStationId || undefined,
      status: status || undefined,
      severity: severity || undefined,
      limit: 100,
    }).then(
      (page) => {
        if (!active) return;
        setAlerts(page.items);
        setLoading(false);
      },
      (reason) => {
        if (!active) return;
        setError(normalizeApiError(reason).message);
        setLoading(false);
      },
    );
    return () => { active = false; };
  }, [hierarchy.selectedStationId, severity, status]);

  useEffect(() => {
    let active = true;
    if (!hierarchy.selectedStationId) {
      return () => { active = false; };
    }
    alertService.listRules(hierarchy.selectedStationId, { limit: 100 }).then(
      (page) => { if (active) setRules(page.items); },
      (reason) => { if (active) setError(normalizeApiError(reason).message); },
    );
    return () => { active = false; };
  }, [hierarchy.selectedStationId]);

  async function runAction(alert: AlertDto, action: "acknowledge" | "resolve") {
    setActingId(alert.id);
    setError("");
    try {
      const updated = action === "acknowledge"
        ? await alertService.acknowledge(alert.id)
        : await alertService.resolve(alert.id);
      setAlerts((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setActingId("");
    }
  }

  async function toggleRule(rule: AlertRuleDto) {
    setActingId(rule.id);
    setError("");
    try {
      const updated = await alertService.updateRule(rule.id, {
        isEnabled: !rule.isEnabled,
        expectedRevision: rule.revision,
      });
      setRules((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setActingId("");
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={title}
        description={description}
        actions={<Button variant="outline" icon={<RefreshCw size={16} />} onClick={() => {
          setLoading(true);
          setError("");
          void loadAlerts();
        }}>Refresh</Button>}
      />

      <section className={styles.filters} aria-label="Alert filters">
        <select value={hierarchy.selectedFarmId} onChange={(event) => hierarchy.setSelectedFarmId(event.target.value)}>
          <option value="">All authorized farms</option>
          {hierarchy.farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}
        </select>
        <select value={hierarchy.selectedPlotId} onChange={(event) => hierarchy.setSelectedPlotId(event.target.value)} disabled={!hierarchy.selectedFarmId}>
          <option value="">All plots</option>
          {hierarchy.plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}
        </select>
        <select value={hierarchy.selectedStationId} onChange={(event) => hierarchy.setSelectedStationId(event.target.value)} disabled={!hierarchy.selectedPlotId}>
          <option value="">All stations</option>
          {hierarchy.stations.map((station) => <option key={station.id} value={station.id}>{station.code} — {station.name}</option>)}
        </select>
        <select value={severity} onChange={(event) => setSeverity(event.target.value as "" | AlertSeverity)}>
          <option value="">All severities</option>
          <option value="WARNING">Warning</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as "" | AlertStatus)}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </section>

      {(error || hierarchy.error) && <p className={styles.error} role="alert">{error || hierarchy.error}</p>}

      <section className={styles.card}>
        <div className={styles.sectionTitle}><BellRing size={20} /><h2>Alert lifecycle</h2><span>{alerts.length}</span></div>
        {loading ? <p className={styles.empty}>Loading alerts…</p> : alerts.length === 0 ? (
          <p className={styles.empty}>No alerts match the authorized scope and filters.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Station</th><th>Field</th><th>Value</th><th>Severity</th><th>Status</th><th>Opened</th>{canAct && <th>Actions</th>}</tr></thead>
              <tbody>{alerts.map((alert) => (
                <tr key={alert.id}>
                  <td><strong>{alert.station.code}</strong><small>{alert.station.name}</small></td>
                  <td>{alert.field}</td>
                  <td>{alert.latestValue} {alert.unit}</td>
                  <td><span className={alert.severity === "CRITICAL" ? styles.critical : styles.warning}>{alert.severity}</span></td>
                  <td>{alert.status}</td>
                  <td>{formatDate(alert.openedAt)}</td>
                  {canAct && <td className={styles.actions}>
                    {alert.status === "OPEN" && <Button size="sm" variant="outline" loading={actingId === alert.id} onClick={() => void runAction(alert, "acknowledge")}>Acknowledge</Button>}
                    {alert.status !== "RESOLVED" && <Button size="sm" loading={actingId === alert.id} onClick={() => void runAction(alert, "resolve")}>Resolve</Button>}
                  </td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.sectionTitle}><ShieldAlert size={20} /><h2>Rules for selected station</h2><span>{rules.length}</span></div>
        {!hierarchy.selectedStationId ? <p className={styles.empty}>Select a station to inspect its alert rules.</p> : rules.length === 0 ? (
          <p className={styles.empty}>No rules configured for this station.</p>
        ) : rules.map((rule) => (
          <div className={styles.rule} key={rule.id}>
            <div><strong>{rule.field} · {rule.severity}</strong><small>{rule.condition.operator} · revision {rule.revision} · {rule.evaluationStatus}</small></div>
            <Button size="sm" variant={rule.isEnabled ? "outline" : "primary"} loading={actingId === rule.id} onClick={() => void toggleRule(rule)}>
              {rule.isEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        ))}
        <p className={styles.note}><CheckCircle2 size={15} /> Rule creation stays disabled until the backend exposes station metadata revision required by the contract.</p>
      </section>
    </div>
  );
}
