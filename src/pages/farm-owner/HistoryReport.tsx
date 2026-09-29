import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

import { Button } from "../../components/common/Button.tsx";
import LineChart, { type LineChartPoint } from "../../components/charts/LineChart.tsx";
import PageHeader from "../../components/layout/PageHeader.tsx";
import { useStationHierarchy } from "../../hooks/useStationHierarchy.ts";
import { stationBrowserService, type SoilHistoryData } from "../../services/stationBrowserService.ts";
import type { ApiSoilField } from "../../types/soil.ts";
import { normalizeApiError } from "../../utils/apiError.ts";
import styles from "./ConnectedSoil.module.css";

const fields: Array<{ value: ApiSoilField; label: string }> = [
  { value: "moisture", label: "Soil Moisture" },
  { value: "temperature", label: "Soil Temperature" },
  { value: "ph", label: "pH" },
  { value: "ec", label: "EC" },
  { value: "nitrogen", label: "Nitrogen" },
  { value: "phosphorus", label: "Phosphorus" },
  { value: "potassium", label: "Potassium" },
];

function inputDate(date: Date) { return date.toISOString().slice(0, 10); }

const defaultEnd = inputDate(new Date());
const defaultBegin = inputDate(new Date(new Date(defaultEnd).getTime() - 7 * 86_400_000));

interface HistoryReportDataState {
  stationId: string;
  field: ApiSoilField;
  begin: string;
  end: string;
  reloadKey: number;
  data: SoilHistoryData | null;
  error: string;
}

export default function HistoryReport() {
  const hierarchy = useStationHierarchy();
  const [field, setField] = useState<ApiSoilField>("moisture");
  const [begin, setBegin] = useState(defaultBegin);
  const [end, setEnd] = useState(defaultEnd);
  const [dataState, setDataState] = useState<HistoryReportDataState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const currentStationId = hierarchy.selectedStationId;
    if (!currentStationId) return () => { active = false; };
    const currentField = field;
    const currentBegin = begin;
    const currentEnd = end;
    const currentReloadKey = reloadKey;

    stationBrowserService.getHistory(currentStationId, {
      fields: [currentField],
      begin: `${currentBegin}T00:00:00.000Z`,
      end: `${currentEnd}T23:59:59.999Z`,
      interval: "1h",
      aggregate: "mean",
      limit: 500,
    }).then(
      (result) => {
        if (!active) return;
        setDataState({
          stationId: currentStationId,
          field: currentField,
          begin: currentBegin,
          end: currentEnd,
          reloadKey: currentReloadKey,
          data: result,
          error: "",
        });
      },
      (reason) => {
        if (!active) return;
        setDataState({
          stationId: currentStationId,
          field: currentField,
          begin: currentBegin,
          end: currentEnd,
          reloadKey: currentReloadKey,
          data: null,
          error: normalizeApiError(reason).message,
        });
      },
    );
    return () => { active = false; };
  }, [begin, end, field, hierarchy.selectedStationId, reloadKey]);

  const currentData = (dataState?.stationId === hierarchy.selectedStationId
    && dataState?.field === field
    && dataState?.begin === begin
    && dataState?.end === end
    && dataState?.reloadKey === reloadKey)
    ? dataState
    : null;
  const data = currentData?.data ?? null;
  const error = currentData?.error ?? "";

  const series = data?.series.find((item) => item.field === field);
  const points = useMemo<LineChartPoint[]>(() => (series?.points ?? []).map((point) => ({
    label: new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(point.observedAt)),
    value: point.value,
  })), [series]);

  function exportCsv() {
    if (!series) return;
    const rows = ["observedAt,value,unit,quality", ...series.points.map((point) => `${point.observedAt},${point.value},${series.unit ?? ""},${point.quality}`)];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${field}-${begin}-${end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.page}>
      <PageHeader title="History & Report" description="Bounded UTC soil history from the connected backend." actions={<Button icon={<Download size={16} />} disabled={!series?.points.length} onClick={exportCsv}>Export CSV</Button>} />
      <section className={styles.filters}>
        <label>Farm<select value={hierarchy.selectedFarmId} onChange={(event) => hierarchy.setSelectedFarmId(event.target.value)}><option value="">Select a farm</option>{hierarchy.farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label>
        <label>Plot<select value={hierarchy.selectedPlotId} onChange={(event) => hierarchy.setSelectedPlotId(event.target.value)} disabled={!hierarchy.selectedFarmId}><option value="">Select a plot</option>{hierarchy.plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select></label>
        <label>Station<select value={hierarchy.selectedStationId} onChange={(event) => hierarchy.setSelectedStationId(event.target.value)} disabled={!hierarchy.selectedPlotId}><option value="">Select a station</option>{hierarchy.stations.map((station) => <option key={station.id} value={station.id}>{station.code}</option>)}</select></label>
        <label>Metric<select value={field} onChange={(event) => setField(event.target.value as ApiSoilField)}>{fields.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>From<input type="date" value={begin} max={end} onChange={(event) => setBegin(event.target.value)} /></label>
        <label>To<input type="date" value={end} min={begin} onChange={(event) => setEnd(event.target.value)} /></label>
        <Button variant="outline" icon={<RefreshCw size={16} />} disabled={!hierarchy.selectedStationId} onClick={() => setReloadKey((value) => value + 1)}>Apply</Button>
      </section>
      {(error || hierarchy.error) && <p className={styles.error} role="alert">{error || hierarchy.error}</p>}
      <section className={styles.card}>
        <h2>{fields.find((item) => item.value === field)?.label}</h2>
        {points.length ? <LineChart data={points} unit={series?.unit ?? ""} /> : <p className={styles.empty}>No historical measurements for the selected range.</p>}
        <footer className={styles.reportFooter}>{points.length} measurements · {data?.isFromCache ? "cache" : "upstream"}{data?.isStale ? " · stale" : ""}</footer>
      </section>
    </div>
  );
}
