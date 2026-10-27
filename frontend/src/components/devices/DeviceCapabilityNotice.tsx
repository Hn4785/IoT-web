import { useEffect, useState } from "react";
import { RadioTower, ShieldCheck } from "lucide-react";

import { deviceCapabilityService, type DeviceCapability } from "../../services/deviceCapabilityService.ts";
import { normalizeApiError } from "../../utils/apiError.ts";
import PageHeader from "../layout/PageHeader.tsx";
import styles from "./DeviceCapabilityNotice.module.css";

interface DeviceCapabilityNoticeProps {
  title: string;
  description: string;
}

export default function DeviceCapabilityNotice({ title, description }: DeviceCapabilityNoticeProps) {
  const [capability, setCapability] = useState<DeviceCapability | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    deviceCapabilityService.get().then(
      (value) => { if (active) setCapability(value); },
      (reason) => { if (active) setError(normalizeApiError(reason).message); },
    );
    return () => { active = false; };
  }, []);

  return (
    <div className={styles.page}>
      <PageHeader title={title} description={description} />
      <section className={styles.card}>
        <span className={styles.icon}><RadioTower size={28} /></span>
        <h2>Device operations are not available yet</h2>
        <p>The backend intentionally blocks device configuration until the provider supplies a versioned device command contract, acknowledgement semantics, and recovery rules.</p>
        {capability && <code>{capability.status} · {capability.reasonCode}</code>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.safe}><ShieldCheck size={18} /> No mock device state or unsafe write action is shown as production data.</div>
      </section>
    </div>
  );
}
