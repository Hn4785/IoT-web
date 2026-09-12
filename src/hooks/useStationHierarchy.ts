import { useCallback, useEffect, useMemo, useState } from "react";

import {
  stationBrowserService,
  type BrowserFarm,
  type BrowserPlot,
  type BrowserStation,
} from "../services/stationBrowserService.ts";
import { normalizeApiError } from "../utils/apiError.ts";

export function useStationHierarchy() {
  const [farms, setFarms] = useState<BrowserFarm[]>([]);
  const [plots, setPlots] = useState<BrowserPlot[]>([]);
  const [stations, setStations] = useState<BrowserStation[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [selectedPlotId, setSelectedPlotId] = useState("");
  const [selectedStationId, setSelectedStationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    setReloadKey((value) => value + 1);
  }, []);

  const selectFarm = useCallback((farmId: string) => {
    setSelectedFarmId(farmId);
    setPlots([]);
    setStations([]);
    setSelectedPlotId("");
    setSelectedStationId("");
    setLoading(true);
    setError("");
  }, []);

  const selectPlot = useCallback((plotId: string) => {
    setSelectedPlotId(plotId);
    setStations([]);
    setSelectedStationId("");
    setLoading(true);
    setError("");
  }, []);

  useEffect(() => {
    let active = true;
    stationBrowserService.listFarms().then(
      (page) => {
        if (!active) return;
        setFarms(page.items);
        setSelectedFarmId((current) =>
          page.items.some((farm) => farm.id === current) ? current : (page.items[0]?.id ?? ""),
        );
        setLoading(false);
      },
      (reason) => {
        if (!active) return;
        setError(normalizeApiError(reason).message);
        setLoading(false);
      },
    );
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    if (!selectedFarmId) return () => { active = false; };

    stationBrowserService.listPlots(selectedFarmId).then(
      (page) => {
        if (!active) return;
        setPlots(page.items);
        setSelectedPlotId(page.items[0]?.id ?? "");
        setLoading(false);
      },
      (reason) => {
        if (!active) return;
        setError(normalizeApiError(reason).message);
        setLoading(false);
      },
    );
    return () => { active = false; };
  }, [selectedFarmId]);

  useEffect(() => {
    let active = true;
    if (!selectedPlotId) return () => { active = false; };

    stationBrowserService.listStations(selectedPlotId).then(
      (page) => {
        if (!active) return;
        setStations(page.items);
        setSelectedStationId(page.items[0]?.id ?? "");
        setLoading(false);
      },
      (reason) => {
        if (!active) return;
        setError(normalizeApiError(reason).message);
        setLoading(false);
      },
    );
    return () => { active = false; };
  }, [selectedPlotId]);

  return {
    farms,
    plots,
    stations,
    selectedFarmId,
    selectedPlotId,
    selectedStationId,
    selectedFarm: useMemo(
      () => farms.find((farm) => farm.id === selectedFarmId),
      [farms, selectedFarmId],
    ),
    selectedPlot: useMemo(
      () => plots.find((plot) => plot.id === selectedPlotId),
      [plots, selectedPlotId],
    ),
    selectedStation: useMemo(
      () => stations.find((station) => station.id === selectedStationId),
      [stations, selectedStationId],
    ),
    setSelectedFarmId: selectFarm,
    setSelectedPlotId: selectPlot,
    setSelectedStationId,
    loading,
    error,
    reload,
  };
}
