import {
  Battery,
  KeyRound,
  Radio,
  Router,
  Settings2,
  Wifi,
} from "lucide-react";

import type { Gateway } from "@/types/gateway";

import DeviceStatus from "./DeviceStatus";
import styles from "./GatewayCard.module.css";

interface GatewayCardProps {
  gateway: Gateway;
  stationName?: string;
  farmName?: string;
  onClick?: (gateway: Gateway) => void;
  onConfigure?: (gateway: Gateway) => void;
}

function formatLastSeen(lastSeen?: string) {
  if (!lastSeen) {
    return "Never";
  }

  const date = new Date(lastSeen);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

function getCredentialLabel(status: Gateway["credentialStatus"]) {
  switch (status) {
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "revoked":
      return "Revoked";
    case "rotation_required":
      return "Rotation Required";
    default:
      return "Unknown";
  }
}

function getCredentialClass(
  status: Gateway["credentialStatus"],
) {
  switch (status) {
    case "active":
      return styles.credentialActive;

    case "expired":
    case "rotation_required":
      return styles.credentialWarning;

    case "revoked":
      return styles.credentialDanger;

    default:
      return styles.credentialNeutral;
  }
}

export default function GatewayCard({
  gateway,
  stationName,
  farmName,
  onClick,
  onConfigure,
}: GatewayCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div className={styles.identity}>
          <div className={styles.icon}>
            <Router size={20} strokeWidth={1.8} />
          </div>

          <div className={styles.titleGroup}>
            <button
              type="button"
              className={styles.title}
              onClick={() => onClick?.(gateway)}
            >
              {gateway.serialNumber}
            </button>

            <span className={styles.id}>
              {gateway.id}
            </span>
          </div>
        </div>

        <DeviceStatus
          deviceType="gateway"
          status={gateway.status}
        />
      </div>

      <div className={styles.location}>
        <span>
          {farmName ?? "Farm not assigned"}
        </span>

        <span className={styles.separator}>/</span>

        <span>
          {stationName ?? "Station not assigned"}
        </span>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            <Wifi size={14} />
            Protocol
          </span>

          <span className={styles.metricValue}>
            {gateway.protocol
              ? gateway.protocol.toUpperCase()
              : "—"}
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            Firmware
          </span>

          <span className={styles.metricValue}>
            {gateway.firmwareVersion ?? "—"}
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            <Radio size={14} />
            RSSI
          </span>

          <span className={styles.metricValue}>
            {gateway.rssiDbm !== undefined
              ? `${gateway.rssiDbm} dBm`
              : "—"}
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            <Battery size={14} />
            Battery
          </span>

          <span className={styles.metricValue}>
            {gateway.batteryPercent !== undefined
              ? `${gateway.batteryPercent}%`
              : "—"}
          </span>
        </div>
      </div>

      <div className={styles.security}>
        <div className={styles.securityHeader}>
          <span className={styles.securityLabel}>
            <KeyRound size={14} />
            Credential
          </span>

          <span
            className={`${styles.credential} ${getCredentialClass(
              gateway.credentialStatus,
            )}`}
          >
            {getCredentialLabel(
              gateway.credentialStatus,
            )}
          </span>
        </div>

        <div className={styles.lastSeen}>
          <span>Last Seen</span>
          <strong>
            {formatLastSeen(gateway.lastSeen)}
          </strong>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.ipAddress}>
          {gateway.ipAddress ?? "IP unavailable"}
        </span>

        {onConfigure && (
          <button
            type="button"
            className={styles.configureButton}
            onClick={() => onConfigure(gateway)}
          >
            <Settings2 size={15} />
            Configure
          </button>
        )}
      </div>
    </article>
  );
}