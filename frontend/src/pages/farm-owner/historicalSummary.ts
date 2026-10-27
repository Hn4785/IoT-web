export function measurementSummary(values: number[]) {
  if (values.length === 0) {
    return { average: null, minimum: null, maximum: null, standardDeviation: null };
  }
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return {
    average,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    standardDeviation: Math.sqrt(variance),
  };
}
