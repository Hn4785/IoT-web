import { Check, Copy, KeyRound, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { apiKeyService, type AvailableApiKeyStation, type DeveloperApiKey } from "@/services/apiKeyService";
import { normalizeApiError } from "@/utils/apiError";
import { copyText } from "@/utils/credentialInput";
import { getApiKeyStatus } from "@/utils/developerOverview";
import styles from "./ApiKeys.module.css";

const formatDate = (value: string | null) => value ? new Date(value).toLocaleString() : "Never";

export default function ApiKeys() {
  const [keys, setKeys] = useState<DeveloperApiKey[]>([]);
  const [availableStations, setAvailableStations] = useState<AvailableApiKeyStation[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
  const [credentialCopied, setCredentialCopied] = useState(false);
  const [credentialCopyFailed, setCredentialCopyFailed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [items, stations] = await Promise.all([apiKeyService.list(), apiKeyService.listAvailableStations()]);
      setKeys(items);
      setAvailableStations(stations);
    } catch (reason) { setError(normalizeApiError(reason).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(task);
  }, [loadData]);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setError("");
    try {
      const issued = await apiKeyService.create(newKeyName.trim(), selectedStationIds);
      setKeys((current) => [issued.apiKey, ...current]);
      setGeneratedSecret(issued.key);
      setCredentialCopied(false);
      setCredentialCopyFailed(false);
    } catch (reason) { setError(normalizeApiError(reason).message); }
  };

  const rotateKey = async (id: string) => {
    if (!window.confirm("Rotate this key? The old secret will stop working.")) return;
    try {
      const issued = await apiKeyService.rotate(id);
      setKeys((current) => current.map((item) => item.id === id ? issued.apiKey : item));
      setGeneratedSecret(issued.key);
      setCredentialCopied(false);
      setCredentialCopyFailed(false);
      setShowCreate(true);
    } catch (reason) { setError(normalizeApiError(reason).message); }
  };

  const revokeKey = async (id: string) => {
    if (!window.confirm("Revoke this key permanently?")) return;
    try {
      await apiKeyService.revoke(id);
      setKeys((current) => current.map((item) => item.id === id ? { ...item, revokedAt: new Date().toISOString() } : item));
    } catch (reason) { setError(normalizeApiError(reason).message); }
  };

  const activeCount = keys.filter((key) => getApiKeyStatus(key) === "active").length;
  const expiredCount = keys.filter((key) => getApiKeyStatus(key) === "expired").length;
  const revokedCount = keys.filter((key) => getApiKeyStatus(key) === "revoked").length;

  return <div className={styles.page}>
    <div className={styles.header}><div><div className={styles.eyebrow}>DEVELOPER PORTAL / SECURITY</div><h1>API Keys</h1><p>Manage credentials used by server-side integrations.</p></div>
      <button className={styles.primaryButton} onClick={() => { setShowCreate(true); setGeneratedSecret(null); setNewKeyName(""); setSelectedStationIds(availableStations.map(({ id }) => id)); setCredentialCopied(false); setCredentialCopyFailed(false); }}><Plus size={17} />Create API Key</button>
    </div>
    <div className={styles.warning}><ShieldAlert size={19} /><div><strong>Keep API secrets secure.</strong><span>Never embed them in browser code or commit them to source control.</span></div></div>
    {error && <div className={styles.warning} role="alert"><span>{error}</span><button className={styles.secondaryButton} onClick={() => void loadData()}><RefreshCw size={15} />Retry</button></div>}
    <section className={styles.stats}><div><KeyRound size={19} /><span>Active Keys</span><strong>{activeCount}</strong></div><div><RefreshCw size={19} /><span>Expired</span><strong>{expiredCount}</strong></div><div><ShieldAlert size={19} /><span>Revoked</span><strong>{revokedCount}</strong></div></section>
    <section className={styles.card}><div className={styles.cardHeader}><h2>API Key Management</h2><p>Secrets are shown only after creation or rotation.</p></div>
      <div className={styles.tableWrapper}><table className={styles.table}><thead><tr><th>Name</th><th>Prefix</th><th>Created</th><th>Last used</th><th>Expires</th><th>Rate limit</th><th>Status</th><th>Stations</th><th /></tr></thead>
      <tbody aria-busy={loading}>{!loading && keys.length === 0 && <tr><td colSpan={9}>No API keys yet.</td></tr>}{keys.map((key) => { const status = getApiKeyStatus(key); const revoked = status === "revoked"; return <tr key={key.id}><td><div className={styles.keyName}><span className={styles.keyIcon}><KeyRound size={16} /></span><strong>{key.name}</strong></div></td><td className={styles.mono}>{key.prefix}</td><td>{formatDate(key.createdAt)}</td><td>{formatDate(key.lastUsedAt)}</td><td>{formatDate(key.expiresAt)}</td><td>{key.requestsPerMinute}/min</td><td><span className={`${styles.status} ${status === "active" ? styles.active : styles.revoked}`}>{status[0].toUpperCase() + status.slice(1)}</span></td><td>{key.stationIds.length || "No access"}</td><td><div className={styles.actions}><button title="Rotate key" aria-label={`Rotate ${key.name}`} disabled={revoked} onClick={() => void rotateKey(key.id)}><RefreshCw size={16} /></button><button title="Revoke key" aria-label={`Revoke ${key.name}`} disabled={revoked} onClick={() => void revokeKey(key.id)}><Trash2 size={16} /></button></div></td></tr>; })}</tbody></table></div>
    </section>
    {showCreate && <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}><div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="api-key-dialog-title">
      <div className={styles.modalHeader}><div><h2 id="api-key-dialog-title">{generatedSecret ? "API key ready" : "Create API key"}</h2><p>{generatedSecret ? "Copy it now; it will not be shown again." : "Name this server-side integration."}</p></div><button aria-label="Close" onClick={() => setShowCreate(false)}>×</button></div>
      {generatedSecret ? <><div className={styles.secretWarning}><ShieldAlert size={20} /><strong>Store this secret securely.</strong></div><div className={styles.secretBox}><code tabIndex={0}>{generatedSecret}</code><button onClick={async () => { const copied = await copyText(generatedSecret); setCredentialCopied(copied); setCredentialCopyFailed(!copied); }}>{credentialCopied ? <Check size={16} /> : <Copy size={16} />}{credentialCopied ? "Copied" : "Copy"}</button></div>{credentialCopyFailed && <p className={styles.copyError} role="alert">Could not copy automatically. Select and copy the key manually.</p>}<button className={styles.primaryButton} onClick={() => setShowCreate(false)}>Done</button></> : <><label>API Key Name<input autoFocus value={newKeyName} maxLength={100} onChange={(event) => setNewKeyName(event.target.value)} placeholder="e.g. Greenhouse analytics" /></label><fieldset className={styles.stationSelector}><legend>Allowed stations</legend>{availableStations.length === 0 ? <p>No stations have been granted to this account. Ask an Admin to assign one first.</p> : availableStations.map((station) => <label key={station.id}><input type="checkbox" checked={selectedStationIds.includes(station.id)} onChange={(event) => setSelectedStationIds((current) => event.target.checked ? [...current, station.id] : current.filter((id) => id !== station.id))} /><span>{station.name} ({station.code})<code title={station.id}>{station.id}</code></span></label>)}</fieldset><div className={styles.modalActions}><button className={styles.secondaryButton} onClick={() => setShowCreate(false)}>Cancel</button><button className={styles.primaryButton} disabled={!newKeyName.trim() || selectedStationIds.length === 0} onClick={() => void createKey()}>Generate Key</button></div></>}
    </div></div>}
  </div>;
}
