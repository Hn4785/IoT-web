export function historyDepthPresentation(depths: number[]) {
  const showDepth = depths.length > 0;
  return {
    showDepth,
    seriesLabel(stationCode: string, depthCm: number | null) {
      return showDepth && depthCm != null ? `${stationCode} (${depthCm}cm)` : stationCode;
    },
    csvColumns: showDepth
      ? ["station", "depth", "metric", "observedAt", "value", "unit"]
      : ["station", "metric", "observedAt", "value", "unit"],
  };
}
