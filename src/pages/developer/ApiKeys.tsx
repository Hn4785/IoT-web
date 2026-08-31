import {
  Copy,
  Eye,
  KeyRound,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import styles from "./ApiKeys.module.css";

interface ApiKeyRow {
  id: string;
  name: string;
  keyId: string;
  created: string;
  lastUsed: string;
  expiration: string;
  status: "Active" | "Expired" | "Revoked";
  permissions: string[];
}

const initialKeys: ApiKeyRow[] = [
  {
    id: "1",
    name: "Production Integration",
    keyId: "key_7f3a92",
    created: "Aug 12, 2026",
    lastUsed: "2 min ago",
    expiration: "Aug 12, 2027",
    status: "Active",
    permissions: ["Latest Data", "Historical Data"],
  },
  {
    id: "2",
    name: "Analytics Service",
    keyId: "key_31bc81",
    created: "Jul 28, 2026",
    lastUsed: "18 min ago",
    expiration: "Jul 28, 2027",
    status: "Active",
    permissions: ["Historical Data", "Station Metadata"],
  },
  {
    id: "3",
    name: "Mobile Application",
    keyId: "key_a82c44",
    created: "Jun 19, 2026",
    lastUsed: "1 day ago",
    expiration: "Jun 19, 2027",
    status: "Active",
    permissions: ["Latest Data", "Health Status"],
  },
  {
    id: "4",
    name: "Legacy Integration",
    keyId: "key_91de22",
    created: "Jan 10, 2026",
    lastUsed: "May 02, 2026",
    expiration: "Jul 10, 2026",
    status: "Expired",
    permissions: ["Latest Data"],
  },
];

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newKeyName.trim()) {
      return;
    }

    const newKey: ApiKeyRow = {
      id: String(Date.now()),
      name: newKeyName.trim(),
      keyId: `key_${Math.random().toString(16).slice(2, 8)}`,
      created: "Today",
      lastUsed: "Never",
      expiration: "Aug 31, 2027",
      status: "Active",
      permissions: ["Latest Data"],
    };

    setKeys((current) => [newKey, ...current]);

    setGeneratedSecret(
      `sk_live_${Math.random().toString(36).slice(2)}${Math.random()
        .toString(36)
        .slice(2)}`,
    );
  };

  const handleRevoke = (id: string) => {
    setKeys((current) =>
      current.map((key) =>
        key.id === id ? { ...key, status: "Revoked" } : key,
      ),
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>DEVELOPER PORTAL / SECURITY</div>
          <h1>API Keys</h1>
          <p>Manage credentials used to access the Client API.</p>
        </div>

        <button
          className={styles.primaryButton}
          onClick={() => {
            setShowCreate(true);
            setGeneratedSecret(null);
            setNewKeyName("");
          }}
        >
          <Plus size={17} />
          Create API Key
        </button>
      </div>

      <div className={styles.warning}>
        <ShieldAlert size={19} />
        <div>
          <strong>Keep your API secrets secure.</strong>
          <span>
            API secrets must never be embedded in public frontend applications
            or committed to source control.
          </span>
        </div>
      </div>

      <section className={styles.stats}>
        <div>
          <KeyRound size={19} />
          <span>Active Keys</span>
          <strong>{keys.filter((key) => key.status === "Active").length}</strong>
        </div>

        <div>
          <RefreshCw size={19} />
          <span>Recently Used</span>
          <strong>3</strong>
        </div>

        <div>
          <ShieldAlert size={19} />
          <span>Expiring Soon</span>
          <strong>1</strong>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2>API Key Management</h2>
            <p>Credentials currently registered for your integrations.</p>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>API Key Name</th>
                <th>Key ID</th>
                <th>Created</th>
                <th>Last Used</th>
                <th>Expiration</th>
                <th>Status</th>
                <th>Permissions</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>
                    <div className={styles.keyName}>
                      <span className={styles.keyIcon}>
                        <KeyRound size={16} />
                      </span>
                      <strong>{key.name}</strong>
                    </div>
                  </td>

                  <td className={styles.mono}>{key.keyId}</td>
                  <td>{key.created}</td>
                  <td>{key.lastUsed}</td>
                  <td>{key.expiration}</td>

                  <td>
                    <span
                      className={`${styles.status} ${
                        key.status === "Active"
                          ? styles.active
                          : key.status === "Expired"
                            ? styles.expired
                            : styles.revoked
                      }`}
                    >
                      {key.status}
                    </span>
                  </td>

                  <td>
                    <div className={styles.permissions}>
                      {key.permissions.map((permission) => (
                        <span key={permission}>{permission}</span>
                      ))}
                    </div>
                  </td>

                  <td>
                    <div className={styles.actions}>
                      <button title="View permissions">
                        <Eye size={16} />
                      </button>

                      <button title="Rotate key">
                        <RefreshCw size={16} />
                      </button>

                      <button title="Copy Key ID">
                        <Copy size={16} />
                      </button>

                      <button
                        title="Revoke key"
                        disabled={key.status !== "Active"}
                        onClick={() => handleRevoke(key.id)}
                      >
                        <Trash2 size={16} />
                      </button>

                      <button title="More actions">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate && (
        <div
          className={styles.overlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCreate(false);
            }
          }}
        >
          <div className={styles.modal}>
            {!generatedSecret ? (
              <>
                <div className={styles.modalHeader}>
                  <div>
                    <h2>Create API Key</h2>
                    <p>Generate a credential for an external integration.</p>
                  </div>

                  <button onClick={() => setShowCreate(false)}>×</button>
                </div>

                <label>
                  API Key Name
                  <input
                    value={newKeyName}
                    onChange={(event) => setNewKeyName(event.target.value)}
                    placeholder="e.g. Production Integration"
                  />
                </label>

                <div className={styles.modalInfo}>
                  <ShieldAlert size={17} />
                  <span>
                    The generated secret will only be displayed once.
                  </span>
                </div>

                <div className={styles.modalActions}>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </button>

                  <button
                    className={styles.primaryButton}
                    onClick={handleCreate}
                  >
                    Generate Key
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.modalHeader}>
                  <div>
                    <h2>API Key Created</h2>
                    <p>Copy the secret now. It will not be shown again.</p>
                  </div>
                </div>

                <div className={styles.secretWarning}>
                  <ShieldAlert size={20} />
                  <strong>Store this secret securely.</strong>
                </div>

                <div className={styles.secretBox}>
                  <code>{generatedSecret}</code>
                  <button
                    onClick={() =>
                      void navigator.clipboard?.writeText(generatedSecret)
                    }
                  >
                    <Copy size={16} />
                    Copy
                  </button>
                </div>

                <button
                  className={styles.primaryButton}
                  onClick={() => setShowCreate(false)}
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}