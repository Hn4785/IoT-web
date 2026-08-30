import type {
  LatestSoilData,
  SoilHistoryPoint,
  SoilTelemetryRecord,
} from "@/types/soil";

export const latestSoilData: LatestSoilData[] = [
  {
    farmId: "FARM-001",
    plotId: "PLOT-001",
    stationId: "ST-001",
    sensorId: "SNS-001",
    depth: 20,
    depthUnit: "cm",
    telemetry: {
      temperature: {
        value: 28.7,
        unit: "degC",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30Z",
      },
      moisture: {
        value: 32.5,
        unit: "%",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30Z",
      },
      ec: {
        value: 830,
        unit: "us_cm",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30Z",
      },
      ph: {
        value: 6.5,
        unit: "pH",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30Z",
      },
      nitrogen: {
        value: 122,
        unit: "mg_kg",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30Z",
      },
      phosphorus: {
        value: 46,
        unit: "mg_kg",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30Z",
      },
      potassium: {
        value: 182,
        unit: "mg_kg",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30Z",
      },
    },
    lastUpdated: "2026-08-29T10:20:30Z",
    connectionStatus: "connected",
  },

  {
    farmId: "FARM-001",
    plotId: "PLOT-002",
    stationId: "ST-002",
    sensorId: "SNS-004",
    depth: 20,
    depthUnit: "cm",
    telemetry: {
      temperature: {
        value: 29.4,
        unit: "degC",
        quality: "stale",
        measuredAt: "2026-08-29T10:16:40Z",
      },
      moisture: {
        value: 31.8,
        unit: "%",
        quality: "stale",
        measuredAt: "2026-08-29T10:16:40Z",
      },
      ec: {
        value: 910,
        unit: "us_cm",
        quality: "good",
        measuredAt: "2026-08-29T10:16:40Z",
      },
      ph: {
        value: 6.7,
        unit: "pH",
        quality: "good",
        measuredAt: "2026-08-29T10:16:40Z",
      },
    },
    lastUpdated: "2026-08-29T10:17:10Z",
    connectionStatus: "connected",
  },

  {
    farmId: "FARM-002",
    plotId: "PLOT-003",
    stationId: "ST-003",
    sensorId: "SNS-007",
    depth: 20,
    depthUnit: "cm",
    telemetry: {
      temperature: {
        value: 27.9,
        unit: "degC",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25Z",
      },
      moisture: {
        value: 41.2,
        unit: "%",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25Z",
      },
      ec: {
        value: 760,
        unit: "us_cm",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25Z",
      },
      ph: {
        value: 6.4,
        unit: "pH",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25Z",
      },
      nitrogen: {
        value: 135,
        unit: "mg_kg",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25Z",
      },
      phosphorus: {
        value: 51,
        unit: "mg_kg",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25Z",
      },
      potassium: {
        value: 196,
        unit: "mg_kg",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25Z",
      },
    },
    lastUpdated: "2026-08-29T10:20:25Z",
    connectionStatus: "connected",
  },

  {
    farmId: "FARM-002",
    plotId: "PLOT-004",
    stationId: "ST-004",
    sensorId: "SNS-010",
    depth: 20,
    depthUnit: "cm",
    telemetry: {
      temperature: {
        value: 30.1,
        unit: "degC",
        quality: "sensor_error",
        measuredAt: "2026-08-29T09:48:00Z",
      },
      moisture: {
        value: 0,
        unit: "%",
        quality: "sensor_error",
        measuredAt: "2026-08-29T09:48:00Z",
      },
      ec: {
        value: 980,
        unit: "us_cm",
        quality: "uncalibrated",
        measuredAt: "2026-08-29T09:48:00Z",
      },
      ph: {
        value: 6.9,
        unit: "pH",
        quality: "good",
        measuredAt: "2026-08-29T09:48:00Z",
      },
    },
    lastUpdated: "2026-08-29T09:48:02Z",
    connectionStatus: "disconnected",
  },

  {
    farmId: "FARM-003",
    plotId: "PLOT-005",
    stationId: "ST-005",
    sensorId: "SNS-013",
    depth: 20,
    depthUnit: "cm",
    telemetry: {
      temperature: {
        value: 26.8,
        unit: "degC",
        quality: "good",
        measuredAt: "2026-08-28T15:54:50Z",
      },
      moisture: {
        value: 38.6,
        unit: "%",
        quality: "good",
        measuredAt: "2026-08-28T15:54:50Z",
      },
      ph: {
        value: 6.2,
        unit: "pH",
        quality: "uncalibrated",
        measuredAt: "2026-08-28T15:54:50Z",
      },
    },
    lastUpdated: "2026-08-28T15:55:00Z",
    connectionStatus: "connected",
  },
];

export const soilTelemetryRecords: SoilTelemetryRecord[] = [
  {
    schemaVersion: "1.0",
    messageId: "MSG-20260829-000001",
    tenantId: "FARM-001",
    gatewayId: "GW-001",
    stationId: "ST-001",
    deviceId: "SOIL-PROBE-001",
    sensorId: "SNS-001",
    measurement: "soil",
    measuredAt: "2026-08-29T10:20:30.125Z",
    receivedAt: "2026-08-29T10:20:30.310Z",
    seq: 182734,
    telemetry: {
      temperature: {
        value: 28.7,
        unit: "degC",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30.125Z",
      },
      moisture: {
        value: 32.5,
        unit: "%",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30.125Z",
      },
      ec: {
        value: 830,
        unit: "us_cm",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30.125Z",
      },
      ph: {
        value: 6.5,
        unit: "pH",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30.125Z",
      },
      nitrogen: {
        value: 122,
        unit: "mg_kg",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30.125Z",
      },
      phosphorus: {
        value: 46,
        unit: "mg_kg",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30.125Z",
      },
      potassium: {
        value: 182,
        unit: "mg_kg",
        quality: "good",
        measuredAt: "2026-08-29T10:20:30.125Z",
      },
    },
    deviceStatus: {
      batteryPercent: 86,
      rssiDbm: -62,
      firmwareVersion: "1.2.3",
    },
  },

  {
    schemaVersion: "1.0",
    messageId: "MSG-20260829-000002",
    tenantId: "FARM-002",
    gatewayId: "GW-003",
    stationId: "ST-003",
    deviceId: "SOIL-PROBE-003",
    sensorId: "SNS-007",
    measurement: "soil",
    measuredAt: "2026-08-29T10:20:25.125Z",
    receivedAt: "2026-08-29T10:20:25.295Z",
    seq: 281420,
    telemetry: {
      temperature: {
        value: 27.9,
        unit: "degC",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25.125Z",
      },
      moisture: {
        value: 41.2,
        unit: "%",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25.125Z",
      },
      ec: {
        value: 760,
        unit: "us_cm",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25.125Z",
      },
      ph: {
        value: 6.4,
        unit: "pH",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25.125Z",
      },
      nitrogen: {
        value: 135,
        unit: "mg_kg",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25.125Z",
      },
      phosphorus: {
        value: 51,
        unit: "mg_kg",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25.125Z",
      },
      potassium: {
        value: 196,
        unit: "mg_kg",
        quality: "good",
        measuredAt: "2026-08-29T10:20:25.125Z",
      },
    },
    deviceStatus: {
      batteryPercent: 72,
      rssiDbm: -68,
      firmwareVersion: "1.2.2",
    },
  },
];

export const soilHistory: Record<string, SoilHistoryPoint[]> = {
  moisture: [
    {
      timestamp: "2026-08-29T09:20:00Z",
      value: 34.1,
      unit: "%",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T09:30:00Z",
      value: 33.7,
      unit: "%",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T09:40:00Z",
      value: 33.4,
      unit: "%",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T09:50:00Z",
      value: 33.0,
      unit: "%",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T10:00:00Z",
      value: 32.8,
      unit: "%",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T10:10:00Z",
      value: 32.6,
      unit: "%",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T10:20:00Z",
      value: 32.5,
      unit: "%",
      quality: "good",
    },
  ],

  temperature: [
    {
      timestamp: "2026-08-29T09:20:00Z",
      value: 27.9,
      unit: "degC",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T09:30:00Z",
      value: 28.1,
      unit: "degC",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T09:40:00Z",
      value: 28.3,
      unit: "degC",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T09:50:00Z",
      value: 28.4,
      unit: "degC",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T10:00:00Z",
      value: 28.5,
      unit: "degC",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T10:10:00Z",
      value: 28.6,
      unit: "degC",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T10:20:00Z",
      value: 28.7,
      unit: "degC",
      quality: "good",
    },
  ],

  ph: [
    {
      timestamp: "2026-08-29T09:20:00Z",
      value: 6.42,
      unit: "pH",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T09:30:00Z",
      value: 6.44,
      unit: "pH",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T09:40:00Z",
      value: 6.46,
      unit: "pH",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T09:50:00Z",
      value: 6.48,
      unit: "pH",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T10:00:00Z",
      value: 6.49,
      unit: "pH",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T10:10:00Z",
      value: 6.50,
      unit: "pH",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T10:20:00Z",
      value: 6.50,
      unit: "pH",
      quality: "good",
    },
  ],

  ec: [
    {
      timestamp: "2026-08-29T09:20:00Z",
      value: 810,
      unit: "us_cm",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T09:30:00Z",
      value: 818,
      unit: "us_cm",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T09:40:00Z",
      value: 825,
      unit: "us_cm",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T09:50:00Z",
      value: 822,
      unit: "us_cm",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T10:00:00Z",
      value: 828,
      unit: "us_cm",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T10:10:00Z",
      value: 831,
      unit: "us_cm",
      quality: "good",
    },
    {
      timestamp: "2026-08-29T10:20:00Z",
      value: 830,
      unit: "us_cm",
      quality: "good",
    },
  ],
};