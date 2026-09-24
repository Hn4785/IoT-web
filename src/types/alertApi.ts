export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type AlertSeverity = "WARNING" | "CRITICAL";
export type SoilAlertField =
  | "temperature"
  | "moisture"
  | "ec"
  | "ph"
  | "nitrogen"
  | "phosphorus"
  | "potassium"
  | "light";

export type AlertCondition =
  | { operator: "ABOVE" | "BELOW"; threshold: number }
  | { operator: "OUTSIDE_RANGE"; lowerThreshold: number; upperThreshold: number };

export interface AlertDto {
  id: string;
  ruleId: string;
  station: { id: string; code: string; name: string };
  field: SoilAlertField;
  unit: string;
  metadataRevision: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  status: AlertStatus;
  openedValue: number;
  openedObservedAt: string;
  latestValue: number;
  latestObservedAt: string;
  openedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionReason: "RECOVERED" | "MANUAL" | "RULE_DISABLED" | "METADATA_CHANGED" | null;
  revision: number;
}

export interface AlertRuleDto {
  id: string;
  stationId: string;
  field: SoilAlertField;
  unit: string;
  metadataRevision: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  requiredBreachSamples: 2;
  requiredRecoverySamples: 2;
  isEnabled: boolean;
  evaluationStatus: "READY" | "DISABLED" | "BLOCKED_METADATA";
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AlertQuery {
  stationId?: string;
  status?: AlertStatus;
  severity?: AlertSeverity;
  limit?: number;
  cursor?: string;
}

export interface AlertRuleQuery {
  limit?: number;
  cursor?: string;
}

export interface CreateAlertRuleInput {
  field: SoilAlertField;
  unit: string;
  expectedMetadataRevision: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  isEnabled?: boolean;
}

export type UpdateAlertRuleInput = Partial<Omit<CreateAlertRuleInput, "field">> & {
  expectedRevision: number;
};
