import { useState } from "react";
import {
  GitCompare,
  Plus,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/common/Button";
import StatusBadge from "@/components/common/StatusBadge";
import Modal from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/Modal";

import type {
  SensorProfile,
  AlertRule,
  EscalationPolicy,
  ConfigurationVersion,
  NotificationChannel,
} from "@/types/configuration";

import styles from "./IoTConfiguration.module.css";

const sensorProfiles: SensorProfile[] = [
  {
    id: "SP-001",
    name: "Soil NPK Standard",
    sensorModel: "NPK-100",
    measurementInterval: 5,
    sendInterval: 5,
    staleAfter: 15,
    offlineTimeout: 30,
    measurementUnits: {
      n: "mg/kg",
      p: "mg/kg",
      k: "mg/kg",
    },
    status: "published",
    version: 4,
    updatedAt: "2026-08-29T09:00:00Z",
    updatedBy: "Alex Morgan",
  },
  {
    id: "SP-002",
    name: "Soil Moisture Pro",
    sensorModel: "SM-200",
    measurementInterval: 10,
    sendInterval: 10,
    staleAfter: 30,
    offlineTimeout: 60,
    measurementUnits: {
      moisture: "%",
    },
    status: "published",
    version: 2,
    updatedAt: "2026-08-28T09:00:00Z",
    updatedBy: "Daniel Nguyen",
  },
  {
    id: "SP-003",
    name: "Soil Temperature",
    sensorModel: "ST-200",
    measurementInterval: 15,
    sendInterval: 15,
    staleAfter: 45,
    offlineTimeout: 60,
    measurementUnits: {
      temperature: "°C",
    },
    status: "draft",
    version: 1,
    updatedAt: "2026-08-27T09:00:00Z",
    updatedBy: "Emily Tran",
  },
];

const alertRules: AlertRule[] = [
  {
    id: "RULE-001",
    name: "Low soil moisture",
    metric: "soil_moisture",
    operator: "<",
    threshold: 25,
    duration: 600,
    hysteresis: 5,
    cooldown: 900,
    severity: "warning",
    enabled: true,
    createdAt: "2026-08-01T09:00:00Z",
    updatedAt: "2026-08-29T09:00:00Z",
  },
  {
    id: "RULE-002",
    name: "Critical soil moisture",
    metric: "soil_moisture",
    operator: "<",
    threshold: 15,
    duration: 300,
    hysteresis: 3,
    cooldown: 900,
    severity: "critical",
    enabled: true,
    createdAt: "2026-08-01T09:00:00Z",
    updatedAt: "2026-08-29T09:00:00Z",
  },
  {
    id: "RULE-003",
    name: "High soil temperature",
    metric: "soil_temperature",
    operator: ">",
    threshold: 38,
    duration: 300,
    hysteresis: 2,
    cooldown: 900,
    severity: "warning",
    enabled: false,
    createdAt: "2026-08-01T09:00:00Z",
    updatedAt: "2026-08-29T09:00:00Z",
  },
];

const escalationPolicies: EscalationPolicy[] = [
  {
    id: "ESC-001",
    name: "Standard Agriculture Escalation",
    acknowledgeTimeout: 600,
    escalationDelay: 1200,
    levels: ["T1", "T2", "T3"],
    channels: ["web", "push", "email"],
    enabled: true,
  },
];

const configurationVersions: ConfigurationVersion[] = [
  {
    id: "CFG-008",
    version: 8,
    status: "published",
    createdBy: "Alex Morgan",
    createdAt: "2026-08-29T15:40:00Z",
    effectiveAt: "2026-08-29T16:00:00Z",
    changes: [
      "Soil moisture warning threshold 30% → 25%",
      "Added hysteresis 5%",
    ],
    isCurrent: true,
  },
  {
    id: "CFG-007",
    version: 7,
    status: "applied",
    createdBy: "Daniel Nguyen",
    createdAt: "2026-08-27T11:20:00Z",
    changes: [
      "Send interval 10s → 5s",
    ],
    isCurrent: false,
  },
  {
    id: "CFG-006",
    version: 6,
    status: "rolled_back",
    createdBy: "Emily Tran",
    createdAt: "2026-08-24T09:15:00Z",
    changes: [
      "Added EC alert rule",
    ],
    isCurrent: false,
  },
];

const channelLabels: Record<
  NotificationChannel,
  string
> = {
  web: "Web",
  push: "Push",
  email: "Email",
  sms: "SMS",
};

type ConfigurationTab =
  | "profiles"
  | "rules"
  | "escalation"
  | "versions";

export default function IoTConfiguration() {
  const [activeTab, setActiveTab] =
    useState<ConfigurationTab>("profiles");

  const [diffOpen, setDiffOpen] =
    useState(false);

  const [rollbackVersion, setRollbackVersion] =
    useState<ConfigurationVersion | null>(
      null,
    );

  return (
    <div className={styles.page}>
      <PageHeader
        title="IoT Configuration"
        description="Manage sensor profiles, alert rules, escalation policies, and configuration versions."
        actions={
          <Button
            icon={<Plus size={16} />}
          >
            Create Configuration
          </Button>
        }
      />

      <section className={styles.notice}>
        <ShieldCheck size={19} />

        <div>
          <strong>
            Configuration governance enabled
          </strong>

          <span>
            Changes are versioned and can be
            reviewed or rolled back.
          </span>
        </div>
      </section>

      <nav className={styles.tabs}>
        <button
          className={
            activeTab === "profiles"
              ? styles.activeTab
              : ""
          }
          onClick={() =>
            setActiveTab("profiles")
          }
        >
          Sensor Profiles
        </button>

        <button
          className={
            activeTab === "rules"
              ? styles.activeTab
              : ""
          }
          onClick={() =>
            setActiveTab("rules")
          }
        >
          Alert Rules
        </button>

        <button
          className={
            activeTab === "escalation"
              ? styles.activeTab
              : ""
          }
          onClick={() =>
            setActiveTab("escalation")
          }
        >
          Escalation Policies
        </button>

        <button
          className={
            activeTab === "versions"
              ? styles.activeTab
              : ""
          }
          onClick={() =>
            setActiveTab("versions")
          }
        >
          Configuration Versioning
        </button>
      </nav>

      {activeTab === "profiles" && (
        <section className={styles.panel}>
          <div
            className={
              styles.sectionHeader
            }
          >
            <div>
              <h2>Sensor Profiles</h2>

              <p>
                Measurement, transmission,
                stale and offline behavior.
              </p>
            </div>

            <Button
              variant="outline"
              icon={<Plus size={16} />}
            >
              Create Profile
            </Button>
          </div>

          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Profile Name</th>
                  <th>Sensor Model</th>
                  <th>Measurement</th>
                  <th>Send</th>
                  <th>Stale After</th>
                  <th>Offline Timeout</th>
                  <th>Status</th>
                  <th>Version</th>
                  <th>Updated</th>
                </tr>
              </thead>

              <tbody>
                {sensorProfiles.map(
                  (profile) => (
                    <tr key={profile.id}>
                      <td>
                        <strong>
                          {profile.name}
                        </strong>
                      </td>

                      <td
                        className={
                          styles.mono
                        }
                      >
                        {profile.sensorModel}
                      </td>

                      <td>
                        {
                          profile.measurementInterval
                        }
                        s
                      </td>

                      <td>
                        {profile.sendInterval}s
                      </td>

                      <td>
                        {profile.staleAfter}s
                      </td>

                      <td>
                        {
                          profile.offlineTimeout
                        }
                        s
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            profile.status ===
                            "published"
                              ? "active"
                              : "warning"
                          }
                          label={
                            profile.status
                          }
                        />
                      </td>

                      <td>
                        v{profile.version}
                      </td>

                      <td>
                        {profile.updatedAt}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "rules" && (
        <section className={styles.panel}>
          <div
            className={
              styles.sectionHeader
            }
          >
            <div>
              <h2>Alert Rules</h2>

              <p>
                Threshold, duration,
                hysteresis, cooldown and
                severity.
              </p>
            </div>

            <Button
              variant="outline"
              icon={<Plus size={16} />}
            >
              Create Rule
            </Button>
          </div>

          <div className={styles.ruleGrid}>
            {alertRules.map((rule) => (
              <article
                className={
                  styles.ruleCard
                }
                key={rule.id}
              >
                <div
                  className={
                    styles.ruleTop
                  }
                >
                  <div>
                    <StatusBadge
                      status={
                        rule.severity
                      }
                    />

                    <h3>
                      {rule.name}
                    </h3>
                  </div>

                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    readOnly
                  />
                </div>

                <div
                  className={
                    styles.condition
                  }
                >
                  <strong>
                    {rule.metric}
                  </strong>

                  <span>
                    {rule.operator}{" "}
                    {rule.threshold}
                  </span>

                  <span>
                    for{" "}
                    {Math.round(
                      rule.duration / 60,
                    )}{" "}
                    min
                  </span>
                </div>

                <div
                  className={
                    styles.meta
                  }
                >
                  <span>
                    Hysteresis:{" "}
                    {rule.hysteresis ?? 0}
                  </span>

                  <span>
                    Cooldown:{" "}
                    {Math.round(
                      rule.cooldown / 60,
                    )}{" "}
                    min
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "escalation" && (
        <section className={styles.panel}>
          <div
            className={
              styles.sectionHeader
            }
          >
            <div>
              <h2>
                Escalation Policies
              </h2>

              <p>
                Acknowledge timeout,
                escalation delay and
                notification channels.
              </p>
            </div>

            <Button
              variant="outline"
              icon={<Plus size={16} />}
            >
              Create Policy
            </Button>
          </div>

          <div
            className={
              styles.escalationGrid
            }
          >
            {escalationPolicies.map(
              (policy) => (
                <article
                  className={
                    styles.escalationCard
                  }
                  key={policy.id}
                >
                  <div
                    className={
                      styles.policyHeader
                    }
                  >
                    <strong>
                      {policy.name}
                    </strong>

                    <StatusBadge
                      status={
                        policy.enabled
                          ? "active"
                          : "disabled"
                      }
                      label={
                        policy.enabled
                          ? "Enabled"
                          : "Disabled"
                      }
                    />
                  </div>

                  <div>
                    Levels:{" "}
                    {policy.levels.join(
                      " → ",
                    )}
                  </div>

                  <div>
                    Acknowledge:{" "}
                    {policy.acknowledgeTimeout /
                      60}{" "}
                    min
                  </div>

                  <div>
                    Escalation delay:{" "}
                    {policy.escalationDelay /
                      60}{" "}
                    min
                  </div>

                  <div
                    className={
                      styles.channels
                    }
                  >
                    {policy.channels.map(
                      (channel) => (
                        <span key={channel}>
                          {
                            channelLabels[
                              channel
                            ]
                          }
                        </span>
                      ),
                    )}
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      )}

      {activeTab === "versions" && (
        <section className={styles.panel}>
          <div
            className={
              styles.sectionHeader
            }
          >
            <div>
              <h2>
                Configuration Versioning
              </h2>

              <p>
                Preview, compare, activate
                and rollback configuration
                versions.
              </p>
            </div>
          </div>

          <div
            className={
              styles.versionList
            }
          >
            {configurationVersions.map(
              (version) => (
                <article
                  className={
                    styles.versionRow
                  }
                  key={version.id}
                >
                  <strong>
                    v{version.version}
                  </strong>

                  <div>
                    <b>
                      {
                        version.changes[0]
                      }
                    </b>

                    <span>
                      {version.createdBy} ·{" "}
                      {version.createdAt}
                    </span>
                  </div>

                  <StatusBadge
                    status={
                      version.status ===
                        "published" ||
                      version.status ===
                        "applied"
                        ? "active"
                        : "disabled"
                    }
                    label={version.status.replace(
                      "_",
                      " ",
                    )}
                  />

                  <div
                    className={
                      styles.actions
                    }
                  >
                    <Button
                      iconOnly
                      variant="ghost"
                      aria-label="Compare configuration"
                      onClick={() =>
                        setDiffOpen(true)
                      }
                    >
                      <GitCompare
                        size={15}
                      />
                    </Button>

                    <Button
                      iconOnly
                      variant="ghost"
                      aria-label="Rollback configuration"
                      onClick={() =>
                        setRollbackVersion(
                          version,
                        )
                      }
                    >
                      <RotateCcw
                        size={15}
                      />
                    </Button>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      )}

      <Modal
        isOpen={diffOpen}
        onClose={() =>
          setDiffOpen(false)
        }
        title="Configuration Diff"
        size="lg"
        footer={
          <Button
            onClick={() =>
              setDiffOpen(false)
            }
          >
            Close
          </Button>
        }
      >
        <div className={styles.diff}>
          <div>
            <span>CURRENT</span>

            <code>
              soil_moisture.warning.threshold
              = 30
            </code>
          </div>

          <div className={styles.arrow}>
            →
          </div>

          <div>
            <span>PROPOSED</span>

            <code>
              soil_moisture.warning.threshold
              = 25
            </code>
          </div>
        </div>

        <div
          className={
            styles.validation
          }
        >
          <ShieldCheck size={17} />

          Validation passed. A new
          configuration version will be
          created when published.
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(
          rollbackVersion,
        )}
        onClose={() =>
          setRollbackVersion(null)
        }
        onConfirm={() =>
          setRollbackVersion(null)
        }
        title={`Rollback v${
          rollbackVersion?.version
        }?`}
        description="The selected configuration version will become the rollback target. This operation is audit logged."
        confirmText="Rollback"
        variant="warning"
      />
    </div>
  );
}