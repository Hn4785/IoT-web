export type HistoryDays = 7 | 30 | 90;

export function historyWindow(now: Date, days: HistoryDays) {
  return {
    begin: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString(),
    end: now.toISOString(),
  };
}

export function areaPoints(values: number[]) {
  if (values.length < 2) return "";
  const width = 900;
  const height = 250;
  const padding = 16;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });
  return `${padding},${height - padding} ${points.join(" ")} ${width - padding},${height - padding}`;
}
