import { z } from 'zod';

export const SOIL_ALERT_FIELDS = [
  'temperature',
  'moisture',
  'ec',
  'ph',
  'nitrogen',
  'phosphorus',
  'potassium',
  'light',
] as const;
export const soilAlertFieldSchema = z.enum(SOIL_ALERT_FIELDS);
export type SoilAlertField = z.infer<typeof soilAlertFieldSchema>;
