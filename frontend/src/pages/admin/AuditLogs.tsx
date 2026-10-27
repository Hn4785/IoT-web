import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/common/Button";
import ErrorState from "@/components/common/ErrorState";
import Loading from "@/components/common/Loading";
import PageHeader from "@/components/layout/PageHeader";
import { adminAuditService, type AuditEventDto, type AuditQuery } from "@/services/adminAuditService";
import { normalizeApiError } from "@/utils/apiError";
import { formatVietnamDateTime } from "@/utils/formatDateTime";

import styles from "./AuditLogs.module.css";

const PAGE_SIZE = 20;

function localDayToUtc(day: string, endOfDay: boolean): string {
  return new Date(`${day}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`).toISOString();
}

export default function AuditLogs() {
  const { user } = useAuth();
  const [resultDraft, setResultDraft] = useState<AuditQuery["result"] | "">("");
  const [fromDraft, setFromDraft] = useState("");
  const [toDraft, setToDraft] = useState("");
  const [filters, setFilters] = useState<AuditQuery>({ limit: PAGE_SIZE });
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [refreshId, setRefreshId] = useState(0);
  const [items, setItems] = useState<AuditEventDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");

  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    let active = true;
    const query = { ...filters, cursor: cursors[pageIndex] };
    adminAuditService.list(query).then(
      (data) => {
        if (!active) return;
        setItems(data.items);
        setNextCursor(data.nextCursor);
        setError("");
        setLoading(false);
      },
      (reason) => {
        if (!active) return;
        setError(normalizeApiError(reason).message);
        setLoading(false);
      },
    );
    return () => { active = false; };
  }, [user?.isSuperAdmin, filters, cursors, pageIndex, refreshId]);

  if (!user?.isSuperAdmin) {
    return <div className={styles.page}><ErrorState variant="403" description="Only the Super Admin can read audit events." /></div>;
  }

  function applyFilters() {
    if (Boolean(fromDraft) !== Boolean(toDraft)) {
      setFilterError("Choose both start and end dates, or leave both blank.");
      return;
    }
    if (fromDraft && toDraft) {
      const from = localDayToUtc(fromDraft, false);
      const to = localDayToUtc(toDraft, true);
      if (Date.parse(from) > Date.parse(to) || Date.parse(to) - Date.parse(from) > 31 * 86_400_000) {
        setFilterError("Choose a valid range of at most 31 days.");
        return;
      }
    }
    setFilterError("");
    setLoading(true);
    setCursors([undefined]);
    setPageIndex(0);
    setFilters({
      limit: PAGE_SIZE,
      ...(resultDraft ? { result: resultDraft } : {}),
      ...(fromDraft && toDraft ? { from: localDayToUtc(fromDraft, false), to: localDayToUtc(toDraft, true) } : {}),
    });
  }

  function refresh() {
    setLoading(true);
    setRefreshId((value) => value + 1);
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Audit Log"
        description="Administrative activity recorded by the backend. Super Admin only."
        actions={<Button variant="outline" icon={<RefreshCw size={16} />} onClick={refresh} disabled={loading}>Refresh</Button>}
      />
      <section className={styles.filters} aria-label="Audit filters">
        <label>Result
          <select value={resultDraft} onChange={(event) => setResultDraft(event.target.value as AuditQuery["result"] | "")}>
            <option value="">All results</option>
            <option value="SUCCESS">Success</option>
            <option value="DENIED">Denied</option>
            <option value="FAILURE">Failure</option>
          </select>
        </label>
        <label>From <input type="date" value={fromDraft} onChange={(event) => setFromDraft(event.target.value)} /></label>
        <label>To <input type="date" value={toDraft} onChange={(event) => setToDraft(event.target.value)} /></label>
        <Button variant="outline" onClick={applyFilters}>Apply</Button>
      </section>
      {filterError && <p className={styles.error} role="alert">{filterError}</p>}
      {loading && <Loading label="Loading audit events..." />}
      {error && <ErrorState description={error} onRetry={refresh} />}
      {!loading && !error && (
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div><h2>Audit Activity</h2><p>Server-side results for the selected filters.</p></div>
            <span className={styles.count}>Page {pageIndex + 1} · {items.length} events</span>
          </div>
          {items.length === 0 ? <p className={styles.empty}>No audit events match these filters.</p> : (
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Time</th><th>Action</th><th>Result</th><th>Actor ID</th><th>Target</th><th>Request ID</th></tr></thead>
                <tbody>{items.map((event) => (
                  <tr key={event.id}>
                    <td><time dateTime={event.createdAt}>{formatVietnamDateTime(event.createdAt)}</time></td>
                    <td>{event.action}</td>
                    <td>{event.result}</td>
                    <td className={styles.mono}>{event.actorUserId ?? "System"}</td>
                    <td>{event.targetType}{event.targetId ? ` · ${event.targetId}` : ""}</td>
                    <td className={styles.mono}>{event.requestId}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div className={styles.pageActions}>
            <Button variant="outline" disabled={pageIndex === 0} onClick={() => { setLoading(true); setPageIndex(pageIndex - 1); }}>Previous</Button>
            <Button variant="outline" disabled={!nextCursor} onClick={() => {
              if (!nextCursor) return;
              setLoading(true);
              setCursors((current) => [...current.slice(0, pageIndex + 1), nextCursor]);
              setPageIndex(pageIndex + 1);
            }}>Next</Button>
          </div>
        </section>
      )}
    </div>
  );
}
