import {
  Check,
  ChevronDown,
  Database,
  KeyRound,
  Shield,
} from "lucide-react";
import { useState } from "react";
import styles from "./ApiPermissions.module.css";

interface Permission {
  id: string;
  label: string;
  description: string;
}

const permissions: Permission[] = [
  {
    id: "latest",
    label: "Read Latest Data",
    description: "Read current soil telemetry values.",
  },
  {
    id: "history",
    label: "Read Historical Data",
    description: "Read historical telemetry and supported aggregates.",
  },
  {
    id: "metadata",
    label: "Read Station Metadata",
    description: "Read station, sensor, and device metadata.",
  },
  {
    id: "health",
    label: "Read Health Status",
    description: "Read station and device health information.",
  },
];

const farms = [
  {
    id: "farm-001",
    name: "Green Valley Farm",
    plots: [
      {
        id: "plot-001",
        name: "North Field",
        stations: ["Station 001", "Station 002"],
      },
      {
        id: "plot-002",
        name: "South Field",
        stations: ["Station 003"],
      },
    ],
  },
  {
    id: "farm-002",
    name: "Sunrise Farm",
    plots: [
      {
        id: "plot-003",
        name: "East Plot",
        stations: ["Station 004"],
      },
    ],
  },
];

export default function ApiPermissions() {
  const [selectedKey, setSelectedKey] = useState("Production Integration");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "latest",
    "history",
  ]);
  const [selectedStations, setSelectedStations] = useState<string[]>([
    "Station 001",
    "Station 002",
  ]);
  const [expandedFarms, setExpandedFarms] = useState<string[]>([
    "farm-001",
  ]);

  const togglePermission = (id: string) => {
    setSelectedPermissions((current) =>
      current.includes(id)
        ? current.filter((permission) => permission !== id)
        : [...current, id],
    );
  };

  const toggleStation = (station: string) => {
    setSelectedStations((current) =>
      current.includes(station)
        ? current.filter((item) => item !== station)
        : [...current, station],
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>DEVELOPER PORTAL / AUTHORIZATION</div>
          <h1>API Permissions</h1>
          <p>
            Control which resources and API capabilities each key can access.
          </p>
        </div>
      </div>

      <section className={styles.keySelector}>
        <div className={styles.selectorIcon}>
          <KeyRound size={18} />
        </div>

        <div>
          <span>API Key</span>
          <strong>{selectedKey}</strong>
        </div>

        <select
          value={selectedKey}
          onChange={(event) => setSelectedKey(event.target.value)}
        >
          <option>Production Integration</option>
          <option>Analytics Service</option>
          <option>Mobile Application</option>
        </select>
      </section>

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>API Permissions</h2>
              <p>Capabilities available to this API key.</p>
            </div>

            <Shield size={19} />
          </div>

          <div className={styles.permissionList}>
            {permissions.map((permission) => {
              const selected = selectedPermissions.includes(permission.id);

              return (
                <button
                  key={permission.id}
                  className={`${styles.permissionItem} ${
                    selected ? styles.permissionSelected : ""
                  }`}
                  onClick={() => togglePermission(permission.id)}
                >
                  <span className={styles.checkbox}>
                    {selected && <Check size={14} />}
                  </span>

                  <span className={styles.permissionContent}>
                    <strong>{permission.label}</strong>
                    <span>{permission.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Allowed Resources</h2>
              <p>Station access follows Farm → Plot → Station.</p>
            </div>

            <Database size={19} />
          </div>

          <div className={styles.resourceTree}>
            {farms.map((farm) => {
              const expanded = expandedFarms.includes(farm.id);

              return (
                <div className={styles.farm} key={farm.id}>
                  <button
                    className={styles.treeButton}
                    onClick={() =>
                      setExpandedFarms((current) =>
                        current.includes(farm.id)
                          ? current.filter((id) => id !== farm.id)
                          : [...current, farm.id],
                      )
                    }
                  >
                    <ChevronDown
                      size={16}
                      className={expanded ? styles.rotated : ""}
                    />
                    <strong>{farm.name}</strong>
                  </button>

                  {expanded && (
                    <div className={styles.plotList}>
                      {farm.plots.map((plot) => (
                        <div key={plot.id} className={styles.plot}>
                          <div className={styles.plotTitle}>{plot.name}</div>

                          <div className={styles.stationList}>
                            {plot.stations.map((station) => {
                              const selected =
                                selectedStations.includes(station);

                              return (
                                <label
                                  className={styles.station}
                                  key={station}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => toggleStation(station)}
                                  />
                                  <span>{station}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className={styles.summary}>
        <div>
          <span>Selected API Key</span>
          <strong>{selectedKey}</strong>
        </div>

        <div>
          <span>Permissions</span>
          <strong>{selectedPermissions.length}</strong>
        </div>

        <div>
          <span>Allowed Stations</span>
          <strong>{selectedStations.length}</strong>
        </div>

        <button className={styles.saveButton}>Save Permissions</button>
      </section>
    </div>
  );
}