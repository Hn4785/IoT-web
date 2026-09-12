import { useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Clock3,
  GitCompare,
  X,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/common/Button";
import Drawer from "@/components/common/Drawer";
import StatusBadge from "@/components/common/StatusBadge";

import { configurationProposals } from "@/data/configurationProposals";
import { stations } from "@/data/stations";

import type {
  ConfigurationProposal,
  ConfigurationProposalStatus,
} from "@/types/configuration";

import styles from "./ConfigurationProposals.module.css";

type Filter =
  | "all"
  | ConfigurationProposalStatus;

const labels: Record<
  ConfigurationProposalStatus,
  string
> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  applied: "Applied",
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

export default function ConfigurationProposals() {
  const [filter, setFilter] =
    useState<Filter>("all");

  const [selected, setSelected] =
    useState<ConfigurationProposal | null>(
      null,
    );

  const visible = useMemo(
    () =>
      configurationProposals.filter(
        (proposal) =>
          filter === "all" ||
          proposal.status === filter,
      ),
    [filter],
  );

  const filters: Filter[] = [
    "all",
    "draft",
    "pending_approval",
    "approved",
    "rejected",
    "applied",
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Configuration Proposals"
        description="Review proposed IoT configuration changes before they are propagated to stations."
      />

      <section className={styles.panel}>
        {/* =========================
            TABS
        ========================== */}

        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Proposal status"
        >
          {filters.map((item) => {
            const count =
              item === "all"
                ? configurationProposals.length
                : configurationProposals.filter(
                    (proposal) =>
                      proposal.status === item,
                  ).length;

            return (
              <button
                key={item}
                type="button"
                className={
                  filter === item
                    ? styles.activeTab
                    : ""
                }
                onClick={() =>
                  setFilter(item)
                }
                role="tab"
                aria-selected={
                  filter === item
                }
              >
                {item === "all"
                  ? "All"
                  : labels[item]}

                <span>{count}</span>
              </button>
            );
          })}
        </div>

        {/* =========================
            TABLE
        ========================== */}

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Proposal ID</th>
                <th>Target Station</th>
                <th>Sensor</th>
                <th>Change Summary</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Created At</th>
                <th aria-label="Action" />
              </tr>
            </thead>

            <tbody>
              {visible.map(
                (proposal) => {
                  const station =
                    stations.find(
                      (item) =>
                        item.id ===
                        proposal.stationId,
                    );

                  const summary =
                    proposal.changes.length
                      ? `${
                          proposal.changes.length
                        } change${
                          proposal.changes
                            .length > 1
                            ? "s"
                            : ""
                        }: ${proposal.changes
                          .slice(0, 2)
                          .map(
                            (change) =>
                              change.field,
                          )
                          .join(", ")}${
                          proposal.changes
                            .length > 2
                            ? "..."
                            : ""
                        }`
                      : "No configuration changes";

                  return (
                    <tr
                      key={proposal.id}
                    >
                      <td
                        className={
                          styles.mono
                        }
                      >
                        <strong>
                          {proposal.id}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {station?.name ??
                            proposal.stationId}
                        </strong>

                        <span
                          className={
                            styles.sub
                          }
                        >
                          {
                            proposal.stationId
                          }
                        </span>
                      </td>

                      <td
                        className={
                          styles.mono
                        }
                      >
                        {proposal.sensorId ??
                          "Station config"}
                      </td>

                      <td
                        className={
                          styles.summary
                        }
                      >
                        {summary}
                      </td>

                      <td>
                        <ProposalBadge
                          status={
                            proposal.status
                          }
                        />
                      </td>

                      <td
                        className={
                          styles.mono
                        }
                      >
                        {
                          proposal.createdBy
                        }
                      </td>

                      <td>
                        {formatDate(
                          proposal.createdAt,
                        )}
                      </td>

                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={
                            <ChevronRight
                              size={15}
                            />
                          }
                          onClick={() =>
                            setSelected(
                              proposal,
                            )
                          }
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  );
                },
              )}

              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className={
                      styles.empty
                    }
                  >
                    No configuration
                    proposals found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* =========================
          REVIEW DRAWER
      ========================== */}

      <Drawer
        isOpen={Boolean(selected)}
        onClose={() =>
          setSelected(null)
        }
        title={
          selected
            ? `Proposal ${selected.id}`
            : undefined
        }
        description={
          selected
            ? `${labels[selected.status]} · created ${formatDate(
                selected.createdAt,
              )}`
            : undefined
        }
        size="lg"
        footer={
          selected ? (
            <div
              className={
                styles.drawerActions
              }
            >
              <Button
                variant="danger"
                icon={<X size={15} />}
                disabled={
                  selected.status !==
                  "pending_approval"
                }
              >
                Reject Proposal
              </Button>

              <Button
                icon={
                  <Check size={15} />
                }
                disabled={
                  selected.status !==
                  "pending_approval"
                }
              >
                Approve & Propagate
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <ProposalDetail
            proposal={selected}
          />
        )}
      </Drawer>
    </div>
  );
}

/* =========================
   STATUS BADGE
========================= */

function ProposalBadge({
  status,
}: {
  status: ConfigurationProposalStatus;
}) {
  if (
    status === "pending_approval"
  ) {
    return (
      <StatusBadge
        status="warning"
        label="Pending Approval"
        size="sm"
      />
    );
  }

  if (status === "approved") {
    return (
      <StatusBadge
        status="acknowledged"
        label="Approved"
        size="sm"
      />
    );
  }

  if (status === "rejected") {
    return (
      <StatusBadge
        status="expired"
        label="Rejected"
        size="sm"
      />
    );
  }

  if (status === "applied") {
    return (
      <StatusBadge
        status="valid"
        label="Applied"
        size="sm"
      />
    );
  }

  return (
    <StatusBadge
      status="stale"
      label="Draft"
      size="sm"
    />
  );
}

/* =========================
   DETAIL
========================= */

function ProposalDetail({
  proposal,
}: {
  proposal: ConfigurationProposal;
}) {
  return (
    <div className={styles.detail}>
      <div
        className={styles.detailHero}
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            Target Station
          </span>

          <strong>
            {proposal.stationId}
          </strong>

          <small>
            {proposal.sensorId ??
              "Station-level configuration"}
          </small>
        </div>

        <ProposalBadge
          status={proposal.status}
        />
      </div>

      {/* =========================
          CONFIG DIFF
      ========================== */}

      <section
        className={
          styles.detailSection
        }
      >
        <div
          className={
            styles.sectionTitle
          }
        >
          <GitCompare
            size={17}
          />

          <h3>
            Current → Proposed
          </h3>
        </div>

        <div className={styles.diff}>
          {proposal.changes.length >
          0 ? (
            proposal.changes.map(
              (change) => (
                <div
                  className={
                    styles.diffRow
                  }
                  key={change.field}
                >
                  <span>
                    {change.field}
                  </span>

                  <div
                    className={
                      styles.oldValue
                    }
                  >
                    {String(
                      change.previousValue,
                    )}
                  </div>

                  <div
                    className={
                      styles.arrow
                    }
                  >
                    <ChevronRight
                      size={15}
                    />
                  </div>

                  <div
                    className={
                      styles.newValue
                    }
                  >
                    {String(
                      change.newValue,
                    )}
                  </div>
                </div>
              ),
            )
          ) : (
            <div
              className={
                styles.noChanges
              }
            >
              No values changed.
            </div>
          )}
        </div>
      </section>

      {/* =========================
          JUSTIFICATION
      ========================== */}

      <section
        className={
          styles.detailSection
        }
      >
        <div
          className={
            styles.sectionTitle
          }
        >
          <Clock3 size={17} />

          <h3>
            Proposal Justification
          </h3>
        </div>

        <p className={styles.text}>
          {proposal.reason}
        </p>

        <div className={styles.impact}>
          <strong>
            System & hardware impact
          </strong>

          <p>
            {proposal.expectedImpact ??
              "No impact estimate provided."}
          </p>
        </div>
      </section>

      {/* =========================
          REJECTION REASON
      ========================== */}

      {proposal.rejectionReason && (
        <section
          className={
            styles.detailSection
          }
        >
          <div
            className={
              styles.sectionTitle
            }
          >
            <X size={17} />

            <h3>
              Review Note
            </h3>
          </div>

          <p className={styles.text}>
            {proposal.rejectionReason}
          </p>
        </section>
      )}
    </div>
  );
}