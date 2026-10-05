import { useCallback, useEffect, useRef, useState } from "react";

import { dataSourceService, type DataSource } from "@/services/dataSourceService";
import { normalizeApiError } from "@/utils/apiError";
import { refreshSourceConnections } from "@/utils/sourceConnectionRefresh";

export function useApiSources() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState<Record<string, "CHECKING" | "VERIFIED" | "UNVERIFIED">>({});
  const generation = useRef(0);

  const markChecked = (id: string) => setChecks((current) => ({ ...current, [id]: "VERIFIED" }));

  const loadSources = useCallback(async () => {
    const request = ++generation.current;
    const isCurrent = () => generation.current === request;
    setRefreshing(true);
    setError("");
    setChecks((current) => Object.fromEntries(Object.keys(current).map((id) => [id, "CHECKING"])));
    try {
      const page = await dataSourceService.list();
      if (!isCurrent()) return;
      setSources(page.items);
      setChecks(Object.fromEntries(page.items.map((source) => [source.id, "CHECKING"])));
      setLoading(false);
      await refreshSourceConnections(page.items.map((source) => source.id), dataSourceService.checkConnectionStatus, (id, result) => {
        if (result) setSources((current) => current.map((source) => source.id === id && result.lastCheckedAt >= source.lastCheckedAt
          ? { ...source, connectionStatus: result.connectionStatus, lastCheckedAt: result.lastCheckedAt }
          : source));
        setChecks((current) => ({ ...current, [id]: result ? "VERIFIED" : "UNVERIFIED" }));
      }, isCurrent);
    } catch (reason) {
      if (isCurrent()) {
        setSources([]);
        setChecks({});
        setError(normalizeApiError(reason).message);
      }
    } finally {
      if (isCurrent()) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void loadSources(); });
    return () => { active = false; generation.current += 1; };
  }, [loadSources]);

  return { sources, setSources, loading, refreshing, error, setError, checks, markChecked, loadSources };
}
