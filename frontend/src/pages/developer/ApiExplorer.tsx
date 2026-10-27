import { ChevronDown, Clock3, Copy, KeyRound, Play, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { env } from "@/config/env";
import {
  buildExplorerRequest,
  createDeveloperExplorerService,
  nextExplorerRequest,
  type ExplorerEndpoint,
  type ExplorerInput,
  type ExplorerRequest,
  type ExplorerResponse,
} from "@/services/developerExplorerService";
import { copyText } from "@/utils/credentialInput";
import DeveloperSectionTabs from "@/components/developer/DeveloperSectionTabs";
import styles from "./ApiExplorer.module.css";

const endpointOptions: Array<{ value: ExplorerEndpoint; label: string; path: string }> = [
  { value: "health", label: "Health Check", path: "/api/v1/health" },
  { value: "stations", label: "List Stations", path: "/api/v1/client/stations" },
  { value: "latest", label: "Latest Data", path: "/api/v1/client/data/latest" },
  { value: "history", label: "Historical Data", path: "/api/v1/client/data/history" },
];

function defaultUtcInput(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

export default function ApiExplorer() {
  const [endpoint, setEndpoint] = useState<ExplorerEndpoint>("latest");
  const [apiKey, setApiKey] = useState("");
  const [input, setInput] = useState<ExplorerInput>({
    station: "", fields: "moisture,temperature,ph", begin: defaultUtcInput(-1), end: defaultUtcInput(),
    interval: "raw", aggregate: "", order: "asc", limit: "100", cursor: "",
  });
  const [request, setRequest] = useState<ExplorerRequest | null>(null);
  const [result, setResult] = useState<ExplorerResponse | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const service = useMemo(() => createDeveloperExplorerService(env.apiBaseUrl), []);
  const selected = endpointOptions.find((item) => item.value === endpoint) ?? endpointOptions[0];

  const setField = (name: string, value: string) => setInput((current) => ({ ...current, [name]: value }));
  const send = async (nextRequest?: ExplorerRequest) => {
    setIsLoading(true); setCopyStatus("idle"); setResult(null); setResponseTime(null);
    const started = performance.now();
    try {
      const built = nextRequest ?? buildExplorerRequest(endpoint, input);
      setRequest(built);
      setResult(await service.send(built, apiKey));
    } catch (reason) {
      setResult({ status: 0, ok: false, body: { success: false, error: { code: "CLIENT_VALIDATION", message: reason instanceof Error ? reason.message : "Request failed" } }, headers: {} });
    } finally { setResponseTime(Math.round(performance.now() - started)); setIsLoading(false); }
  };
  const next = request && result ? nextExplorerRequest(request, result.body) : null;
  const responseText = result ? JSON.stringify(result.body, null, 2) : "";

  const reset = () => {
    setEndpoint("latest"); setApiKey(""); setInput({ station: "", fields: "moisture,temperature,ph", begin: defaultUtcInput(-1), end: defaultUtcInput(), interval: "raw", aggregate: "", order: "asc", limit: "100", cursor: "" });
    setRequest(null); setResult(null); setResponseTime(null); setCopyStatus("idle");
  };

  return <div className={styles.page}>
    <div className={styles.header}><div><div className={styles.eyebrow}>DEVELOPER PORTAL / TESTING</div><h1>API Explorer</h1><p>Build a contract-valid request and inspect the exact response envelope.</p></div></div>
    <DeveloperSectionTabs section="tools" />
    <section className={styles.workspace}>
      <div className={styles.requestPanel}><div className={styles.panelHeader}><div><h2>Request</h2><p>The API key stays in memory for this page only.</p></div><button className={styles.resetButton} onClick={reset} disabled={isLoading}><RotateCcw size={15} />Reset</button></div>
        <label className={styles.field}><span>Endpoint</span><div className={styles.endpointSelect}><select value={endpoint} onChange={(event) => { setEndpoint(event.target.value as ExplorerEndpoint); setRequest(null); setResult(null); }} disabled={isLoading}>{endpointOptions.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.path}</option>)}</select><ChevronDown size={16} /></div></label>
        <div className={styles.urlRow}><span className={styles.method}>GET</span><code>{selected.path}</code></div>
        {endpoint !== "health" && <label className={styles.field}><span>X-API-Key</span><div className={styles.inputWithIcon}><KeyRound size={16} /><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Enter API key" disabled={isLoading} /></div></label>}
        <div className={styles.parameters}><div className={styles.subHeader}><h3>Query Parameters</h3><span>{endpoint === "health" ? "None" : "Contract bounded"}</span></div>
          {(endpoint === "latest" || endpoint === "history") && <><label className={styles.field}><span>station *</span><input value={input.station ?? ""} onChange={(event) => setField("station", event.target.value)} placeholder="Enter station code" disabled={isLoading} /></label><label className={styles.field}><span>fields</span><input value={input.fields ?? ""} onChange={(event) => setField("fields", event.target.value)} placeholder="moisture,temperature,ph" disabled={isLoading} /></label></>}
          {endpoint === "stations" && <><label className={styles.field}><span>limit (1–100)</span><input type="number" min="1" max="100" value={input.limit ?? ""} onChange={(event) => setField("limit", event.target.value)} disabled={isLoading} /></label><label className={styles.field}><span>cursor</span><input value={input.cursor ?? ""} onChange={(event) => setField("cursor", event.target.value)} disabled={isLoading} /></label></>}
          {endpoint === "history" && <><label className={styles.field}><span>begin (UTC)</span><input type="datetime-local" value={input.begin ?? ""} onChange={(event) => setField("begin", event.target.value)} disabled={isLoading} /></label><label className={styles.field}><span>end (UTC)</span><input type="datetime-local" value={input.end ?? ""} onChange={(event) => setField("end", event.target.value)} disabled={isLoading} /></label><label className={styles.field}><span>interval</span><select value={input.interval ?? "raw"} onChange={(event) => { setField("interval", event.target.value); if (event.target.value === "raw") setField("aggregate", ""); }} disabled={isLoading}>{["raw", "5m", "30m", "1h", "1d"].map((value) => <option key={value}>{value}</option>)}</select></label>{input.interval !== "raw" && <label className={styles.field}><span>aggregate *</span><select value={input.aggregate ?? ""} onChange={(event) => setField("aggregate", event.target.value)} disabled={isLoading}><option value="">Select</option>{["mean", "min", "max", "first", "last"].map((value) => <option key={value}>{value}</option>)}</select></label>}<label className={styles.field}><span>order</span><select value={input.order ?? "asc"} onChange={(event) => setField("order", event.target.value)} disabled={isLoading}><option value="asc">asc</option><option value="desc">desc</option></select></label><label className={styles.field}><span>limit (1–500)</span><input type="number" min="1" max="500" value={input.limit ?? ""} onChange={(event) => setField("limit", event.target.value)} disabled={isLoading} /></label><label className={styles.field}><span>cursor</span><input value={input.cursor ?? ""} onChange={(event) => setField("cursor", event.target.value)} disabled={isLoading} /></label></>}
        </div>
        <button className={styles.sendButton} onClick={() => void send()} disabled={isLoading}><Play size={16} />{isLoading ? "Sending…" : "Send Request"}</button>
        <div className={styles.securityNote}>Requests go directly to the configured Client Developer API. The secret is never copied into the response or local storage.</div>
      </div>
      <div className={styles.responsePanel}><div className={styles.panelHeader}><div><h2>Response</h2><p>Status, rate-limit headers and body.</p></div>{result && <div className={styles.responseMeta}><span className={styles.status}>{result.status || "Client"}</span><span><Clock3 size={14} />{responseTime} ms</span></div>}</div>
        <div className={styles.responseToolbar}><span>{request?.path ?? "application/json"}</span>{responseText && <button onClick={async () => setCopyStatus(await copyText(responseText) ? "copied" : "failed")}><Copy size={14} />{copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Select manually" : "Copy"}</button>}</div>
        {result && Object.keys(result.headers).length > 0 && <div className={styles.securityNote}>{Object.entries(result.headers).map(([name, value]) => `${name}: ${value}`).join(" · ")}</div>}
        <div className={styles.responseBody}>{responseText ? <pre>{responseText}</pre> : <div className={styles.placeholder}><div><Play size={22} /></div><strong>No response yet</strong><span>Configure the request and select Send Request.</span></div>}</div>
        {next && <button className={styles.sendButton} onClick={() => void send(next)} disabled={isLoading}>Load next page</button>}
      </div>
    </section>
    <section className={styles.contractNotice}><strong>API contract status</strong><span>Health is public. Stations, latest data and bounded history require X-API-Key and apply backend validation unchanged.</span></section>
  </div>;
}
