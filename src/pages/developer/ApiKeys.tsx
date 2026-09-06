import { Copy, KeyRound, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { apiKeyService, type DeveloperApiKey } from "@/services/apiKeyService";
import { normalizeApiError } from "@/utils/apiError";
import styles from "./ApiKeys.module.css";

const formatDate = (value: string | null) => value ? new Date(value).toLocaleString() : "Never";

export default function ApiKeys() {
  const [keys, setKeys] = useState<DeveloperApiKey[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiKeyService.list().then(
      (items) => { if (active) setKeys(items); },
      (reason) => { if (active) setError(normalizeApiError(reason).message); },
    ).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setError("");
    try {
      const issued = await apiKeyService.create(newKeyName.trim());
      setKeys((current) => [issued.apiKey, ...current]);
      setGeneratedSecret(issued.key);
    } catch (reason) { setError(normalizeApiError(reason).message); }
  };

  const rotateKey = async (id: string) => {
    if (!window.confirm("Rotate this key? The old secret will stop working.")) return;
    try {
      const issued = await apiKeyService.rotate(id);
      setKeys((current) => current.map((item) => item.id === id ? issued.apiKey : item));
      setGeneratedSecret(issued.key);
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

  const activeCount = keys.filter((key) => !key.revokedAt && new Date(key.expiresAt) > new Date()).length;

  return <div className={styles.page}>
    <div className={styles.header}><div><div className={styles.eyebrow}>DEVELOPER PORTAL / SECURITY</div><h1>API Keys</h1><p>Manage credentials used by server-side integrations.</p></div>
      <button className={styles.primaryButton} onClick={() => { setShowCreate(true); setGeneratedSecret(null); setNewKeyName(""); }}><Plus size={17} />Create API Key</button>
    </div>
    <div className={styles.warning}><ShieldAlert size={19} /><div><strong>Keep API secrets secure.</strong><span>Never embed them in browser code or commit them to source control.</span></div></div>
    {error && <div className={styles.warning} role="alert">{error}</div>}
    <section className={styles.stats}><div><KeyRound size={19} /><span>Active Keys</span><strong>{activeCount}</strong></div><div><RefreshCw size={19} /><span>Total Keys</span><strong>{keys.length}</strong></div><div><ShieldAlert size={19} /><span>Revoked</span><strong>{keys.filter((key) => key.revokedAt).length}</strong></div></section>
    <section className={styles.card}><div className={styles.cardHeader}><h2>API Key Management</h2><p>Secrets are shown only after creation or rotation.</p></div>
      <div className={styles.tableWrapper}><table className={styles.table}><thead><tr><th>Name</th><th>Prefix</th><th>Created</th><th>Last used</th><th>Expires</th><th>Rate limit</th><th>Status</th><th>Stations</th><th /></tr></thead>
      <tbody aria-busy={loading}>{!loading && keys.length === 0 && <tr><td colSpan={9}>No API keys yet.</td></tr>}{keys.map((key) => { const revoked = Boolean(key.revokedAt); return <tr key={key.id}><td><div className={styles.keyName}><span className={styles.keyIcon}><KeyRound size={16} /></span><strong>{key.name}</strong></div></td><td className={styles.mono}>{key.prefix}</td><td>{formatDate(key.createdAt)}</td><td>{formatDate(key.lastUsedAt)}</td><td>{formatDate(key.expiresAt)}</td><td>{key.requestsPerMinute}/min</td><td><span className={`${styles.status} ${revoked ? styles.revoked : styles.active}`}>{revoked ? "Revoked" : "Active"}</span></td><td>{key.stationIds.length || "All allowed"}</td><td><div className={styles.actions}><button title="Rotate key" aria-label={`Rotate ${key.name}`} disabled={revoked} onClick={() => void rotateKey(key.id)}><RefreshCw size={16} /></button><button title="Revoke key" aria-label={`Revoke ${key.name}`} disabled={revoked} onClick={() => void revokeKey(key.id)}><Trash2 size={16} /></button></div></td></tr>; })}</tbody></table></div>
    </section>
    {showCreate && <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}><div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="api-key-dialog-title">
      <div className={styles.modalHeader}><div><h2 id="api-key-dialog-title">{generatedSecret ? "API key ready" : "Create API key"}</h2><p>{generatedSecret ? "Copy it now; it will not be shown again." : "Name this server-side integration."}</p></div><button aria-label="Close" onClick={() => setShowCreate(false)}>×</button></div>
      {generatedSecret ? <><div className={styles.secretWarning}><ShieldAlert size={20} /><strong>Store this secret securely.</strong></div><div className={styles.secretBox}><code>{generatedSecret}</code><button onClick={() => void navigator.clipboard.writeText(generatedSecret)}><Copy size={16} />Copy</button></div><button className={styles.primaryButton} onClick={() => setShowCreate(false)}>Done</button></> : <><label>API Key Name<input autoFocus value={newKeyName} maxLength={100} onChange={(event) => setNewKeyName(event.target.value)} placeholder="e.g. Greenhouse analytics" /></label><div className={styles.modalActions}><button className={styles.secondaryButton} onClick={() => setShowCreate(false)}>Cancel</button><button className={styles.primaryButton} disabled={!newKeyName.trim()} onClick={() => void createKey()}>Generate Key</button></div></>}
    </div></div>}
  </div>;
}
