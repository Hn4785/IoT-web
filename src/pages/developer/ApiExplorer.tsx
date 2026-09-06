import {
  ChevronDown,
  Clock3,
  Copy,
  KeyRound,
  Play,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";

import { clientHealthService } from "@/services/clientHealthService";
import { clientStationService } from "@/services/clientStationService";
import { telemetryService } from "@/services/telemetryService";

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

  const [isLoading, setIsLoading] = useState(false);

  const selected = endpointOptions.find(
    (item) => item.value === endpoint
  );

  const handleSend = async () => {
    if (!apiKey.trim()) {
      setResponse(
        JSON.stringify(
          {
            error: "API key is required.",
          },
          null,
          2
        )
      );

      setStatus(null);
      setResponseTime(null);

      return;
    }

    const started = performance.now();

    setIsLoading(true);
    setResponse("");
    setStatus(null);
    setResponseTime(null);

    try {
      let result: unknown;

      switch (endpoint) {
        case "/api/v1/health":
          result = await clientHealthService.getHealth(apiKey);
          break;

        case "/api/v1/stations":
          result = await clientStationService.getStations(apiKey);
          break;

        case "/api/v1/data/latest":
          result = await telemetryService.getLatestData(
            apiKey,
            {
              stationId: station || undefined,
              metric: fields || undefined,
            }
          );
          break;

        case "/api/v1/data/history":
          result = await telemetryService.getHistoryData(
            apiKey,
            {
              stationId: station || undefined,
              metric: fields || undefined,
            }
          );
          break;

        default:
          throw new Error("Unsupported endpoint.");
      }

      setResponse(JSON.stringify(result, null, 2));
      setStatus(200);
    } catch (error) {
      let errorStatus: number | null = null;
      let errorData: unknown = {
        error: "Request failed.",
      };

      if (
        typeof error === "object" &&
        error !== null &&
        "response" in error
      ) {
        const axiosError = error as {
          response?: {
            status?: number;
            data?: unknown;
          };
        };

        errorStatus = axiosError.response?.status ?? null;

        errorData =
          axiosError.response?.data ?? {
            error: "Request failed.",
          };
      } else if (error instanceof Error) {
        errorData = {
          error: error.message,
        };
      }

      setResponse(JSON.stringify(errorData, null, 2));
      setStatus(errorStatus);
    } finally {
      setResponseTime(
        Math.round(performance.now() - started)
      );

      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setApiKey("");
    setStation("NODE01");
    setFields("moisture,temperature,ph");

    setResponse("");
    setStatus(null);
    setResponseTime(null);
    setIsLoading(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>DEVELOPER PORTAL / TESTING</div>

          <h1>API Explorer</h1>

          <p>
            Build and inspect API requests before integrating your client.
          </p>
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
              onClick={handleReset}
              disabled={isLoading}
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
                onChange={(event) =>
                  setEndpoint(event.target.value)
                }
                disabled={isLoading}
              >
                {endpointOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
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
                onChange={(event) =>
                  setApiKey(event.target.value)
                }
                placeholder="Enter API key"
                disabled={isLoading}
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
                onChange={(event) =>
                  setStation(event.target.value)
                }
                placeholder="NODE01"
                disabled={isLoading}
              />
            </label>

            <label className={styles.field}>
              <span>fields / metric</span>

              <input
                value={fields}
                onChange={(event) =>
                  setFields(event.target.value)
                }
                placeholder="moisture,temperature,ph"
                disabled={isLoading}
              />
            </label>
          </div>

          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={isLoading}
          >
            <Play size={16} />

            {isLoading ? "Sending..." : "Send Request"}
          </button>

          <div className={styles.securityNote}>
            Requests are sent directly to the configured Client Developer API.
            Your API key is used only for the current request.
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
                <span className={styles.status}>
                  {status}
                </span>

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

                <span>
                  Configure the request and select Send Request.
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.contractNotice}>
        <strong>API contract status</strong>

        <span>
          Endpoint names and authentication requirements follow the SRS.
          Detailed production request/response contracts are still subject to
          Backend API specification.
        </span>
      </section>

      {selected && (
        <div className={styles.endpointHint}>
          <strong>{selected.label}</strong>

          <code>
            {selected.method} {selected.value}
          </code>
        </div>
      )}
    </div>
  );
}