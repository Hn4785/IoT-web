import type { SoilField } from './station-data.contracts.js';

export const SOIL_METADATA_PROVIDER = Symbol('SOIL_METADATA_PROVIDER');

export type SoilMetadata =
  | Readonly<{ field: SoilField; isConfirmed: true; unit: string; revision: string }>
  | Readonly<{ field: SoilField; isConfirmed: false }>;

export interface SoilMetadataProvider {
  getFieldMetadata(stationId: string, field: SoilField): Promise<SoilMetadata>;
}

export class UnconfirmedSoilMetadataProvider implements SoilMetadataProvider {
  getFieldMetadata(stationId: string, field: SoilField): Promise<SoilMetadata> {
    return Promise.resolve({ field, isConfirmed: false });
  }
}

const DEMO_UNITS: Readonly<Record<SoilField, string>> = {
  temperature: '°C',
  moisture: '%',
  ec: 'µS/cm',
  ph: 'pH',
  nitrogen: 'mg/kg',
  phosphorus: 'mg/kg',
  potassium: 'mg/kg',
  light: 'lx',
};

export class DemoSoilMetadataProvider implements SoilMetadataProvider {
  private readonly allowedCodes: ReadonlySet<string>;

  constructor(codes: readonly string[]) {
    this.allowedCodes = new Set(codes);
  }

  getFieldMetadata(stationCode: string, field: SoilField): Promise<SoilMetadata> {
    if (!this.allowedCodes.has(stationCode)) {
      return Promise.resolve({ field, isConfirmed: false });
    }

    return Promise.resolve({
      field,
      isConfirmed: true,
      unit: DEMO_UNITS[field],
      revision: `demo:v1:${field}`,
    });
  }
}
