import type { DataSource } from "../services/dataSourceService.ts";

export function dataSourceDisplayName(source: Pick<DataSource, "name" | "baseUrl">): string {
  try {
    const hostname = new URL(source.baseUrl).hostname;
    const prefix = `${hostname} — `;
    // Legacy generated names contain a creation-time count, not current inventory.
    if (source.name.startsWith(prefix) && /^\d+ soil stations?$/.test(source.name.slice(prefix.length))) {
      return hostname;
    }
  } catch {
    // Keep the saved label if the URL cannot identify a generated name.
  }
  return source.name;
}
