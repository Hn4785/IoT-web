import { Link } from "react-router-dom";

import DeviceCapabilityNotice from "../../components/devices/DeviceCapabilityNotice.tsx";

export default function IoTConfiguration() {
  return (
    <>
      <DeviceCapabilityNotice
        title="IoT Configuration"
        description="Device configuration is unavailable until the hardware command contract is approved."
      />
      <p style={{ margin: "0 24px 24px" }}>
        Soil alert thresholds can be managed in the <Link to="/admin/alert-center">Alert Center</Link>.
      </p>
    </>
  );
}
