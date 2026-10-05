import { useEffect, useMemo, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

import { Button } from "../../components/common/Button.tsx";
import Loading from "../../components/common/Loading.tsx";
import LineChart, { type LineChartPoint } from "../../components/charts/LineChart.tsx";
import PageHeader from "../../components/layout/PageHeader.tsx";
import { useStationHierarchy } from "../../hooks/useStationHierarchy.ts";
import { stationBrowserService } from "../../services/stationBrowserService.ts";
import type { ApiSoilField } from "../../types/soil.ts";
import {
  buildHistoryQueryKey,
  handleStationHistorySuccess,
  handleStationHistoryError,
  insertChartGaps,
  getHonestProvenanceAndCoverage,
  formatHistoryReportCsv,
  createRequestFence,
  type StationHistoryRecord,
  type HistoryQueryParams,
} from "../../utils/retainedHistoryData.ts";
import styles from "./ConnectedSoil.module.css";
import { formatVietnamDateTime } from "../../utils/formatDateTime.ts";

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
  queryKey: string;
  stationId: string;
  field: ApiSoilField;
  begin: string;
  end: string;
  reloadKey: number;
  record: StationHistoryRecord | null;
}

export default function HistoryReport() {
  const hierarchy = useStationHierarchy();
  const [field, setField] = useState<ApiSoilField>("moisture");
  const [begin, setBegin] = useState(defaultBegin);
  const [end, setEnd] = useState(defaultEnd);
  const [dataState, setDataState] = useState<HistoryReportDataState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const fenceRef = useRef(createRequestFence());

  if (!hierarchy.loading && !hierarchy.selectedStationId && dataState !== null) {
    setDataState(null);
  }

  const queryParams: HistoryQueryParams = useMemo(() => ({
    stationId: hierarchy.selectedStationId,
    fields: [field],
    begin: `${begin}T00:00:00.000Z`,
    end: `${end}T23:59:59.999Z`,
    interval: "1h",
    aggregate: "mean",
    limit: 500,
  }), [hierarchy.selectedStationId, field, begin, end]);

  const queryKey = useMemo(() => buildHistoryQueryKey(queryParams), [queryParams]);

  useEffect(() => {
    const fence = fenceRef.current;
    let active = true;
    const currentStationId = hierarchy.selectedStationId;
    if (!currentStationId) return () => { active = false; };
    const currentReloadKey = reloadKey;
    const reqId = fence.nextRequestId();

    stationBrowserService.getHistory(currentStationId, {
      fields: [field],
      begin: `${begin}T00:00:00.000Z`,
      end: `${end}T23:59:59.999Z`,
      interval: "1h",
      aggregate: "mean",
      limit: 500,
    }).then(
      (result) => {
        if (!active || !fenceRef.current.isCurrent(reqId)) return;
        setDataState((prev) => {
          if (!fenceRef.current.isCurrent(reqId)) return prev;
          const prior = prev?.queryKey === queryKey ? prev.record : undefined;
          const updated = handleStationHistorySuccess(prior, queryKey, result, currentStationId);
          return { queryKey, stationId: currentStationId, field, begin, end, reloadKey: currentReloadKey, record: updated };
        });
      },
      (reason) => {
        if (!active || !fenceRef.current.isCurrent(reqId)) return;
        setDataState((prev) => {
          if (!fenceRef.current.isCurrent(reqId)) return prev;
          const prior = prev?.queryKey === queryKey ? prev.record : undefined;
          const updated = handleStationHistoryError(prior, queryKey, reason, currentStationId);
          return { queryKey, stationId: currentStationId, field, begin, end, reloadKey: currentReloadKey, record: updated };
        });
      },
    );
    return () => {
      active = false;
      fence.nextRequestId();
    };
  }, [begin, end, field, hierarchy.selectedStationId, queryKey, reloadKey]);

  const currentData = (dataState?.stationId === hierarchy.selectedStationId
    && dataState?.field === field
    && dataState?.begin === begin
    && dataState?.end === end
    && dataState?.reloadKey === reloadKey
    && dataState?.queryKey === queryKey)
    ? dataState
    : null;
  const record = currentData?.record ?? null;
  const data = record?.data ?? null;
  const error = record?.error ?? "";
  const isRetained = record?.isRetained ?? false;

  const isLoading = hierarchy.loading || Boolean(hierarchy.selectedStationId && !currentData && !error && !hierarchy.error);

  const series = data?.series.find((item) => item.field === field);
  const rawPoints = useMemo(() => series?.points ?? [], [series]);
  const points = rawPoints;
  const chartPoints = useMemo<LineChartPoint[]>(() => insertChartGaps(rawPoints, "1h").map((point) => ({
    value: point.value,
    timestamp: point.observedAt,
    quality: point.quality,
  })), [rawPoints]);

  const timeDomain = useMemo(() => ({
    begin: `${begin}T00:00:00.000Z`,
    end: `${end}T23:59:59.999Z`,
  }), [begin, end]);

  const provenance = getHonestProvenanceAndCoverage(data, isRetained, Boolean(error));

  function exportCsv() {
    if (!series || !series.points.length) return;
    const st = hierarchy.stations.find((s) => s.id === hierarchy.selectedStationId);
    const content = formatHistoryReportCsv({
      stationCode: st?.code ?? hierarchy.selectedStationId,
      field,
      begin,
      end,
      origin: provenance.origin,
      coverageStatus: provenance.coverageLabel,
      isRetained,
      fetchedAt: data?.fetchedAt,
      points: series.points,
      unit: series.unit ?? "",
      queryKey,
    });
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${field}-${begin}-${end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="History & Report"
        description="Historical soil data. Date filters use UTC; chart times use your local timezone."
        actions={<Button icon={<Download size={16} />} disabled={!series?.points.length} onClick={exportCsv}>Export CSV</Button>}
      />
      <section className={styles.filters}>
        <label>Farm<select value={hierarchy.selectedFarmId} onChange={(event) => hierarchy.setSelectedFarmId(event.target.value)}><option value="">Select a farm</option>{hierarchy.farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label>
        <label>Plot<select value={hierarchy.selectedPlotId} onChange={(event) => hierarchy.setSelectedPlotId(event.target.value)} disabled={!hierarchy.selectedFarmId}><option value="">Select a plot</option>{hierarchy.plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select></label>
        <label>Station<select value={hierarchy.selectedStationId} onChange={(event) => hierarchy.setSelectedStationId(event.target.value)} disabled={!hierarchy.selectedPlotId}><option value="">Select a station</option>{hierarchy.stations.map((station) => <option key={station.id} value={station.id}>{station.code}</option>)}</select></label>
        <label>Metric<select value={field} onChange={(event) => setField(event.target.value as ApiSoilField)}>{fields.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>From<input type="date" value={begin} max={end} onChange={(event) => setBegin(event.target.value)} /></label>
        <label>To<input type="date" value={end} min={begin} onChange={(event) => setEnd(event.target.value)} /></label>
        <Button variant="outline" icon={<RefreshCw size={16} />} disabled={!hierarchy.selectedStationId || hierarchy.loading} onClick={() => { hierarchy.reload(); setReloadKey((value) => value + 1); }}>Apply</Button>
      </section>
      {(error || hierarchy.error) && (
        <p className={styles.error} role="alert">
          {error || hierarchy.error}
          {" "}
          <button
            type="button"
            style={{ marginLeft: 8, cursor: "pointer", textDecoration: "underline", background: "none", border: "none", color: "inherit", font: "inherit" }}
            onClick={() => { if (hierarchy.error) hierarchy.reload(); setReloadKey((value) => value + 1); }}
          >
            Retry
          </button>
        </p>
      )}
      <section className={styles.card}>
        <h2>{fields.find((item) => item.value === field)?.label}</h2>
        {isLoading ? (
          <Loading label="Loading history report..." />
        ) : !hierarchy.selectedStationId ? (
          <p className={styles.empty}>Select a station to view history report.</p>
        ) : chartPoints.length && points.length ? (
          <LineChart
            data={chartPoints}
            unit={series?.unit ?? ""}
            showDots={false}
            height={280}
            timeDomain={timeDomain}
            ariaLabel={`${fields.find((item) => item.value === field)?.label} history report`}
          />
        ) : error || hierarchy.error ? (
          <p className={styles.empty}>Unable to load measurements.</p>
        ) : (
          <p className={styles.empty}>No historical measurements for the selected range.</p>
        )}
        {currentData && !isLoading && !hierarchy.error && (points.length > 0 || !error) && (
          <footer className={styles.reportFooter}>
            {points.length} hourly mean data points · {provenance.provenanceLabel}{record?.isStale ? " · Stale" : ""} · Coverage: {provenance.coverageLabel}{data?.fetchedAt ? ` · Last fetch: ${formatVietnamDateTime(data.fetchedAt)}` : ""}
          </footer>
        )}
      </section>
    </div>
  );
}
