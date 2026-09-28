import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Eye, KeyRound, Plus, RefreshCw, Share2, TestTube2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Button from "@/components/common/Button";
import EmptyState from "@/components/common/EmptyState";
import ErrorState from "@/components/common/ErrorState";
import Loading from "@/components/common/Loading";
import { Modal } from "@/components/common/Modal";
import PageHeader from "@/components/layout/PageHeader";
import { useStationHierarchy } from "@/hooks/useStationHierarchy";
import {
  dataSourceService,
  type DataSource,
  type DataSourceGrant,
} from "@/services/dataSourceService";
import { userService } from "@/services/userService";
import type { User } from "@/types/user";
import { normalizeApiError } from "@/utils/apiError";
import { parseConnectionDetails } from "@/utils/connectionDetails";
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
  const [pastedDetails, setPastedDetails] = useState("");

  const [accessSource, setAccessSource] = useState<DataSource | null>(null);
  const [grants, setGrants] = useState<DataSourceGrant[]>([]);
  const [farmers, setFarmers] = useState<User[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);

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

  const grantedIds = useMemo(
    () => new Set(grants.map((grant) => grant.user.id)),
    [grants],
  );

  const clearAddForm = () => {
    setName("");
    setBaseUrl("");
    setXApiKey("");
    setPastedDetails("");
  };

  const closeAdd = () => {
    setAddOpen(false);
    clearAddForm();
  };

  const parsePaste = () => {
    setError("");
    try {
      const parsed = parseConnectionDetails(pastedDetails);
      setBaseUrl(parsed.baseUrl);
      setXApiKey(parsed.xApiKey);
      setNotice("Connection details filled. Review them before adding the source.");
      setPastedDetails("");
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    }
  };

  const addSource = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyId("create");
    setError("");
    try {
      const created = await dataSourceService.create({
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        xApiKey: xApiKey.trim(),
        plotId: hierarchy.selectedPlotId,
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
      const [grantPage, userPage] = await Promise.all([
        dataSourceService.listGrants(source.id),
        userService.getUsers({ limit: 100 }),
      ]);
      setGrants(grantPage.items);
      setFarmers(userPage.items.filter((user) => user.role === "FARMER" && user.status === "ACTIVE"));
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setAccessLoading(false);
    }
  };

  const toggleGrant = async (userId: string, assigned: boolean) => {
    if (!accessSource) return;
    setBusyId(userId);
    setError("");
    try {
      if (assigned) await dataSourceService.grant(accessSource.id, userId);
      else await dataSourceService.revoke(accessSource.id, userId);
      setGrants((await dataSourceService.listGrants(accessSource.id)).items);
      await loadSources();
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
                <th>Connection Status</th><th>Last Updated</th><th>Actions</th>
              </tr></thead>
              <tbody>{sources.map((source) => (
                <tr key={source.id}>
                  <td><strong>{source.name}</strong><span className={styles.subtle}>{source.baseUrl}</span></td>
                  <td>{source.owner.displayName}<span className={styles.subtle}>{source.owner.role === "ADMIN" ? "Admin" : "Farmer"}</span></td>
                  <td>{source.stationCount}</td>
                  <td>{source.visibleAccountCount}</td>
                  <td><span className={`${styles.status} ${source.connectionStatus === "CONNECTED" ? styles.connected : styles.failed}`}>
                    {source.connectionStatus === "CONNECTED" ? "Connected" : "Connection failed"}
                  </span></td>
                  <td>{formatVietnamDateTime(source.updatedAt)}</td>
                  <td><div className={styles.actions}>
                    <Button size="sm" variant="ghost" onClick={() => navigate("/admin/devices")}>View Data</Button>
                    {source.canManageAccess && <Button size="sm" variant="ghost" icon={<Share2 size={14} />} onClick={() => void openAccess(source)}>Manage Access</Button>}
                    {source.canManageAccess && <Button size="sm" variant="ghost" icon={<TestTube2 size={14} />} loading={busyId === source.id} onClick={() => void testConnection(source)}>Test</Button>}
                    {source.canRevealKey && <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setRevealSource(source)}>Reveal Key</Button>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      <Modal isOpen={addOpen} onClose={closeAdd} title="Add API Source" description="Use one source for the station API assigned to a plot." size="lg">
        <form className={styles.form} onSubmit={addSource}>
          <div className={styles.pasteBox}>
            <label>Paste connection details
              <textarea value={pastedDetails} onChange={(event) => setPastedDetails(event.target.value)} placeholder={'Paste chat text, curl or JSON containing one API URL and one X-API-Key'} />
            </label>
            <Button variant="outline" disabled={!pastedDetails.trim()} onClick={parsePaste}>Fill Fields</Button>
          </div>
          <label>Source name<input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. North field stations" /></label>
          <div className={styles.twoColumns}>
            <label>Farm<select value={hierarchy.selectedFarmId} onChange={(event) => hierarchy.setSelectedFarmId(event.target.value)}>
              {hierarchy.farms.length === 0 && <option value="">No farms available</option>}
              {hierarchy.farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}
            </select></label>
            <label>Plot<select required value={hierarchy.selectedPlotId} onChange={(event) => hierarchy.setSelectedPlotId(event.target.value)} disabled={!hierarchy.selectedFarmId}>
              {hierarchy.plots.length === 0 && <option value="">No plots available</option>}
              {hierarchy.plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}
            </select></label>
          </div>
          <label>API URL<input required type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://provider.example/api/v1" /></label>
          <label>X-API-Key<input required type="password" autoComplete="off" value={xApiKey} onChange={(event) => setXApiKey(event.target.value)} placeholder="Enter the source key" /></label>
          <p className={styles.help}>The key is sent once to the backend and is never stored in this browser.</p>
          <div className={styles.modalActions}><Button variant="outline" onClick={closeAdd}>Cancel</Button><Button type="submit" loading={busyId === "create"} disabled={!hierarchy.selectedPlotId}>Connect Source</Button></div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(accessSource)} onClose={() => setAccessSource(null)} title={`Manage Access${accessSource ? ` — ${accessSource.name}` : ""}`} description="Shared accounts can view station data but cannot reveal or revoke the source key." size="md">
        {accessLoading ? <Loading label="Loading accounts..." /> : (
          <div className={styles.accountList}>
            {farmers.length === 0 && <p>No active Farmer accounts found.</p>}
            {farmers.map((farmer) => {
              const assigned = grantedIds.has(farmer.id);
              return <div key={farmer.id} className={styles.accountRow}>
                <div><strong>{farmer.displayName}</strong><span>{farmer.email}</span></div>
                <Button size="sm" variant={assigned ? "danger" : "outline"} loading={busyId === farmer.id} onClick={() => void toggleGrant(farmer.id, !assigned)}>{assigned ? "Revoke" : "Share"}</Button>
              </div>;
            })}
          </div>
        )}
      </Modal>

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
