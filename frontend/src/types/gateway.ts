export type GatewayStatus =
  | "online"
  | "offline"
  | "stale"
  | "maintenance"
  | "disabled";

export type CredentialStatus =
  | "active"
  | "expired"
  | "revoked"
  | "rotation_required";

// Protocol mà gateway hỗ trợ để giao tiếp với server. Có thể là MQTT hoặc HTTPS.
export type GatewayProtocol =
  | "mqtts"
  | "https";

export interface Gateway {
  id: string;
  serialNumber: string;
  stationId?: string;
  farmId?: string;

  status: GatewayStatus;
  protocol?: GatewayProtocol;

  firmwareVersion?: string;

  lastSeen?: string;

  credentialStatus: CredentialStatus;

  ipAddress?: string;
  rssiDbm?: number;
  batteryPercent?: number;

  createdAt: string;
  updatedAt: string;
}