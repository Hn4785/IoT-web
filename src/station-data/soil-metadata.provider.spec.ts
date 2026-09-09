import { parseLatestSoilQuery, SOIL_FIELDS } from './station-data.contracts.js';
import { UnconfirmedSoilMetadataProvider } from './soil-metadata.provider.js';

describe('SD-3 Task 6A', () => {
  describe('parseLatestSoilQuery', () => {
    test('defaults missing fields to all fields in canonical order', () => {
      expect(parseLatestSoilQuery({}).fields).toEqual([...SOIL_FIELDS]);
    });

    test('accepts explicit field selection preserving order', () => {
      const query = parseLatestSoilQuery({ fields: 'ph,temperature' });
      expect(query.fields).toEqual(['ph', 'temperature']);
    });

    test('rejects duplicate tokens', () => {
      expect(() => parseLatestSoilQuery({ fields: 'temperature,temperature' })).toThrow();
    });

    test('rejects whitespace tokens', () => {
      expect(() => parseLatestSoilQuery({ fields: 'temperature, ' })).toThrow();
    });

    test('rejects comma-created empty tokens', () => {
      expect(() => parseLatestSoilQuery({ fields: 'temperature,,ph' })).toThrow();
    });

    test.each([
      { fields: 'unknown' },
      { fields: ['temperature'] },
      { fields: 'temperature', extra: 'value' },
    ])('rejects invalid query $fields', (query) => {
      expect(() => parseLatestSoilQuery(query)).toThrow();
    });

    test('accepts all eight fields', () => {
      const allFields = SOIL_FIELDS.join(',');
      const query = parseLatestSoilQuery({ fields: allFields });
      expect(query.fields).toEqual([...SOIL_FIELDS]);
    });
  });

  describe('UnconfirmedSoilMetadataProvider', () => {
    test.each(SOIL_FIELDS)(
      'returns unconfirmed %s metadata without unit or revision',
      async (field) => {
        const provider = new UnconfirmedSoilMetadataProvider();
        const metadata = await provider.getFieldMetadata('station-1', field);
        expect(metadata).toEqual({ field, isConfirmed: false });
        expect('unit' in metadata).toBe(false);
        expect('revision' in metadata).toBe(false);
      },
    );
  });
});
