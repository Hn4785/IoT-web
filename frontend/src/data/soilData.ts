import type { LatestSoilData, SoilHistoryPoint } from "@/types/soil";

// Soil readings are never fabricated in production.
export const latestSoilData: LatestSoilData[] = [];

export const soilHistory: Record<
  "moisture" | "temperature" | "ph" | "ec",
  SoilHistoryPoint[]
> = {
  moisture: [],
  temperature: [],
  ph: [],
  ec: [],
};
