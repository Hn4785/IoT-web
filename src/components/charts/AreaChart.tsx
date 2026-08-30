import LineChart, {
  type LineChartPoint,
  type LineChartProps,
} from "./LineChart";

export interface AreaChartProps
  extends Omit<LineChartProps, "showArea"> {
  fillOpacity?: number;
}

export type AreaChartPoint = LineChartPoint;

export default function AreaChart({
  fillOpacity = 0.08,
  ...props
}: AreaChartProps) {
  return (
    <div
      style={
        {
          "--chart-area-opacity": fillOpacity,
        } as React.CSSProperties
      }
    >
      <LineChart
        {...props}
        showArea
      />
    </div>
  );
}