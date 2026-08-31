import {
  BookOpen,
  ChevronRight,
  Copy,
  ExternalLink,
  FileJson,
  LockKeyhole,
} from "lucide-react";
import { useState } from "react";
import styles from "./ApiDocs.module.css";

interface Endpoint {
  id: string;
  method: "GET";
  path: string;
  title: string;
  description: string;
  auth: boolean;
  parameters: string[];
}

const endpoints: Endpoint[] = [
  {
    id: "health",
    method: "GET",
    path: "/api/v1/health",
    title: "Health Check",
    description: "Check API service availability.",
    auth: false,
    parameters: [],
  },
  {
    id: "stations",
    method: "GET",
    path: "/api/v1/stations",
    title: "List Stations",
    description: "Return stations available to the API key.",
    auth: true,
    parameters: ["status", "farmId"],
  },
  {
    id: "latest",
    method: "GET",
    path: "/api/v1/data/latest",
    title: "Latest Data",
    description: "Retrieve the latest telemetry for authorized stations.",
    auth: true,
    parameters: ["station", "type", "fields"],
  },
  {
    id: "history",
    method: "GET",
    path: "/api/v1/data/history",
    title: "Historical Data",
    description: "Retrieve historical telemetry and supported aggregates.",
    auth: true,
    parameters: [
      "station",
      "type",
      "fields",
      "begin",
      "end",
      "interval",
      "aggregate",
    ],
  },
];

const responseExamples: Record<string, string> = {
  health: `{
  "status": "ok",
  "service": "iot-api",
  "version": "1.0"
}`,
  stations: `{
  "data": [
    {
      "stationId": "NODE01",
      "name": "North Field Station",
      "status": "online"
    }
  ]
}`,
  latest: `{
  "data": {
    "stationId": "NODE01",
    "sensorId": "SOIL-NPK-20CM",
    "measuredAt": "2026-08-21T02:15:30.125Z",
    "moisture": {
      "value": 43,
      "unit": "percent",
      "quality": "good"
    }
  }
}`,
  history: `{
  "data": [
    {
      "timestamp": "2026-08-21T02:15:30.125Z",
      "value": 43,
      "unit": "percent",
      "quality": "good"
    }
  ]
}`,
};

export default function ApiDocs() {
  const [selectedId, setSelectedId] = useState("health");

  const selected =
    endpoints.find((endpoint) => endpoint.id === selectedId) ?? endpoints[0];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>DEVELOPER PORTAL / REFERENCE</div>
          <h1>API Documentation</h1>
          <p>
            Weather API v1 compatible endpoints for authorized client
            integrations.
          </p>
        </div>

        <button className={styles.externalButton}>
          <ExternalLink size={16} />
          API Reference
        </button>
      </div>

      <div className={styles.docsLayout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>
            <BookOpen size={16} />
            Endpoints
          </div>

          {endpoints.map((endpoint) => (
            <button
              key={endpoint.id}
              className={`${styles.endpointButton} ${
                selected.id === endpoint.id ? styles.selected : ""
              }`}
              onClick={() => setSelectedId(endpoint.id)}
            >
              <div>
                <span className={styles.method}>GET</span>
                <strong>{endpoint.title}</strong>
                <code>{endpoint.path}</code>
              </div>
              <ChevronRight size={15} />
            </button>
          ))}
        </aside>

        <main className={styles.documentation}>
          <div className={styles.endpointHeader}>
            <div className={styles.endpointMethod}>GET</div>
            <code>{selected.path}</code>
          </div>

          <h2>{selected.title}</h2>
          <p className={styles.description}>{selected.description}</p>

          <section className={styles.section}>
            <h3>Authentication</h3>

            <div className={styles.authBox}>
              {selected.auth ? (
                <>
                  <LockKeyhole size={17} />
                  <div>
                    <strong>X-API-Key required</strong>
                    <span>
                      Requests must include a valid API key with station
                      authorization.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <FileJson size={17} />
                  <div>
                    <strong>No authentication required</strong>
                    <span>
                      This endpoint is available for service health checks.
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <h3>Parameters</h3>

            {selected.parameters.length === 0 ? (
              <div className={styles.empty}>No query parameters.</div>
            ) : (
              <div className={styles.parameterTable}>
                <div className={styles.parameterHead}>
                  <span>Name</span>
                  <span>Type</span>
                  <span>Description</span>
                </div>

                {selected.parameters.map((parameter) => (
                  <div className={styles.parameterRow} key={parameter}>
                    <code>{parameter}</code>
                    <span>string</span>
                    <span>See API contract for endpoint-specific behavior.</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h3>Request Headers</h3>

            <div className={styles.codeBlock}>
              <button
                onClick={() =>
                  void navigator.clipboard?.writeText(
                    "X-API-Key: YOUR_API_KEY",
                  )
                }
              >
                <Copy size={15} />
              </button>

              <pre>
                <code>
                  {selected.auth
                    ? "X-API-Key: YOUR_API_KEY\nAccept: application/json"
                    : "Accept: application/json"}
                </code>
              </pre>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Example Response</h3>

            <div className={styles.codeBlock}>
              <button
                onClick={() =>
                  void navigator.clipboard?.writeText(
                    responseExamples[selected.id],
                  )
                }
              >
                <Copy size={15} />
              </button>

              <pre>
                <code>{responseExamples[selected.id]}</code>
              </pre>
            </div>
          </section>
        </main>
      </div>

      <div className={styles.notice}>
        <strong>Contract status:</strong>
        <span>
          Endpoint names and authentication requirements are based on the SRS.
          Detailed production request/response schemas are{" "}
          <b>CHƯA XÁC NHẬN</b>.
        </span>
      </div>
    </div>
  );
}