export type NotificationSeverity = "info" | "warning" | "critical";

export type NotificationType =
  | "soil_moisture"
  | "offline"
  | "low_battery"
  | "sensor_error"
  | "stale_data"
  | "calibration_expired"
  | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;

  stationId?: string;
  sensorId?: string;

  metric?: string;
  currentValue?: number;
  threshold?: number;
  unit?: string;

  createdAt: string;
  read: boolean;
}