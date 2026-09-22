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

const sensorProfiles: SensorProfile[] = [];
const alertRules: AlertRule[] = [];
const escalationPolicies: EscalationPolicy[] = [];
const configurationVersions: ConfigurationVersion[] = [];

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
