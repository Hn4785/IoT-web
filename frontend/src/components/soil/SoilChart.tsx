import type { SoilField } from "@/types/soil";
import LineChart, {
  type LineChartPoint,
} from "@/components/charts/LineChart";
import AreaChart from "@/components/charts/AreaChart";
import styles from "./SoilChart.module.css";

export type SoilChartVariant = "line" | "area";

export interface SoilChartProps {
  field: SoilField;
  data: LineChartPoint[];

  title?: string;
  unit?: string;

  variant?: SoilChartVariant;

  height?: number;

  showQuality?: boolean;
  showTimestamp?: boolean;

  emptyMessage?: string;

  className?: string;
}

const FIELD_LABELS: Record<SoilField, string> = {
  temperature: "Soil Temperature",
  moisture: "Soil Moisture",
  ec: "EC",
  ph: "pH",
  nitrogen: "Nitrogen",
  phosphorus: "Phosphorus",
  potassium: "Potassium",
};

export default function SoilChart({
  field,
  data,
  title,
  unit,
  variant = "line",
  height = 280,
  showQuality = true,
  showTimestamp = true,
  emptyMessage = "No soil data available for the selected range.",
  className,
}: SoilChartProps) {
  const chartTitle = title ?? FIELD_LABELS[field];

  const classNames = [styles.chart, className]
    .filter(Boolean)
    .join(" ");

  if (data.length === 0) {
    return (
      <section className={classNames}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>{chartTitle}</h3>

            {unit && <span className={styles.unit}>{unit}</span>}
          </div>
        </div>

        <div className={styles.emptyState}>
          <span className={styles.emptyTitle}>{emptyMessage}</span>
          <span className={styles.emptyDescription}>
            Try changing the selected station, depth, metric, or date range.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className={classNames}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{chartTitle}</h3>

          {unit && <span className={styles.unit}>{unit}</span>}
        </div>
      </div>

      <div className={styles.chartBody}>
        {variant === "line" ? (
          <LineChart
            data={data}
            height={height}
            showQuality={showQuality}
            showTimestamp={showTimestamp}
          />
        ) : (
          <AreaChart
            data={data}
            height={height}
            showQuality={showQuality}
            showTimestamp={showTimestamp}
          />
        )}
      </div>
    </section>
  );
}