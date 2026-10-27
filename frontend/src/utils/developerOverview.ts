import type { AvailableApiKeyStation, DeveloperApiKey } from "../services/apiKeyService.ts";

export function getApiKeyStatus(
  key: Pick<DeveloperApiKey, "expiresAt" | "revokedAt">,
  now = Date.now(),
): "active" | "expired" | "revoked" {
  if (key.revokedAt) return "revoked";
  const expiresAt = Date.parse(key.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now ? "active" : "expired";
}

export function getGrantedKeyStations(
  key: Pick<DeveloperApiKey, "stationIds">,
  availableStations: readonly AvailableApiKeyStation[],
): AvailableApiKeyStation[] {
  const scopedIds = new Set(key.stationIds);
  const seen = new Set<string>();
  return availableStations.filter((station) => {
    if (!scopedIds.has(station.id) || seen.has(station.id)) return false;
    seen.add(station.id);
    return true;
  });
}

export function summarizeDeveloperAccess(
  keys: readonly DeveloperApiKey[],
  availableStations: readonly AvailableApiKeyStation[],
  now = Date.now(),
) {
  const statuses = keys.map((key) => getApiKeyStatus(key, now));
  const coveredIds = new Set(
    keys
      .filter((_key, index) => statuses[index] === "active")
      .flatMap((key) => getGrantedKeyStations(key, availableStations).map((station) => station.id)),
  );
  return {
    loaded: keys.length,
    active: statuses.filter((status) => status === "active").length,
    expired: statuses.filter((status) => status === "expired").length,
    revoked: statuses.filter((status) => status === "revoked").length,
    availableStations: new Set(availableStations.map((station) => station.id)).size,
    coveredStations: coveredIds.size,
  };
}
