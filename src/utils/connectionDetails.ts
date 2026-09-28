export interface ConnectionDetails {
  baseUrl: string;
  xApiKey: string;
}

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const KEY_PATTERN = /x-api-key\s*(?::|=)\s*["']?([^\s"'&,}]+)/gi;

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function jsonCandidates(text: string): { urls: string[]; keys: string[] } {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    const urls = [value.baseUrl, value.apiUrl, value.url].filter(
      (item): item is string => typeof item === "string",
    );
    const keys = [value.xApiKey, value.apiKey, value["X-API-Key"]].filter(
      (item): item is string => typeof item === "string",
    );
    return { urls, keys };
  } catch {
    return { urls: [], keys: [] };
  }
}

function normalizeBaseUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Enter a safe HTTPS API base URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.hostname
  ) {
    throw new Error("Enter a safe HTTPS API base URL without credentials, query parameters or a hash.");
  }
  return url.toString().replace(/\/$/, "");
}

export function parseConnectionDetails(text: string): ConnectionDetails {
  const json = jsonCandidates(text.trim());
  const urls = unique([...json.urls, ...(text.match(URL_PATTERN) ?? [])]);
  const keys = unique([
    ...json.keys,
    ...Array.from(text.matchAll(KEY_PATTERN), (match) => match[1] ?? ""),
  ]);

  if (urls.length === 0 || keys.length === 0) {
    throw new Error("API URL or X-API-Key not found.");
  }
  if (urls.length !== 1 || keys.length !== 1) {
    throw new Error("Connection details are ambiguous. Keep one API URL and one X-API-Key.");
  }
  return { baseUrl: normalizeBaseUrl(urls[0]), xApiKey: keys[0] };
}
