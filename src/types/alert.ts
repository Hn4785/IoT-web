export type AlertSeverity =
  | "warning"
  | "critical";

export type AlertStatus =
  | "open"
  | "acknowledged"
  | "assigned"
  | "resolved";

export type AlertType =
  | "soil_moisture"
  | "temperature"
  | "ph"
  | "ec"
  | "npk"
  | "offline"
  | "low_battery"
  | "sensor_error"
  | "signal_loss"
  | "stale_data"
  | "calibration_expired";

export type AlertAction =
  | "acknowledge"
  | "assign"
  | "comment"
  | "resolve";

export interface AlertComment {
  id: string;
  alertId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface AlertTimelineEvent {
  id: string;
  alertId: string;
  action: AlertAction | "triggered";
  userId?: string;
  description: string;
  createdAt: string;
}

export interface Alert {
  id: string;

  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;

  title: string;
  description?: string;

  farmId?: string;
  plotId?: string;
  stationId?: string;
  sensorId?: string;

  metric?: string;

  currentValue?: number;
  threshold?: number;
  unit?: string;

  triggeredAt: string;
  duration?: number;

  acknowledgedAt?: string;
  acknowledgedBy?: string;

  assignedTo?: string;

  resolvedAt?: string;
  resolvedBy?: string;

  comments?: AlertComment[];
  timeline?: AlertTimelineEvent[];
  
  createdAt: string;
  updatedAt: string;
}