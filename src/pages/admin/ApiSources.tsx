import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Copy, Eye, KeyRound, Plus, RefreshCw, Share2, TestTube2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Button from "@/components/common/Button";
import EmptyState from "@/components/common/EmptyState";
import ErrorState from "@/components/common/ErrorState";
import Loading from "@/components/common/Loading";
import { ConfirmDialog, Modal } from "@/components/common/Modal";
import PageHeader from "@/components/layout/PageHeader";
import { useStationHierarchy } from "@/hooks/useStationHierarchy";
import {
  dataSourceService,
  type DataSource,
  type DataSourceGrant,
  type DataSourceGrantCandidate,
  type DataSourceStation,
  type ResourceChoice,
} from "@/services/dataSourceService";
import { normalizeApiError } from "@/utils/apiError";
import { copyText } from "@/utils/credentialInput";
import { formatVietnamDateTime } from "@/utils/formatDateTime";

import styles from "./ApiSources.module.css";

export default function ApiSources() {
  const navigate = useNavigate();
  const hierarchy = useStationHierarchy();
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [xApiKey, setXApiKey] = useState("");
  const [farmName, setFarmName] = useState("");
  const [plotName, setPlotName] = useState("");

  const [accessSource, setAccessSource] = useState<DataSource | null>(null);
  const [grants, setGrants] = useState<DataSourceGrant[]>([]);
  const [candidates, setCandidates] = useState<DataSourceGrantCandidate[]>([]);
  const [sourceStations, setSourceStations] = useState<DataSourceStation[]>([]);
  const [grantDrafts, setGrantDrafts] = useState<Record<string, string[]>>({});
  const [accessLoading, setAccessLoading] = useState(false);
  const [removeSource, setRemoveSource] = useState<DataSource | null>(null);

  const [revealSource, setRevealSource] = useState<DataSource | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const loadSources = async () => {
    setLoading(true);
    setError("");
    try {
      setSources((await dataSourceService.list()).items);
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    dataSourceService.list().then(
      (page) => { if (active) setSources(page.items); },
      (reason) => { if (active) setError(normalizeApiError(reason).message); },
    ).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);

  const grantByUserId = useMemo(() => new Map(grants.map((grant) => [grant.user.id, grant])), [grants]);

  const clearAddForm = () => {
    setName("");
    setBaseUrl("");
    setXApiKey("");
    setFarmName("");
    setPlotName("");
  };

  const closeAdd = () => {
    setAddOpen(false);
    clearAddForm();
  };

  const resolveChoice = <T extends { id: string; name: string }>(value: string, options: T[]): ResourceChoice => {
    const normalized = value.trim();
    const existing = options.find((option) => option.name.localeCompare(normalized, undefined, { sensitivity: "accent" }) === 0);
    return existing ? { id: existing.id } : { name: normalized };
  };

  const addSource = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyId("create");
    setError("");
    try {
      const created = await dataSourceService.create({
        ...(name.trim() ? { name: name.trim() } : {}),
        baseUrl: baseUrl.trim(),
        xApiKey: xApiKey.trim(),
        farm: resolveChoice(farmName, hierarchy.farms),
        plot: resolveChoice(plotName, hierarchy.plots),
      });
      setSources((current) => [created, ...current]);
      setNotice(`${created.name} is connected.`);
      closeAdd();
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setBusyId("");
    }
  };

  const testConnection = async (source: DataSource) => {
    setBusyId(source.id);
    setError("");
    try {
      const result = await dataSourceService.test(source.id);
      setSources((current) => current.map((item) => item.id === source.id
        ? { ...item, ...result }
        : item));
      setNotice(`${source.name} is connected to ${result.stationCount} station${result.stationCount === 1 ? "" : "s"}.`);
    } catch (reason) {
      const message = normalizeApiError(reason).message;
      await loadSources();
      setError(message);
    } finally {
      setBusyId("");
    }
  };

  const openAccess = async (source: DataSource) => {
    setAccessSource(source);
    setAccessLoading(true);
    setError("");
    try {
      const [grantPage, stationPage, candidatePage] = await Promise.all([
        dataSourceService.listGrants(source.id),
        dataSourceService.listStations(source.id),
        dataSourceService.listGrantCandidates(source.id),
      ]);
      setGrants(grantPage.items);
      setSourceStations(stationPage.items);
      setGrantDrafts(Object.fromEntries(grantPage.items.map((grant) => [grant.user.id, [...grant.stationIds]])));
      setCandidates(candidatePage.items);
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setAccessLoading(false);
    }
  };

  const toggleStation = (userId: string, stationId: string) => {
    setGrantDrafts((current) => {
      const selected = new Set(current[userId] ?? []);
      if (selected.has(stationId)) selected.delete(stationId);
      else selected.add(stationId);
      return { ...current, [userId]: [...selected] };
    });
  };

  const saveGrant = async (userId: string) => {
    if (!accessSource) return;
    setBusyId(userId);
    setError("");
    try {
      const stationIds = grantDrafts[userId] ?? [];
      if (stationIds.length > 0) await dataSourceService.setGrantStations(accessSource.id, userId, stationIds);
      else await dataSourceService.revoke(accessSource.id, userId);
      setGrants((await dataSourceService.listGrants(accessSource.id)).items);
      await loadSources();
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setBusyId("");
    }
  };

  const confirmRemoveSource = async () => {
    if (!removeSource) return;
    setBusyId(removeSource.id);
    setError("");
    try {
      await dataSourceService.remove(removeSource.id);
      setSources((current) => current.filter((source) => source.id !== removeSource.id));
      setNotice(`${removeSource.name} was removed. Its historical audit data was preserved.`);
      setRemoveSource(null);
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setBusyId("");
    }
  };

  const closeReveal = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = null;
    setRevealSource(null);
    setCurrentPassword("");
    setRevealedKey("");
    setCopyStatus("");
  };

  const revealKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!revealSource) return;
    setBusyId("reveal");
    setError("");
    try {
      const result = await dataSourceService.reveal(revealSource.id, currentPassword);
      setRevealedKey(result.xApiKey);
      setCurrentPassword("");
      revealTimer.current = setTimeout(closeReveal, result.expiresInSeconds * 1000);
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="API Sources"
        description="Connect station APIs, review who can see them, and manage access owned by your account."
        actions={<div className={styles.headerActions}>
          <Button variant="outline" icon={<RefreshCw size={16} />} onClick={() => void loadSources()}>Refresh</Button>
          <Button icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>Add API Source</Button>
        </div>}
      />
      {error && <ErrorState description={error} onRetry={() => { setError(""); void loadSources(); }} />}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {loading && <Loading label="Loading API sources..." />}
      {!loading && !error && sources.length === 0 && (
        <EmptyState
          icon={<KeyRound size={24} />}
          title="No API sources"
          description="Add the API URL and X-API-Key supplied with a real station connection."
          action={{ label: "Add API Source", onClick: () => setAddOpen(true) }}
        />
      )}
      {!loading && sources.length > 0 && (
        <section className={styles.panel} aria-label="API source inventory">
          <div className={styles.tableWrap}>
            <table>
              <thead><tr>
                <th>Source Name</th><th>Owner</th><th>Stations</th><th>Visible Accounts</th>
                <th>Connection Status</th><th>Last Checked</th><th>Actions</th>
              </tr></thead>
              <tbody>{sources.map((source) => (
                <tr key={source.id}>
                  <td><strong>{source.name}</strong><span className={styles.subtle}>{source.baseUrl}</span></td>
                  <td>{source.owner.displayName}<span className={styles.subtle}>{source.owner.role === "ADMIN" ? "Admin" : "Farmer"}</span></td>
                  <td>{source.stationCount}</td>
                  <td>{source.visibleAccountCount}</td>
                  <td><span className={`${styles.status} ${source.connectionStatus === "CONNECTED" ? styles.connected : styles.failed}`}>
                    {source.connectionStatus === "CONNECTED" ? "Connected" : "Last check failed"}
                  </span></td>
                  <td>{formatVietnamDateTime(source.lastCheckedAt)}</td>
                  <td><div className={styles.actions}>
                    <Button size="sm" variant="ghost" icon={<BarChart3 size={14} />} onClick={() => navigate("/admin/devices")}>View Data</Button>
                    {source.canManageAccess && <Button size="sm" variant="ghost" icon={<Share2 size={14} />} onClick={() => void openAccess(source)}>Manage Access</Button>}
                    {source.canManageAccess && <Button size="sm" variant="ghost" icon={<TestTube2 size={14} />} loading={busyId === source.id} onClick={() => void testConnection(source)}>Test</Button>}
                    {source.canRevealKey && <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setRevealSource(source)}>Reveal Key</Button>}
                    {source.canManageAccess && <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setRemoveSource(source)}>Remove Source</Button>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      <Modal isOpen={addOpen} onClose={closeAdd} title="Add API Source" description="Connect a soil station API and organize it under a farm and plot." size="lg">
        <form className={styles.form} onSubmit={addSource}>
          <label>Source name <span className={styles.optional}>(optional)</span><input maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="Generated from the connection when left blank" /></label>
          <div className={styles.twoColumns}>
            <label>Farm<input required list="api-source-farms" value={farmName} onChange={(event) => {
              setFarmName(event.target.value);
              const farm = hierarchy.farms.find((item) => item.name === event.target.value);
              if (farm) hierarchy.setSelectedFarmId(farm.id);
            }} placeholder="Select or enter a farm" /><datalist id="api-source-farms">{hierarchy.farms.map((farm) => <option key={farm.id} value={farm.name} />)}</datalist></label>
            <label>Plot<input required list="api-source-plots" value={plotName} onChange={(event) => setPlotName(event.target.value)} placeholder="Select or enter a plot" /><datalist id="api-source-plots">{hierarchy.plots.map((plot) => <option key={plot.id} value={plot.name} />)}</datalist></label>
          </div>
          <label>API URL<input required type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://provider.example/api/v1" /></label>
          <label>X-API-Key<input required type="password" autoComplete="off" value={xApiKey} onChange={(event) => setXApiKey(event.target.value)} placeholder="Enter the source key" /></label>
          <p className={styles.help}>The key is sent once to the backend and is never stored in this browser.</p>
          <div className={styles.modalActions}><Button variant="outline" onClick={closeAdd}>Cancel</Button><Button type="submit" loading={busyId === "create"} disabled={!farmName.trim() || !plotName.trim()}>Connect Source</Button></div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(accessSource)} onClose={() => setAccessSource(null)} title={`Manage Access${accessSource ? ` — ${accessSource.name}` : ""}`} description="Shared accounts can view station data but cannot reveal or revoke the source key." size="md">
        {accessLoading ? <Loading label="Loading accounts..." /> : (
          <div className={styles.accountList}>
            {candidates.length === 0 && <p>No eligible accounts found.</p>}
            {candidates.map((candidate) => {
              const selected = new Set(grantDrafts[candidate.id] ?? []);
              const existing = grantByUserId.get(candidate.id)?.stationIds ?? [];
              const changed = selected.size !== existing.length || existing.some((id) => !selected.has(id));
              return <div key={candidate.id} className={styles.accountCard}>
                <div className={styles.accountHeading}>
                  <div>
                    <strong>{candidate.displayName}</strong>
                    <span>{candidate.email}</span>
                    <span>{candidate.role === "FARMER" ? "Farmer" : "Client Developer"}</span>
                  </div>
                  <span>{selected.size} selected</span>
                </div>
                {sourceStations.length === 0 && <p className={styles.help}>No soil stations were found for this source.</p>}
                <div className={styles.stationChecks}>{sourceStations.map((station) => <label key={station.id}>
                  <input type="checkbox" checked={selected.has(station.id)} onChange={() => toggleStation(candidate.id, station.id)} />
                  <span><strong>{station.name}</strong><small>{station.code}</small></span>
                </label>)}</div>
                <div className={styles.accountActions}><Button size="sm" variant={selected.size === 0 && existing.length > 0 ? "danger" : "outline"} disabled={!changed} loading={busyId === candidate.id} onClick={() => void saveGrant(candidate.id)}>{selected.size === 0 && existing.length > 0 ? "Revoke Access" : "Save Access"}</Button></div>
              </div>;
            })}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(removeSource)}
        onClose={() => setRemoveSource(null)}
        onConfirm={() => void confirmRemoveSource()}
        title="Remove API Source"
        description={`Remove ${removeSource?.name ?? "this source"}? Access and alert rules will stop immediately. Historical audit data will be kept.`}
        confirmText="Remove Source"
        variant="danger"
      />

      <Modal isOpen={Boolean(revealSource)} onClose={closeReveal} title="Reveal X-API-Key" description="Only the source owner can reveal this key. It closes automatically after 30 seconds." size="sm">
        {!revealedKey ? <form className={styles.form} onSubmit={revealKey}>
          <label>Current password<input required minLength={12} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <div className={styles.modalActions}><Button variant="outline" onClick={closeReveal}>Cancel</Button><Button type="submit" loading={busyId === "reveal"}>Reveal</Button></div>
        </form> : <div className={styles.secretBox}>
          <code>{revealedKey}</code>
          <Button size="sm" icon={<Copy size={14} />} onClick={async () => setCopyStatus(await copyText(revealedKey) ? "Copied" : "Copy failed")}>Copy</Button>
          {copyStatus && <span role="status">{copyStatus}</span>}
        </div>}
      </Modal>
    </div>
  );
}
