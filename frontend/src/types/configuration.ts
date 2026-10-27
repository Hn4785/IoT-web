export interface SensorProfile {
  id: string;

  name: string;
  sensorModel: string;

  measurementInterval: number;
  sendInterval: number;

  staleAfter: number;
  offlineTimeout: number;

  measurementUnits: Record<string, string>;

  status: "draft" | "published" | "disabled";

  version: number;

  updatedAt: string;
  updatedBy: string;
}

export type AlertOperator =
  | ">"
  | "<"
  | ">="
  | "<="
  | "==";

export interface AlertRule {
  id: string;
  name: string;

  metric: string;
  operator: AlertOperator;
  threshold: number;

  duration: number;

  hysteresis?: number;

  cooldown: number;

  severity: "warning" | "critical";

  enabled: boolean;

  farmId?: string;
  plotId?: string;
  stationId?: string;
  sensorId?: string;

  createdAt: string;
  updatedAt: string;
}

export type NotificationChannel =
  | "web"
  | "push"
  | "email"
  | "sms";

export type ConfigurationStatus =
  | "draft"
  | "review"
  | "published"
  | "applied"
  | "failed"
  | "rolled_back";

export interface ConfigurationVersion {
  id: string;

  version: number;

  status: ConfigurationStatus;

  createdBy: string;
  createdAt: string;

  effectiveAt?: string;

  changes: string[];

  isCurrent: boolean;
}

export type EscalationLevel =
  | "T1"
  | "T2"
  | "T3";

export interface EscalationPolicy {
  /** ID */
  id: string;

  /** Tên policy */
  name: string;

  /** Timeout acknowledge */
  acknowledgeTimeout: number;

  /** Delay trước khi escalation */
  escalationDelay: number;

  /** Danh sách level */
  levels: EscalationLevel[];

  /** Kênh notification */
  channels: NotificationChannel[];

  /** Policy có được bật không */
  enabled: boolean;
}

export interface ConfigurationChange {
  /** Tên field thay đổi */
  field: string;

  /** Giá trị cũ */
  previousValue: unknown;

  /** Giá trị mới */
  newValue: unknown;
}

export type ConfigurationProposalStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "applied";

export interface ConfigurationProposal {
  /** ID proposal */
  id: string;

  /** Technician tạo proposal */
  createdBy: string;

  /** Station cần thay đổi */
  stationId: string;

  /** Sensor liên quan */
  sensorId?: string;

  /** Configuration hiện tại */
  currentConfiguration: Record<string, unknown>;

  /** Configuration đề xuất */
  proposedConfiguration: Record<string, unknown>;

  /** Các thay đổi */
  changes: ConfigurationChange[];

  /** Lý do */
  reason: string;

  /** Tác động dự kiến */
  expectedImpact?: string;

  /** Trạng thái */
  status: ConfigurationProposalStatus;

  /** Người review */
  reviewedBy?: string;

  /** Thời điểm review */
  reviewedAt?: string;

  /** Lý do reject */
  rejectionReason?: string;

  /** Thời điểm tạo */
  createdAt: string;

  /** Thời điểm cập nhật */
  updatedAt: string;
}