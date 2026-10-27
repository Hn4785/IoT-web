import type { BrowserFarm, BrowserPlot, BrowserStation } from "../services/stationBrowserService.ts";
import type { CursorPage } from "../types/api.ts";
import { normalizeApiError } from "./apiError.ts";

export interface ScopeUser {
  id?: string;
  role?: string;
  assignedFarmIds?: string[];
  assignedPlotIds?: string[];
  assignedStationIds?: string[];
}

export interface HierarchyState {
  farms: BrowserFarm[];
  plots: BrowserPlot[];
  stations: BrowserStation[];
  selectedFarmId: string;
  selectedPlotId: string;
  selectedStationId: string;
  loading: boolean;
  error: string;
  scopeKey: string;
}

export interface HierarchyLoaderService {
  listFarms(cursor?: string): Promise<CursorPage<BrowserFarm>>;
  listPlots(farmId: string, cursor?: string): Promise<CursorPage<BrowserPlot>>;
  listStations(plotId: string, cursor?: string): Promise<CursorPage<BrowserStation>>;
}

export function buildHierarchyScopeKey(user: ScopeUser | null | undefined, apiBaseUrl: string): string {
  if (!user?.id) return `anon@${apiBaseUrl}`;
  const sortJoin = (ids?: string[]) => (ids ?? []).slice().sort().join(",");
  return `${user.id}:${user.role ?? ""}:${sortJoin(user.assignedFarmIds)}:${sortJoin(user.assignedPlotIds)}:${sortJoin(user.assignedStationIds)}@${apiBaseUrl}`;
}

export async function fetchAllPages<T>(fetchPage: (cursor?: string) => Promise<CursorPage<T>>, maxPages = 10, isCurrent = () => true): Promise<T[]> {
  const items: T[] = [], seen = new Set<string>();
  let cursor: string | undefined, count = 0;
  do {
    if (!isCurrent()) return [];
    count += 1;
    if (count > maxPages) throw new Error(`Hierarchy page budget exceeded (${maxPages} pages).`);
    const page = await fetchPage(cursor);
    if (!isCurrent()) return [];
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
    if (cursor) {
      if (seen.has(cursor)) throw new Error("Repeated pagination cursor detected.");
      seen.add(cursor);
    }
  } while (cursor);
  return items;
}

export function createInitialHierarchyState(scopeKey: string, loading = true): HierarchyState {
  return { farms: [], plots: [], stations: [], selectedFarmId: "", selectedPlotId: "", selectedStationId: "", loading, error: "", scopeKey };
}

export class StationHierarchyCoordinator {
  private service: HierarchyLoaderService;
  private scopeKey: string;
  private maxPages: number;
  private onStateChange?: (state: HierarchyState) => void;
  private state: HierarchyState;
  private activeRequestId = 0;
  private disposed = false;
  private reloadPreference?: { farmId?: string; plotId?: string; stationId?: string };

  constructor(opts: { service: HierarchyLoaderService; scopeKey: string; maxPages?: number; onStateChange?: (s: HierarchyState) => void }) {
    this.service = opts.service;
    this.scopeKey = opts.scopeKey;
    this.maxPages = opts.maxPages ?? 10;
    this.onStateChange = opts.onStateChange;
    this.state = createInitialHierarchyState(this.scopeKey, true);
  }

  getState(): HierarchyState { return this.state; }
  private isCurrent(requestId: number, scopeKey: string) {
    return !this.disposed && requestId === this.activeRequestId && scopeKey === this.scopeKey;
  }
  private update(fn: (prev: HierarchyState) => HierarchyState) {
    if (this.disposed) return;
    this.state = fn(this.state);
    this.onStateChange?.(this.state);
  }

  async initialize() { await this.loadFull(); }
  async reload() {
    if (this.state.selectedFarmId) this.reloadPreference = { farmId: this.state.selectedFarmId,
      plotId: this.state.selectedPlotId, stationId: this.state.selectedStationId };
    await this.loadFull(this.reloadPreference);
  }

  async setScopeKey(newScopeKey: string) {
    if (this.scopeKey === newScopeKey) return;
    this.scopeKey = newScopeKey;
    this.reloadPreference = undefined;
    this.activeRequestId += 1;
    this.update(() => createInitialHierarchyState(newScopeKey, true));
    await this.loadFull();
  }

  dispose() { this.disposed = true; this.activeRequestId += 1; }

  private async loadFull(pref?: { farmId?: string; plotId?: string; stationId?: string }) {
    const reqId = ++this.activeRequestId, curScope = this.scopeKey;
    this.update((p) => ({ ...p, loading: true, error: "", farms: [], plots: [], stations: [], selectedFarmId: "", selectedPlotId: "", selectedStationId: "", scopeKey: curScope }));
    try {
      const farms = await fetchAllPages((c) => this.service.listFarms(c), this.maxPages, () => this.isCurrent(reqId, curScope));
      if (this.disposed || reqId !== this.activeRequestId || curScope !== this.scopeKey) return;
      if (!farms.length) {
        this.update((p) => ({ ...p, farms: [], plots: [], stations: [], selectedFarmId: "", selectedPlotId: "", selectedStationId: "", loading: false, error: "" }));
        return;
      }
      const selectedFarmId = pref?.farmId && farms.some((f) => f.id === pref.farmId) ? pref.farmId : farms[0].id;
      this.update((p) => ({ ...p, farms, selectedFarmId }));
      await this.loadDescendants(selectedFarmId, reqId, curScope, pref?.plotId, pref?.stationId);
    } catch (err) {
      if (this.disposed || reqId !== this.activeRequestId || curScope !== this.scopeKey) return;
      this.update((p) => ({ ...p, farms: [], plots: [], stations: [], selectedFarmId: "", selectedPlotId: "", selectedStationId: "", loading: false, error: normalizeApiError(err).message }));
    }
  }

  private async loadDescendants(farmId: string, reqId: number, curScope: string, prefPlotId?: string, prefStationId?: string) {
    try {
      const plots = await fetchAllPages((c) => this.service.listPlots(farmId, c), this.maxPages, () => this.isCurrent(reqId, curScope));
      if (this.disposed || reqId !== this.activeRequestId || curScope !== this.scopeKey) return;
      if (plots.some(plot => plot.farmId !== farmId)) throw new Error("Plot response does not match the requested parent farm.");
      if (!plots.length) {
        this.update((p) => ({ ...p, plots: [], stations: [], selectedPlotId: "", selectedStationId: "", loading: false, error: "" }));
        return;
      }
      const selectedPlotId = prefPlotId && plots.some((pl) => pl.id === prefPlotId) ? prefPlotId : plots[0].id;
      this.update((p) => ({ ...p, plots, selectedPlotId }));
      const stations = await fetchAllPages((c) => this.service.listStations(selectedPlotId, c), this.maxPages, () => this.isCurrent(reqId, curScope));
      if (this.disposed || reqId !== this.activeRequestId || curScope !== this.scopeKey) return;
      if (stations.some(station => station.farmId !== farmId || station.plotId !== selectedPlotId)) throw new Error("Station response does not match the requested parent plot.");
      const selectedStationId = prefStationId && stations.some((s) => s.id === prefStationId) ? prefStationId : (stations[0]?.id ?? "");
      this.update((p) => ({ ...p, stations, selectedStationId, loading: false, error: "" }));
    } catch (err) {
      if (this.disposed || reqId !== this.activeRequestId || curScope !== this.scopeKey) return;
      this.update((p) => ({ ...p, plots: [], stations: [], selectedPlotId: "", selectedStationId: "", loading: false, error: normalizeApiError(err).message }));
    }
  }

  async selectFarm(farmId: string) {
    const reqId = ++this.activeRequestId, curScope = this.scopeKey;
    if (!farmId || !this.state.farms.some((f) => f.id === farmId)) {
      this.update((p) => ({ ...p, selectedFarmId: "", plots: [], stations: [], selectedPlotId: "", selectedStationId: "", loading: false, error: "" }));
      return;
    }
    this.update((p) => ({ ...p, selectedFarmId: farmId, plots: [], stations: [], selectedPlotId: "", selectedStationId: "", loading: true, error: "" }));
    await this.loadDescendants(farmId, reqId, curScope);
  }

  async selectPlot(plotId: string) {
    const reqId = ++this.activeRequestId, curScope = this.scopeKey;
    const farmId = this.state.selectedFarmId;
    if (!plotId || !this.state.plots.some((p) => p.id === plotId)) {
      this.update((p) => ({ ...p, selectedPlotId: "", stations: [], selectedStationId: "", loading: false, error: "" }));
      return;
    }
    this.update((p) => ({ ...p, selectedPlotId: plotId, stations: [], selectedStationId: "", loading: true, error: "" }));
    try {
      const stations = await fetchAllPages((c) => this.service.listStations(plotId, c), this.maxPages, () => this.isCurrent(reqId, curScope));
      if (this.disposed || reqId !== this.activeRequestId || curScope !== this.scopeKey) return;
      if (stations.some(station => station.farmId !== farmId || station.plotId !== plotId)) throw new Error("Station response does not match the requested parent plot.");
      this.update((p) => ({ ...p, stations, selectedStationId: stations[0]?.id ?? "", loading: false, error: "" }));
    } catch (err) {
      if (this.disposed || reqId !== this.activeRequestId || curScope !== this.scopeKey) return;
      this.update((p) => ({ ...p, stations: [], selectedStationId: "", loading: false, error: normalizeApiError(err).message }));
    }
  }

  selectStation(stationId: string) {
    if (!stationId) { this.update((p) => ({ ...p, selectedStationId: "" })); return; }
    if (this.state.stations.some((s) => s.id === stationId)) this.update((p) => ({ ...p, selectedStationId: stationId }));
  }
}
