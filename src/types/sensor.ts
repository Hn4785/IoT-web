export type MeasurementType =
  | "soil"
  | "weather"
  | "water";

export type SensorStatus =
  | "active"
  | "inactive"
  | "error"
  | "uncalibrated";

export type CalibrationStatus =
  | "valid"
  | "expired"
  | "uncalibrated";

export interface SensorCalibration {
  calibratedAt?: string; // Ngày hiệu chuẩn
  expiresAt?: string; // Ngày hết hạn hiệu chuẩn
  conversionFactor?: number; // Hệ số chuyển đổi
  notes?: string; // Ghi chú
  calibratedBy?: string; // Người hiệu chuẩn
  status: CalibrationStatus; // Trạng thái hiệu chuẩn
}

export interface Sensor {
  id: string;
  stationId: string;

  name?: string;
  model: string;

  measurement: MeasurementType;

  field: string;

  depth?: number;
  depthUnit?: "cm" | "m";

  unit: string;

  status: SensorStatus;

  measurementInterval?: number;
  sendInterval?: number;

  calibration?: SensorCalibration;

  createdAt: string;
  updatedAt: string;
}