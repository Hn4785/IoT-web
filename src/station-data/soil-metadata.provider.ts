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
