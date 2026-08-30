export type PlotStatus =
  | "active"
  | "inactive";
  
export interface Plot {
  id: string;
  farmId: string;

  name: string;
  code: string;

  area?: number;
  areaUnit?: "m2" | "ha";

  crop?: string;

  stationIds: string[];

  status: PlotStatus;

  createdAt: string;
  updatedAt: string;
}