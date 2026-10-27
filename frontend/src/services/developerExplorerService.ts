export type ExplorerEndpoint = "health" | "stations" | "latest" | "history";

export type ExplorerInput = Readonly<Record<string, string | undefined>>;

export type ExplorerRequest = Readonly<{
  endpoint: ExplorerEndpoint;
  path: string;
  input: ExplorerInput;
  requiresApiKey: boolean;
}>;

export type ExplorerResponse = Readonly<{
  status: number;
  ok: boolean;
  body: unknown;
  headers: Readonly<Record<string, string>>;
}>;

const SOIL_FIELDS = new Set([
  "temperature", "moisture", "ec", "ph", "nitrogen", "phosphorus", "potassium", "light",
]);
const INTERVALS = new Set(["raw", "5m", "30m", "1h", "1d"]);
const AGGREGATES = new Set(["mean", "min", "max", "first", "last"]);
const ORDERS = new Set(["asc", "desc"]);
const STATION_CODE = /^[A-Za-z0-9_-]{1,64}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseBoundedInteger(value: string | undefined, name: string, maximum: number): string | undefined {
  const text = optionalText(value);
  if (text === undefined) return undefined;
  if (!/^\d+$/.test(text)) throw new Error(`${name} must be a whole number`);
  const parsed = Number(text);
  if (parsed < 1 || parsed > maximum) throw new Error(`${name} must be between 1 and ${maximum}`);
  return String(parsed);
}

function parseCursor(value: string | undefined): string | undefined {
  const cursor = optionalText(value);
  if (cursor && cursor.length > 2048) throw new Error("cursor must not exceed 2048 characters");
  return cursor;
}

function parseStation(value: string | undefined): string {
  const station = optionalText(value);
  if (!station || !STATION_CODE.test(station)) throw new Error("station code is required and invalid");
  return station;
}

function parseFields(value: string | undefined): string | undefined {
  const fields = optionalText(value);
  if (fields === undefined) return undefined;
  const items = fields.split(",");
  if (
    items.length === 0 ||
    items.some((item) => item.length === 0 || item !== item.trim() || !SOIL_FIELDS.has(item)) ||
    new Set(items).size !== items.length
  ) {
    throw new Error("fields must be a unique comma-separated list of supported soil fields");
  }
  return items.join(",");
}

function withQuery(path: string, query: URLSearchParams): string {
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export function utcInputToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("UTC date/time must use YYYY-MM-DDTHH:mm");
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day ||
    date.getUTCHours() !== hour || date.getUTCMinutes() !== minute
  ) {
    throw new Error("UTC date/time is invalid");
  }
  return date.toISOString();
}

export function buildExplorerRequest(endpoint: ExplorerEndpoint, input: ExplorerInput): ExplorerRequest {
  const query = new URLSearchParams();
  if (endpoint === "health") {
    return { endpoint, path: "/health", input: {}, requiresApiKey: false };
  }
  if (endpoint === "stations") {
    const limit = parseBoundedInteger(input.limit, "limit", 100);
    const cursor = parseCursor(input.cursor);
    if (limit) query.set("limit", limit);
    if (cursor) query.set("cursor", cursor);
    return { endpoint, path: withQuery("/client/stations", query), input: { limit, cursor }, requiresApiKey: true };
  }

  const station = parseStation(input.station);
  const fields = parseFields(input.fields);
  query.set("station", station);
  if (fields) query.set("fields", fields);
  if (endpoint === "latest") {
    return { endpoint, path: withQuery("/client/data/latest", query), input: { station, fields }, requiresApiKey: true };
  }

  const begin = utcInputToIso(input.begin ?? "");
  const end = utcInputToIso(input.end ?? "");
  const beginTime = Date.parse(begin);
  const endTime = Date.parse(end);
  if (endTime < beginTime) throw new Error("end must be at or after begin");
  const interval = optionalText(input.interval) ?? "raw";
  const aggregate = optionalText(input.aggregate);
  const order = optionalText(input.order) ?? "asc";
  if (!INTERVALS.has(interval)) throw new Error("interval is invalid");
  if (!ORDERS.has(order)) throw new Error("order is invalid");
  if (interval === "raw" && aggregate) throw new Error("raw interval rejects aggregate");
  if (interval !== "raw" && (!aggregate || !AGGREGATES.has(aggregate))) {
    throw new Error("aggregate is required and must be supported for a non-raw interval");
  }
  const maximumDays = interval === "raw" ? 7 : 90;
  if (endTime - beginTime > maximumDays * DAY_MS) throw new Error(`history range cannot exceed ${maximumDays} days`);
  const limit = parseBoundedInteger(input.limit, "limit", 500);
  const cursor = parseCursor(input.cursor);
  query.set("begin", begin);
  query.set("end", end);
  query.set("interval", interval);
  if (aggregate) query.set("aggregate", aggregate);
  query.set("order", order);
  if (limit) query.set("limit", limit);
  if (cursor) query.set("cursor", cursor);
  return {
    endpoint,
    path: withQuery("/client/data/history", query),
    input: { station, fields, begin: input.begin, end: input.end, interval, aggregate, order, limit, cursor },
    requiresApiKey: true,
  };
}

function readNextCursor(body: unknown): string | null {
  if (!body || typeof body !== "object" || (body as { success?: unknown }).success !== true) return null;
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const direct = (data as { nextCursor?: unknown }).nextCursor;
  const page = (data as { page?: unknown }).page;
  const nested = page && typeof page === "object" ? (page as { nextCursor?: unknown }).nextCursor : undefined;
  const cursor = nested ?? direct;
  return typeof cursor === "string" && cursor.length > 0 && cursor.length <= 2048 ? cursor : null;
}

export function nextExplorerRequest(request: ExplorerRequest, body: unknown): ExplorerRequest | null {
  const cursor = readNextCursor(body);
  return cursor ? buildExplorerRequest(request.endpoint, { ...request.input, cursor }) : null;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function createDeveloperExplorerService(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return {
    async send(request: ExplorerRequest, rawApiKey: string): Promise<ExplorerResponse> {
      const apiKey = rawApiKey.trim();
      if (request.requiresApiKey && !apiKey) throw new Error("API key is required");
      const headers = new Headers({ Accept: "application/json" });
      if (request.requiresApiKey) headers.set("X-API-Key", apiKey);
      const response = await fetch(`${normalizedBaseUrl}${request.path}`, { method: "GET", headers });
      const selectedHeaders: Record<string, string> = {};
      for (const name of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "retry-after"]) {
        const value = response.headers.get(name);
        if (value !== null) selectedHeaders[name] = value;
      }
      return { status: response.status, ok: response.ok, body: await parseResponseBody(response), headers: selectedHeaders };
    },
  };
}
