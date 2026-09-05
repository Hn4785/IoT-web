import { useMemo, useState } from "react";
import {
  Check,
  Clock3,
  MessageSquare,
  Send,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";

import { Button } from "@/components/common/Button";
import StatusBadge from "@/components/common/StatusBadge";

import { alerts as initialAlerts } from "@/data/alerts";
import { farms } from "@/data/farms";
import { plots } from "@/data/plots";
import { stations } from "@/data/stations";
import { users } from "@/data/user";

import type { Alert } from "@/types/alert";

import styles from "./AlertActionCenter.module.css";

const farmOwnerId = "USR-006";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

function formatDuration(
  seconds?: number,
) {
  if (!seconds) {
    return "—";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes =
    Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours =
    Math.floor(minutes / 60);

  return `${hours}h ${
    minutes % 60
  }m`;
}

export default function AlertActionCenter() {
  const ownedFarmIds = useMemo(
    () =>
      farms
        .filter(
          (farm) =>
            farm.ownerId ===
              farmOwnerId &&
            farm.status ===
              "active",
        )
        .map(
          (farm) => farm.id,
        ),
    [],
  );

  const [alertList, setAlertList] =
    useState<Alert[]>(
      initialAlerts
        .filter(
          (alert) =>
            alert.farmId &&
            ownedFarmIds.includes(
              alert.farmId,
            ) &&
            alert.status !==
              "resolved" &&
            (alert.severity ===
              "warning" ||
              alert.severity ===
                "critical"),
        )
        .sort(
          (a, b) =>
            new Date(
              b.triggeredAt,
            ).getTime() -
            new Date(
              a.triggeredAt,
            ).getTime(),
        ),
    );

  const [selectedId, setSelectedId] =
    useState(
      alertList[0]?.id ?? "",
    );

  const [
    severityFilter,
    setSeverityFilter,
  ] = useState<
    "all" |
      "warning" |
      "critical"
  >("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    "all" | Alert["status"]
  >("all");

  const [note, setNote] =
    useState("");

  const visibleAlerts =
    alertList.filter(
      (alert) => {
        const severityMatches =
          severityFilter ===
            "all" ||
          alert.severity ===
            severityFilter;

        const statusMatches =
          statusFilter ===
            "all" ||
          alert.status ===
            statusFilter;

        return (
          severityMatches &&
          statusMatches
        );
      },
    );

  const selectedAlert =
    visibleAlerts.find(
      (alert) =>
        alert.id === selectedId,
    ) ??
    visibleAlerts[0];

  const station =
    stations.find(
      (item) =>
        item.id ===
        selectedAlert?.stationId,
    );

  const plot =
    plots.find(
      (item) =>
        item.id ===
        selectedAlert?.plotId,
    );

  const farm =
    farms.find(
      (item) =>
        item.id ===
        selectedAlert?.farmId,
    );

  const addTimelineEvent = (
    alert: Alert,
    action:
      | "acknowledge"
      | "comment"
      | "resolve",
    description: string,
  ) => {
    const now =
      new Date().toISOString();

    const event = {
      id: `${alert.id}-${action}-${Date.now()}`,
      alertId: alert.id,
      action,
      userId: farmOwnerId,
      description,
      createdAt: now,
    };

    setAlertList(
      (current) =>
        current.map(
          (item) => {
            if (
              item.id !==
              alert.id
            ) {
              return item;
            }

            const nextStatus =
              action ===
              "acknowledge"
                ? "acknowledged"
                : action ===
                    "resolve"
                  ? "resolved"
                  : item.status;

            return {
              ...item,

              status: nextStatus,

              acknowledgedAt:
                action ===
                "acknowledge"
                  ? now
                  : item.acknowledgedAt,

              acknowledgedBy:
                action ===
                "acknowledge"
                  ? farmOwnerId
                  : item.acknowledgedBy,

              resolvedAt:
                action ===
                "resolve"
                  ? now
                  : item.resolvedAt,

              resolvedBy:
                action ===
                "resolve"
                  ? farmOwnerId
                  : item.resolvedBy,

              updatedAt: now,

              timeline: [
                ...(item.timeline ??
                  []),
                event,
              ],
            };
          },
        ),
    );
  };

  const handleAcknowledge =
    () => {
      if (!selectedAlert) {
        return;
      }

      addTimelineEvent(
        selectedAlert,
        "acknowledge",
        "Farm owner acknowledged the alert.",
      );
    };

  const handleResolve = () => {
    if (!selectedAlert) {
      return;
    }

    addTimelineEvent(
      selectedAlert,
      "resolve",
      "Farm owner marked the alert as resolved.",
    );
  };

  const handleAddNote = () => {
    if (
      !selectedAlert ||
      !note.trim()
    ) {
      return;
    }

    const content =
      note.trim();

    const now =
      new Date().toISOString();

    setAlertList(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            selectedAlert.id
              ? {
                  ...item,

                  comments: [
                    ...(item.comments ??
                      []),
                    {
                      id: `${item.id}-comment-${Date.now()}`,
                      alertId:
                        item.id,
                      userId:
                        farmOwnerId,
                      content,
                      createdAt: now,
                    },
                  ],

                  timeline: [
                    ...(item.timeline ??
                      []),
                    {
                      id: `${item.id}-comment-event-${Date.now()}`,
                      alertId:
                        item.id,
                      action:
                        "comment",
                      userId:
                        farmOwnerId,
                      description: `Added note: ${content}`,
                      createdAt: now,
                    },
                  ],

                  updatedAt: now,
                }
              : item,
        ),
    );

    setNote("");
  };

  const currentUser =
    users.find(
      (user) =>
        user.id ===
        farmOwnerId,
    );

  return (
    <main className={styles.page}>
      <header
        className={
          styles.pageHeader
        }
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            Farm Operations
          </span>

          <h1>
            Alert Action Center
          </h1>

          <p>
            Review active farm
            alerts, record actions,
            and resolve issues.
          </p>
        </div>

        <div
          className={styles.summary}
        >
          <strong>
            {alertList.length}
          </strong>

          <span>
            active alerts
          </span>
        </div>
      </header>

      <section
        className={styles.toolbar}
      >
        <label>
          <span>Severity</span>

          <select
            value={severityFilter}
            onChange={(event) =>
              setSeverityFilter(
                event.target.value as
                  | "all"
                  | "warning"
                  | "critical",
              )
            }
          >
            <option value="all">
              All severities
            </option>

            <option value="warning">
              Warning
            </option>

            <option value="critical">
              Critical
            </option>
          </select>
        </label>

        <label>
          <span>Status</span>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | "all"
                  | Alert["status"],
              )
            }
          >
            <option value="all">
              All statuses
            </option>

            <option value="open">
              Open
            </option>

            <option value="acknowledged">
              Acknowledged
            </option>

            <option value="assigned">
              Assigned
            </option>
          </select>
        </label>
      </section>

      <div
        className={
          styles.workspace
        }
      >
        <section
          className={
            styles.listPanel
          }
        >
          <div
            className={
              styles.panelHeader
            }
          >
            <div>
              <h2>Alerts</h2>

              <span>
                {
                  visibleAlerts.length
                }{" "}
                matching alerts
              </span>
            </div>
          </div>

          <div
            className={
              styles.alertList
            }
          >
            {visibleAlerts.length ===
            0 ? (
              <div
                className={
                  styles.emptyList
                }
              >
                <Check size={24} />

                <strong>
                  No alerts require
                  action
                </strong>

                <p>
                  There are no alerts
                  matching the current
                  filters.
                </p>
              </div>
            ) : (
              visibleAlerts.map(
                (alert) => {
                  const alertStation =
                    stations.find(
                      (item) =>
                        item.id ===
                        alert.stationId,
                    );

                  const alertPlot =
                    plots.find(
                      (item) =>
                        item.id ===
                        alert.plotId,
                    );

                  return (
                    <button
                      type="button"
                      key={alert.id}
                      className={`${styles.alertItem} ${
                        alert.id ===
                        selectedAlert?.id
                          ? styles.selected
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedId(
                          alert.id,
                        )
                      }
                    >
                      <div
                        className={
                          styles.alertItemTop
                        }
                      >
                        <StatusBadge
                          status={
                            alert.severity
                          }
                          size="sm"
                        />

                        <StatusBadge
                          status={
                            alert.status
                          }
                          size="sm"
                          dot={false}
                        />
                      </div>

                      <strong>
                        {alert.title}
                      </strong>

                      <span>
                        {alertStation?.name ??
                          "Unknown station"}
                        {" · "}
                        {alertPlot?.name ??
                          "Unknown plot"}
                      </span>

                      <small>
                        {formatDate(
                          alert.triggeredAt,
                        )}
                      </small>
                    </button>
                  );
                },
              )
            )}
          </div>
        </section>

        {selectedAlert ? (
          <section
            className={
              styles.detailPanel
            }
          >
            <div
              className={
                styles.detailHeader
              }
            >
              <div>
                <div
                  className={
                    styles.badgeRow
                  }
                >
                  <StatusBadge
                    status={
                      selectedAlert.severity
                    }
                  />

                  <StatusBadge
                    status={
                      selectedAlert.status
                    }
                    dot={false}
                  />
                </div>

                <h2>
                  {selectedAlert.title}
                </h2>

                <p>
                  {selectedAlert.description ??
                    "No additional description."}
                </p>
              </div>

              <ShieldAlert
                size={30}
                className={
                  selectedAlert.severity ===
                  "critical"
                    ? styles.criticalIcon
                    : styles.warningIcon
                }
              />
            </div>

            <div
              className={
                styles.actionBar
              }
            >
              <Button
                variant="outline"
                size="sm"
                icon={
                  <Check size={15} />
                }
                onClick={
                  handleAcknowledge
                }
                disabled={
                  selectedAlert.status ===
                    "acknowledged" ||
                  selectedAlert.status ===
                    "resolved"
                }
              >
                Acknowledge
              </Button>

              <Button
                variant="secondary"
                size="sm"
                icon={
                  <MessageSquare
                    size={15}
                  />
                }
                onClick={() =>
                  document
                    .getElementById(
                      "alert-note",
                    )
                    ?.focus()
                }
                disabled={
                  selectedAlert.status ===
                  "resolved"
                }
              >
                Add Note
              </Button>

              <Button
                variant="primary"
                size="sm"
                icon={
                  <X size={15} />
                }
                onClick={
                  handleResolve
                }
                disabled={
                  selectedAlert.status ===
                  "resolved"
                }
              >
                Mark as Resolved
              </Button>
            </div>

            <div
              className={
                styles.detailGrid
              }
            >
              <div>
                <span>Farm</span>
                <strong>
                  {farm?.name ?? "—"}
                </strong>
              </div>

              <div>
                <span>Plot</span>
                <strong>
                  {plot?.name ?? "—"}
                </strong>
              </div>

              <div>
                <span>Station</span>
                <strong>
                  {station?.name ?? "—"}
                </strong>
              </div>

              <div>
                <span>Metric</span>
                <strong>
                  {selectedAlert.metric ??
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  Current value
                </span>

                <strong>
                  {selectedAlert.currentValue !=
                  null
                    ? `${selectedAlert.currentValue} ${
                        selectedAlert.unit ??
                        ""
                      }`
                    : "—"}
                </strong>
              </div>

              <div>
                <span>
                  Threshold
                </span>

                <strong>
                  {selectedAlert.threshold !=
                  null
                    ? `${selectedAlert.threshold} ${
                        selectedAlert.unit ??
                        ""
                      }`
                    : "—"}
                </strong>
              </div>

              <div>
                <span>
                  Triggered at
                </span>

                <strong>
                  {formatDate(
                    selectedAlert.triggeredAt,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Duration
                </span>

                <strong>
                  {formatDuration(
                    selectedAlert.duration,
                  )}
                </strong>
              </div>
            </div>

            <div
              className={
                styles.sectionBlock
              }
            >
              <div
                className={
                  styles.blockHeader
                }
              >
                <div>
                  <h3>
                    Recommended Action
                  </h3>

                  <p>
                    Review the affected
                    plot and sensor
                    condition before
                    taking corrective
                    action.
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.recommendation
                }
              >
                <ShieldAlert
                  size={18}
                />

                <span>
                  {selectedAlert.severity ===
                  "critical"
                    ? "Priority inspection is recommended. Verify the sensor reading and station condition."
                    : "Review the current soil condition and monitor the affected station."}
                </span>
              </div>
            </div>

            <div
              className={
                styles.sectionBlock
              }
            >
              <div
                className={
                  styles.blockHeader
                }
              >
                <div>
                  <h3>
                    Activity Timeline
                  </h3>

                  <p>
                    Recorded actions for
                    this alert.
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.timeline
                }
              >
                {[
                  ...(selectedAlert.timeline ??
                    []),
                ]
                  .sort(
                    (a, b) =>
                      new Date(
                        a.createdAt,
                      ).getTime() -
                      new Date(
                        b.createdAt,
                      ).getTime(),
                  )
                  .map((event) => (
                    <div
                      key={event.id}
                      className={
                        styles.timelineItem
                      }
                    >
                      <div
                        className={
                          styles.timelineIcon
                        }
                      >
                        {event.action ===
                        "acknowledge" ? (
                          <Check
                            size={14}
                          />
                        ) : event.action ===
                          "comment" ? (
                          <MessageSquare
                            size={14}
                          />
                        ) : event.action ===
                          "resolve" ? (
                          <X
                            size={14}
                          />
                        ) : (
                          <Clock3
                            size={14}
                          />
                        )}
                      </div>

                      <div>
                        <strong>
                          {
                            event.description
                          }
                        </strong>

                        <span>
                          {formatDate(
                            event.createdAt,
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div
              className={
                styles.sectionBlock
              }
            >
              <div
                className={
                  styles.blockHeader
                }
              >
                <div>
                  <h3>Notes</h3>

                  <p>
                    Record the action
                    taken or observations
                    from the farm.
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.noteComposer
                }
              >
                <textarea
                  id="alert-note"
                  value={note}
                  onChange={(event) =>
                    setNote(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Write a note..."
                  rows={3}
                  disabled={
                    selectedAlert.status ===
                    "resolved"
                  }
                />

                <Button
                  variant="primary"
                  size="sm"
                  icon={
                    <Send size={14} />
                  }
                  onClick={
                    handleAddNote
                  }
                  disabled={
                    !note.trim() ||
                    selectedAlert.status ===
                      "resolved"
                  }
                >
                  Add Note
                </Button>
              </div>

              {(
                selectedAlert.comments ??
                []
              ).length > 0 && (
                <div
                  className={
                    styles.comments
                  }
                >
                  {selectedAlert.comments?.map(
                    (comment) => {
                      const author =
                        users.find(
                          (user) =>
                            user.id ===
                            comment.userId,
                        );

                      return (
                        <article
                          key={
                            comment.id
                          }
                        >
                          <div
                            className={
                              styles.commentAvatar
                            }
                          >
                            <UserRound
                              size={15}
                            />
                          </div>

                          <div>
                            <strong>
                              {author?.displayName ??
                                "Farm user"}
                            </strong>

                            <span>
                              {formatDate(
                                comment.createdAt,
                              )}
                            </span>

                            <p>
                              {
                                comment.content
                              }
                            </p>
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            <div
              className={
                styles.auditNote
              }
            >
              <UserRound size={15} />

              Actions are recorded for{" "}
              <strong>
                {currentUser?.displayName ??
                  "the farm owner"}
              </strong>{" "}
              in this mock workflow.
            </div>
          </section>
        ) : (
          <section
            className={
              styles.emptyDetail
            }
          >
            <Check size={28} />

            <h2>
              No alert selected
            </h2>

            <p>
              Select an alert from the
              list to review its details.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}