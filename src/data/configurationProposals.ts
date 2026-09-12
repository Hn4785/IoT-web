import type { ConfigurationProposal } from "@/types/configuration";

export const configurationProposals: ConfigurationProposal[] = [
  {
    id: "CP-0056",
    createdBy: "USR-003",
    stationId: "ST-004",
    sensorId: "SNS-010",

    currentConfiguration: {
      measurementInterval: "5 min",
      sendInterval: "15 min",
      staleAfter: "30 min",
      offlineTimeout: "60 min",
    },

    proposedConfiguration: {
      measurementInterval: "2 min",
      sendInterval: "5 min",
      staleAfter: "15 min",
      offlineTimeout: "30 min",
    },

    changes: [
      {
        field: "Measurement Interval",
        previousValue: "5 min",
        newValue: "2 min",
      },
      {
        field: "Send Rate",
        previousValue: "15 min",
        newValue: "5 min",
      },
      {
        field: "Stale Timeout",
        previousValue: "30 min",
        newValue: "15 min",
      },
      {
        field: "Offline Watchdog Timeout",
        previousValue: "60 min",
        newValue: "30 min",
      },
    ],

    reason:
      "Increase telemetry freshness for the West Field Station during the current monitoring period.",

    expectedImpact:
      "Battery life may decrease and cellular payload volume will increase.",

    status: "pending_approval",

    createdAt: "2026-08-29T08:30:00Z",
    updatedAt: "2026-08-29T08:30:00Z",
  },

  {
    id: "CP-0055",
    createdBy: "USR-003",
    stationId: "ST-002",
    sensorId: "SNS-004",

    currentConfiguration: {
      measurementInterval: "5 min",
      sendInterval: "5 min",
      staleAfter: "15 min",
      offlineTimeout: "30 min",
    },

    proposedConfiguration: {
      measurementInterval: "5 min",
      sendInterval: "10 min",
      staleAfter: "20 min",
      offlineTimeout: "30 min",
    },

    changes: [
      {
        field: "Send Rate",
        previousValue: "5 min",
        newValue: "10 min",
      },
      {
        field: "Stale Timeout",
        previousValue: "15 min",
        newValue: "20 min",
      },
    ],

    reason:
      "Reduce transmission frequency after reviewing station battery behavior.",

    expectedImpact:
      "Lower network traffic with slightly less frequent updates.",

    status: "approved",

    reviewedBy: "USR-001",
    reviewedAt: "2026-08-28T15:10:00Z",

    createdAt: "2026-08-28T09:10:00Z",
    updatedAt: "2026-08-28T15:10:00Z",
  },

  {
    id: "CP-0054",
    createdBy: "USR-004",
    stationId: "ST-003",
    sensorId: "SNS-008",

    currentConfiguration: {
      measurementInterval: "5 min",
      sendInterval: "5 min",
      staleAfter: "15 min",
      offlineTimeout: "30 min",
    },

    proposedConfiguration: {
      measurementInterval: "1 min",
      sendInterval: "1 min",
      staleAfter: "5 min",
      offlineTimeout: "15 min",
    },

    changes: [
      {
        field: "Measurement Interval",
        previousValue: "5 min",
        newValue: "1 min",
      },
      {
        field: "Send Rate",
        previousValue: "5 min",
        newValue: "1 min",
      },
    ],

    reason:
      "Temporary high-frequency diagnostic capture.",

    expectedImpact:
      "Significantly higher battery and network consumption.",

    status: "rejected",

    reviewedBy: "USR-001",
    reviewedAt: "2026-08-27T11:20:00Z",

    rejectionReason:
      "Impact is too high for the current station battery profile.",

    createdAt: "2026-08-27T08:15:00Z",
    updatedAt: "2026-08-27T11:20:00Z",
  },

  {
    id: "CP-0053",
    createdBy: "USR-002",
    stationId: "ST-001",
    sensorId: "SNS-001",

    currentConfiguration: {
      measurementInterval: "5 min",
      sendInterval: "5 min",
      staleAfter: "15 min",
      offlineTimeout: "30 min",
    },

    proposedConfiguration: {
      measurementInterval: "5 min",
      sendInterval: "5 min",
      staleAfter: "15 min",
      offlineTimeout: "30 min",
    },

    changes: [],

    reason:
      "Routine configuration review.",

    expectedImpact:
      "No expected operational impact.",

    status: "applied",

    reviewedBy: "USR-001",
    reviewedAt: "2026-08-26T14:00:00Z",

    createdAt: "2026-08-26T09:00:00Z",
    updatedAt: "2026-08-26T14:00:00Z",
  },

  {
    id: "CP-0052",
    createdBy: "USR-004",
    stationId: "ST-005",
    sensorId: "SNS-013",

    currentConfiguration: {
      measurementInterval: "10 min",
      sendInterval: "10 min",
      staleAfter: "30 min",
      offlineTimeout: "60 min",
    },

    proposedConfiguration: {
      measurementInterval: "5 min",
      sendInterval: "5 min",
      staleAfter: "15 min",
      offlineTimeout: "30 min",
    },

    changes: [
      {
        field: "Measurement Interval",
        previousValue: "10 min",
        newValue: "5 min",
      },
      {
        field: "Send Rate",
        previousValue: "10 min",
        newValue: "5 min",
      },
    ],

    reason:
      "Improve responsiveness for an active crop monitoring block.",

    expectedImpact:
      "Moderate increase in telemetry volume.",

    status: "draft",

    createdAt: "2026-08-25T10:00:00Z",
    updatedAt: "2026-08-25T10:00:00Z",
  },
];