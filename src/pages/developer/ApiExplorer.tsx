import {
  ChevronDown,
  Clock3,
  Copy,
  KeyRound,
  Play,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import styles from "./ApiExplorer.module.css";

interface EndpointOption {
  value: string;
  label: string;
  method: "GET";
}

const endpointOptions: EndpointOption[] = [
  {
    value: "/api/v1/health",
    label: "Health Check",
    method: "GET",
  },
  {
    value: "/api/v1/stations",
    label: "List Stations",
    method: "GET",
  },
  {
    value: "/api/v1/data/latest",
    label: "Latest Data",
    method: "GET",
  },
  {
    value: "/api/v1/data/history",
    label: "Historical Data",
    method: "GET",
  },
];

export default function ApiExplorer() {
  const [endpoint, setEndpoint] = useState("/api/v1/data/latest");
  const [apiKey, setApiKey] = useState("");
  const [station, setStation] = useState("NODE01");
  const [fields, setFields] = useState("moisture,temperature,ph");
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const handleSend = () => {
    const started = performance.now();

    const mockResponse = {
      data: {
        stationId: station,
        sensorId: "SOIL-NPK-20CM",
        measuredAt: "2026-08-21T02:15:30.125Z",
        fields: fields.split(",").map((field) => field.trim()),
        telemetry: {
          moisture: {
            value: 43,
            unit: "percent",
            quality: "good",
          },
          temperature: {
            value: 28.7,
            unit: "degC",
            quality: "good",
          },
          ph: {
            value: 6.5,
            unit: "pH",
            quality: "good",
          },
        },
      },
    };

    setResponse(JSON.stringify(mockResponse, null, 2));
    setStatus(200);
    setResponseTime(Math.round(performance.now() - started + 120));
  };

  const selected = endpointOptions.find((item) => item.value === endpoint);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>DEVELOPER PORTAL / TESTING</div>
          <h1>API Explorer</h1>
          <p>Build and inspect API requests before integrating your client.</p>
        </div>
      </div>

      <section className={styles.workspace}>
        <div className={styles.requestPanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Request</h2>
              <p>Swagger/Postman-inspired request builder.</p>
            </div>

            <button
              className={styles.resetButton}
              onClick={() => {
                setApiKey("");
                setStation("NODE01");
                setFields("moisture,temperature,ph");
                setResponse("");
                setStatus(null);
                setResponseTime(null);
              }}
            >
              <RotateCcw size={15} />
              Reset
            </button>
          </div>

          <label className={styles.field}>
            <span>Endpoint</span>
            <div className={styles.endpointSelect}>
              <select
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
              >
                {endpointOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} — {option.value}
                  </option>
                ))}
              </select>

              <ChevronDown size={16} />
            </div>
          </label>

          <div className={styles.urlRow}>
            <span className={styles.method}>GET</span>
            <code>/api/v1{endpoint.replace("/api/v1", "")}</code>
          </div>

          <label className={styles.field}>
            <span>X-API-Key</span>
            <div className={styles.inputWithIcon}>
              <KeyRound size={16} />
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Enter API key"
              />
            </div>
          </label>

          <div className={styles.parameters}>
            <div className={styles.subHeader}>
              <h3>Query Parameters</h3>
              <span>Optional</span>
            </div>

            <label className={styles.field}>
              <span>station</span>
              <input
                value={station}
                onChange={(event) => setStation(event.target.value)}
                placeholder="NODE01"
              />
            </label>

            <label className={styles.field}>
              <span>fields</span>
              <input
                value={fields}
                onChange={(event) => setFields(event.target.value)}
                placeholder="moisture,temperature,ph"
              />
            </label>
          </div>

          <button className={styles.sendButton} onClick={handleSend}>
            <Play size={16} />
            Send Request
          </button>

          <div className={styles.securityNote}>
            API requests are simulated locally. No production request is sent
            by this page.
          </div>
        </div>

        <div className={styles.responsePanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Response</h2>
              <p>Response body and request metadata.</p>
            </div>

            {status !== null && (
              <div className={styles.responseMeta}>
                <span className={styles.status}>{status}</span>

                <span>
                  <Clock3 size={14} />
                  {responseTime} ms
                </span>
              </div>
            )}
          </div>

          <div className={styles.responseToolbar}>
            <span>application/json</span>

            {response && (
              <button
                onClick={() =>
                  void navigator.clipboard?.writeText(response)
                }
              >
                <Copy size={14} />
                Copy
              </button>
            )}
          </div>

          <div className={styles.responseBody}>
            {response ? (
              <pre>{response}</pre>
            ) : (
              <div className={styles.placeholder}>
                <div>
                  <Play size={22} />
                </div>
                <strong>No response yet</strong>
                <span>Configure the request and select Send Request.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.contractNotice}>
        <strong>API contract status</strong>
        <span>
          Endpoint names and authentication requirements follow the SRS.
          Detailed production request/response contracts and Explorer
          transport behavior are <b>CHƯA XÁC NHẬN</b>.
        </span>
      </section>

      {selected && (
        <div className={styles.endpointHint}>
          <strong>{selected.label}</strong>
          <code>{selected.method} {selected.value}</code>
        </div>
      )}
    </div>
  );
}