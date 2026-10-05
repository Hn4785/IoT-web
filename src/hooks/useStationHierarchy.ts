import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "./useAuth.ts";
import { env } from "../config/env.ts";
import { stationBrowserService } from "../services/stationBrowserService.ts";
import {
  buildHierarchyScopeKey,
  createInitialHierarchyState,
  StationHierarchyCoordinator,
  type HierarchyState,
} from "../utils/stationHierarchyState.ts";

export function useStationHierarchy() {
  const { user, isLoading: authLoading } = useAuth();
  const scopeKey = useMemo(
    () => buildHierarchyScopeKey(user, env.apiBaseUrl),
    [user],
  );

  const [state, setState] = useState<HierarchyState>(() =>
    createInitialHierarchyState(scopeKey, true),
  );

  const coordinatorRef = useRef<StationHierarchyCoordinator | null>(null);

  useEffect(() => {
    if (authLoading || !user?.id) {
      coordinatorRef.current = null;
      return;
    }
    const coordinator = new StationHierarchyCoordinator({
      service: stationBrowserService,
      scopeKey,
      onStateChange: (next) => {
        if (coordinatorRef.current === coordinator) setState(next);
      },
    });
    coordinatorRef.current = coordinator;
    void coordinator.initialize();

    return () => {
      coordinator.dispose();
      if (coordinatorRef.current === coordinator) coordinatorRef.current = null;
    };
  }, [scopeKey, authLoading, user?.id]);

  const selectFarm = useCallback((farmId: string) => {
    void coordinatorRef.current?.selectFarm(farmId);
  }, []);

  const selectPlot = useCallback((plotId: string) => {
    void coordinatorRef.current?.selectPlot(plotId);
  }, []);

  const selectStation = useCallback((stationId: string) => {
    coordinatorRef.current?.selectStation(stationId);
  }, []);

  const reload = useCallback(() => {
    void coordinatorRef.current?.reload();
  }, []);

  const isCurrentScope = !authLoading && Boolean(user?.id) && state.scopeKey === scopeKey;
  const activeState = isCurrentScope
    ? state
    : createInitialHierarchyState(scopeKey, Boolean(user?.id) && authLoading);

  return {
    farms: activeState.farms,
    plots: activeState.plots,
    stations: activeState.stations,
    selectedFarmId: activeState.selectedFarmId,
    selectedPlotId: activeState.selectedPlotId,
    selectedStationId: activeState.selectedStationId,
    selectedFarm: useMemo(
      () => activeState.farms.find((farm) => farm.id === activeState.selectedFarmId),
      [activeState.farms, activeState.selectedFarmId],
    ),
    selectedPlot: useMemo(
      () => activeState.plots.find((plot) => plot.id === activeState.selectedPlotId),
      [activeState.plots, activeState.selectedPlotId],
    ),
    selectedStation: useMemo(
      () => activeState.stations.find((station) => station.id === activeState.selectedStationId),
      [activeState.stations, activeState.selectedStationId],
    ),
    setSelectedFarmId: selectFarm,
    setSelectedPlotId: selectPlot,
    setSelectedStationId: selectStation,
    loading: authLoading || activeState.loading,
    error: isCurrentScope ? activeState.error : "",
    reload,
    scopeKey,
  };
}
