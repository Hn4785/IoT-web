import { useMemo, useState } from "react";
import {
  KeyRound,
  Plus,
  QrCode,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/common/Button";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import Modal from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/Modal";
import Pagination from "@/components/common/Pagination";

import { stations } from "@/data/stations";
import { gateways } from "@/data/gateways";
import { sensors } from "@/data/sensors";
import { farms } from "@/data/farms";
import { plots } from "@/data/plots";

import styles from "./DeviceManagement.module.css";

type DeviceTab =
  | "stations"
  | "gateways"
  | "sensors";

export default function DeviceManagement() {
  const [activeTab, setActiveTab] =
    useState<DeviceTab>("stations");

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [registerOpen, setRegisterOpen] =
    useState(false);

  const [rotateGateway, setRotateGateway] =
    useState<string | null>(null);

  const pageSize = 7;

  const stationRows = useMemo(() => {
    const search = query.toLowerCase();

    return stations.filter((station) =>
      `${station.id} ${station.name}`
        .toLowerCase()
        .includes(search),
    );
  }, [query]);

  const gatewayRows = useMemo(() => {
    const search = query.toLowerCase();

    return gateways.filter((gateway) =>
      `${gateway.id} ${
        gateway.serialNumber
      } ${gateway.stationId ?? ""}`
        .toLowerCase()
        .includes(search),
    );
  }, [query]);

  const sensorRows = useMemo(() => {
    const search = query.toLowerCase();

    return sensors.filter((sensor) =>
      `${sensor.id} ${sensor.model} ${
        sensor.stationId
      } ${sensor.field}`
        .toLowerCase()
        .includes(search),
    );
  }, [query]);

  const totalItems =
    activeTab === "stations"
      ? stationRows.length
      : activeTab === "gateways"
        ? gatewayRows.length
        : sensorRows.length;

  const totalOnlineStations =
    stations.filter(
      (station) =>
        station.status === "online",
    ).length;

  const totalOnlineGateways =
    gateways.filter(
      (gateway) =>
        gateway.status === "online",
    ).length;

  const totalActiveSensors =
    sensors.filter(
      (sensor) =>
        sensor.status === "active",
    ).length;

  const rotationRequired =
    gateways.filter(
      (gateway) =>
        gateway.credentialStatus ===
        "rotation_required",
    ).length;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Device Management"
        description="Register and manage stations, gateways, sensors, and gateway credentials."
        actions={
          <Button
            icon={<Plus size={16} />}
            onClick={() =>
              setRegisterOpen(true)
            }
          >
            Register Device
          </Button>
        }
      />

      <section className={styles.stats}>
        <div>
          <span>Stations</span>

          <strong>
            {stations.length}
          </strong>

          <small>
            {totalOnlineStations} online
          </small>
        </div>

        <div>
          <span>Gateways</span>

          <strong>
            {gateways.length}
          </strong>

          <small>
            {totalOnlineGateways} online
          </small>
        </div>

        <div>
          <span>Sensors</span>

          <strong>
            {sensors.length}
          </strong>

          <small>
            {totalActiveSensors} active
          </small>
        </div>

        <div>
          <span>
            Credential attention
          </span>

          <strong>
            {rotationRequired}
          </strong>

          <small>
            rotation required
          </small>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            {(
              [
                "stations",
                "gateways",
                "sensors",
              ] as DeviceTab[]
            ).map((tab) => (
              <button
                key={tab}
                className={
                  activeTab === tab
                    ? styles.activeTab
                    : ""
                }
                onClick={() => {
                  setActiveTab(tab);
                  setPage(1);
                }}
              >
                {tab
                  .charAt(0)
                  .toUpperCase() +
                  tab.slice(1)}
              </button>
            ))}
          </div>

          <SearchInput
            onSearch={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder={`Search ${activeTab}...`}
          />
        </div>

        <div className={styles.tableWrap}>
          {activeTab === "stations" && (
            <table>
              <thead>
                <tr>
                  <th>Station ID</th>
                  <th>Name</th>
                  <th>Farm</th>
                  <th>Plot</th>
                  <th>Gateway</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                  <th>Firmware</th>
                  <th>Battery</th>
                </tr>
              </thead>

              <tbody>
                {stationRows
                  .slice(
                    (page - 1) *
                      pageSize,
                    page * pageSize,
                  )
                  .map((station) => (
                    <tr
                      key={station.id}
                    >
                      <td
                        className={
                          styles.mono
                        }
                      >
                        {station.id}
                      </td>

                      <td>
                        <strong>
                          {station.name}
                        </strong>
                      </td>

                      <td>
                        {farms.find(
                          (farm) =>
                            farm.id ===
                            station.farmId,
                        )?.name ??
                          station.farmId}
                      </td>

                      <td>
                        {plots.find(
                          (plot) =>
                            plot.id ===
                            station.plotId,
                        )?.name ??
                          station.plotId}
                      </td>

                      <td
                        className={
                          styles.mono
                        }
                      >
                        {station.gatewayId ??
                          "—"}
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            station.status
                          }
                        />
                      </td>

                      <td>
                        {station.lastSeen ??
                          "—"}
                      </td>

                      <td>
                        {
                          station.firmwareVersion ??
                          "—"
                        }
                      </td>

                      <td>
                        {station.batteryPercent ??
                          "—"}
                        %
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === "gateways" && (
            <table>
              <thead>
                <tr>
                  <th>Gateway ID</th>
                  <th>Serial Number</th>
                  <th>Station</th>
                  <th>Status</th>
                  <th>Firmware</th>
                  <th>Last Seen</th>
                  <th>Credential</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {gatewayRows
                  .slice(
                    (page - 1) *
                      pageSize,
                    page * pageSize,
                  )
                  .map((gateway) => (
                    <tr
                      key={gateway.id}
                    >
                      <td
                        className={
                          styles.mono
                        }
                      >
                        {gateway.id}
                      </td>

                      <td
                        className={
                          styles.mono
                        }
                      >
                        {
                          gateway.serialNumber
                        }
                      </td>

                      <td>
                        {gateway.stationId ??
                          "—"}
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            gateway.status
                          }
                        />
                      </td>

                      <td>
                        {
                          gateway.firmwareVersion ??
                          "—"
                        }
                      </td>

                      <td>
                        {gateway.lastSeen ??
                          "—"}
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            gateway.credentialStatus
                          }
                        />
                      </td>

                      <td>
                        <Button
                          iconOnly
                          variant="ghost"
                          aria-label="Rotate credential"
                          onClick={() =>
                            setRotateGateway(
                              gateway.id,
                            )
                          }
                        >
                          <RefreshCw
                            size={15}
                          />
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === "sensors" && (
            <table>
              <thead>
                <tr>
                  <th>Sensor ID</th>
                  <th>Model</th>
                  <th>Station</th>
                  <th>Measurement</th>
                  <th>Field</th>
                  <th>Depth</th>
                  <th>Unit</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {sensorRows
                  .slice(
                    (page - 1) *
                      pageSize,
                    page * pageSize,
                  )
                  .map((sensor) => (
                    <tr
                      key={sensor.id}
                    >
                      <td
                        className={
                          styles.mono
                        }
                      >
                        {sensor.id}
                      </td>

                      <td>
                        {sensor.model}
                      </td>

                      <td
                        className={
                          styles.mono
                        }
                      >
                        {sensor.stationId}
                      </td>

                      <td>
                        {sensor.measurement}
                      </td>

                      <td>
                        {sensor.field}
                      </td>

                      <td>
                        {sensor.depth
                          ? `${sensor.depth} ${
                              sensor.depthUnit ??
                              "cm"
                            }`
                          : "—"}
                      </td>

                      <td>
                        {sensor.unit}
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            sensor.status
                          }
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
          itemLabel={activeTab}
        />
      </section>

      <section className={styles.security}>
        <ShieldAlert size={18} />

        <div>
          <strong>
            Gateway credential security
          </strong>

          <p>
            Generate, rotate, upload
            certificates, or revoke
            credentials with explicit
            confirmation for destructive
            operations.
          </p>
        </div>
      </section>

      <Modal
        isOpen={registerOpen}
        onClose={() =>
          setRegisterOpen(false)
        }
        title="Register Device"
        description="Choose a registration method and enter the device identity."
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() =>
                setRegisterOpen(false)
              }
            >
              Cancel
            </Button>

            <Button
              onClick={() =>
                setRegisterOpen(false)
              }
            >
              Register Device
            </Button>
          </>
        }
      >
        <div
          className={
            styles.registrationMethods
          }
        >
          <button type="button">
            <KeyRound size={20} />

            <strong>
              Enter Serial Number
            </strong>

            <span>
              Register using the device
              serial.
            </span>
          </button>

          <button type="button">
            <QrCode size={20} />

            <strong>
              Scan QR Code
            </strong>

            <span>
              Register from a QR code.
            </span>
          </button>
        </div>

        <div className={styles.form}>
          <label>
            Device type

            <select defaultValue="station">
              <option value="station">
                Station
              </option>

              <option value="gateway">
                Gateway
              </option>

              <option value="sensor">
                Sensor
              </option>
            </select>
          </label>

          <label>
            Serial number

            <input placeholder="e.g. AGW-GL-006" />
          </label>

          <label>
            Farm

            <select>
              <option>
                Select farm
              </option>

              {farms.map((farm) => (
                <option
                  key={farm.id}
                  value={farm.id}
                >
                  {farm.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(
          rotateGateway,
        )}
        onClose={() =>
          setRotateGateway(null)
        }
        onConfirm={() =>
          setRotateGateway(null)
        }
        title={`Rotate credential for ${
          rotateGateway ?? ""
        }?`}
        description="The current gateway secret will be replaced and the operation will be recorded in the audit log."
        confirmText="Rotate Secret"
        variant="warning"
      />
    </div>
  );
}