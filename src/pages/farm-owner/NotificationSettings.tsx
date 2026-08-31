import { useMemo, useState } from "react";
import {
  Bell,
  Check,
  Mail,
  MessageSquare,
  Smartphone,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

import { Button } from "@/components/common/Button";
import PageHeader from "@/components/layout/PageHeader";

import { farms } from "@/data/farms";
import { plots } from "@/data/plots";

import styles from "./NotificationSettings.module.css";

type Channel =
  | "email"
  | "push"
  | "sms";

type Severity =
  | "warning"
  | "critical";

interface NotificationRule {
  id: string;
  name: string;
  severity: Severity;
  metric: string;
  farmId: string;
  plotId: string;
  channels: Record<
    Channel,
    boolean
  >;
  enabled: boolean;
}

const initialRules: NotificationRule[] = [
  {
    id: "RULE-001",
    name: "Low soil moisture",
    severity: "warning",
    metric: "Soil Moisture",
    farmId: "FARM-001",
    plotId: "PLOT-001",
    channels: {
      email: true,
      push: true,
      sms: false,
    },
    enabled: true,
  },

  {
    id: "RULE-002",
    name: "Critical soil condition",
    severity: "critical",
    metric: "Soil Moisture",
    farmId: "FARM-001",
    plotId: "PLOT-002",
    channels: {
      email: true,
      push: true,
      sms: true,
    },
    enabled: true,
  },
];

const channelMeta: Record<
  Channel,
  {
    label: string;
    description: string;
    icon: typeof Mail;
  }
> = {
  email: {
    label: "Email",
    description:
      "Receive alert notifications by email.",
    icon: Mail,
  },

  push: {
    label: "App Push",
    description:
      "Receive real-time notifications in the app.",
    icon: Smartphone,
  },

  sms: {
    label: "SMS",
    description:
      "Receive urgent alerts by text message.",
    icon: MessageSquare,
  },
};

export default function NotificationSettings() {
  const [channels, setChannels] =
    useState<
      Record<Channel, boolean>
    >({
      email: true,
      push: true,
      sms: false,
    });

  const [rules, setRules] =
    useState(initialRules);

  const [saved, setSaved] =
    useState(false);

  const ownedFarms = useMemo(
    () =>
      farms.filter(
        (farm) =>
          farm.ownerId ===
            "USR-006" &&
          farm.status === "active",
      ),
    [],
  );

  const toggleChannel = (
    channel: Channel,
  ) => {
    setChannels(
      (current) => ({
        ...current,
        [channel]:
          !current[channel],
      }),
    );

    setSaved(false);
  };

  const toggleRuleChannel = (
    ruleId: string,
    channel: Channel,
  ) => {
    setRules(
      (current) =>
        current.map(
          (rule) =>
            rule.id === ruleId
              ? {
                  ...rule,
                  channels: {
                    ...rule.channels,
                    [channel]:
                      !rule.channels[
                        channel
                      ],
                  },
                }
              : rule,
        ),
    );

    setSaved(false);
  };

  const toggleRule = (
    ruleId: string,
  ) => {
    setRules(
      (current) =>
        current.map(
          (rule) =>
            rule.id === ruleId
              ? {
                  ...rule,
                  enabled:
                    !rule.enabled,
                }
              : rule,
        ),
    );

    setSaved(false);
  };

  const saveSettings = () => {
    setSaved(true);
  };

  return (
    <main className={styles.page}>
      <PageHeader
        title="Notification Settings"
        description="Choose how you receive agricultural and system alerts."
        actions={
          <Button
            variant="primary"
            size="md"
            icon={
              saved ? (
                <Check size={16} />
              ) : (
                <Bell size={16} />
              )
            }
            onClick={saveSettings}
          >
            {saved
              ? "Saved"
              : "Save Changes"}
          </Button>
        }
      />

      <section
        className={
          styles.channelCard
        }
      >
        <div
          className={
            styles.sectionHeader
          }
        >
          <div>
            <h2>
              Notification Channels
            </h2>

            <p>
              Enable the channels that
              are available for your
              account.
            </p>
          </div>
        </div>

        <div
          className={
            styles.channelGrid
          }
        >
          {(
            Object.keys(
              channelMeta,
            ) as Channel[]
          ).map((channel) => {
            const item =
              channelMeta[channel];

            const Icon =
              item.icon;

            const enabled =
              channels[channel];

            return (
              <article
                key={channel}
                className={`${styles.channel} ${
                  enabled
                    ? styles.channelEnabled
                    : ""
                }`}
              >
                <div
                  className={
                    styles.channelIcon
                  }
                >
                  <Icon size={20} />
                </div>

                <div
                  className={
                    styles.channelInfo
                  }
                >
                  <strong>
                    {item.label}
                  </strong>

                  <p>
                    {item.description}
                  </p>
                </div>

                <button
                  type="button"
                  className={
                    styles.toggleButton
                  }
                  onClick={() =>
                    toggleChannel(
                      channel,
                    )
                  }
                  aria-pressed={
                    enabled
                  }
                  aria-label={`${
                    enabled
                      ? "Disable"
                      : "Enable"
                  } ${item.label}`}
                >
                  {enabled ? (
                    <ToggleRight
                      size={32}
                    />
                  ) : (
                    <ToggleLeft
                      size={32}
                    />
                  )}

                  <span>
                    {enabled
                      ? "On"
                      : "Off"}
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section
        className={
          styles.rulesCard
        }
      >
        <div
          className={
            styles.sectionHeader
          }
        >
          <div>
            <h2>
              Notification Rules
            </h2>

            <p>
              Configure channels by
              severity, metric, farm,
              and plot.
            </p>
          </div>
        </div>

        <div
          className={
            styles.tableWrapper
          }
        >
          <table>
            <thead>
              <tr>
                <th>Rule</th>
                <th>Severity</th>
                <th>Metric</th>
                <th>Farm</th>
                <th>Plot</th>
                <th>Email</th>
                <th>Push</th>
                <th>SMS</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {rules.map((rule) => {
                const farm =
                  ownedFarms.find(
                    (item) =>
                      item.id ===
                      rule.farmId,
                  );

                const plot =
                  plots.find(
                    (item) =>
                      item.id ===
                      rule.plotId,
                  );

                return (
                  <tr key={rule.id}>
                    <td>
                      <strong>
                        {rule.name}
                      </strong>

                      <span>
                        {rule.id}
                      </span>
                    </td>

                    <td>
                      <span
                        className={
                          rule.severity ===
                          "critical"
                            ? styles.critical
                            : styles.warning
                        }
                      >
                        {rule.severity ===
                        "critical"
                          ? "Critical"
                          : "Warning"}
                      </span>
                    </td>

                    <td>
                      {rule.metric}
                    </td>

                    <td>
                      {farm?.name ?? "—"}
                    </td>

                    <td>
                      {plot?.name ?? "—"}
                    </td>

                    {(
                      Object.keys(
                        channelMeta,
                      ) as Channel[]
                    ).map(
                      (channel) => (
                        <td
                          key={
                            channel
                          }
                        >
                          <button
                            type="button"
                            className={
                              styles.smallToggle
                            }
                            onClick={() =>
                              toggleRuleChannel(
                                rule.id,
                                channel,
                              )
                            }
                            aria-pressed={
                              rule
                                .channels[
                                channel
                              ]
                            }
                            aria-label={`${channelMeta[channel].label} for ${rule.name}`}
                          >
                            {rule
                              .channels[
                              channel
                            ] ? (
                              <Check
                                size={
                                  14
                                }
                              />
                            ) : (
                              "—"
                            )}
                          </button>
                        </td>
                      ),
                    )}

                    <td>
                      <button
                        type="button"
                        className={`${styles.ruleStatus} ${
                          rule.enabled
                            ? styles.ruleOn
                            : styles.ruleOff
                        }`}
                        onClick={() =>
                          toggleRule(
                            rule.id,
                          )
                        }
                      >
                        {rule.enabled
                          ? "Enabled"
                          : "Disabled"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className={styles.infoBox}
      >
        <Bell size={18} />

        <div>
          <strong>
            Notification delivery
          </strong>

          <p>
            SMS delivery depends on
            the configured provider
            and user verification.
            This page currently
            stores settings in local
            UI state only.
          </p>
        </div>
      </section>
    </main>
  );
}