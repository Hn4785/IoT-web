import { parseCreateDataSource } from './data-source.contracts.js';

const farmId = '11111111-1111-4111-8111-111111111111';
const plotId = '22222222-2222-4222-8222-222222222222';

describe('data source creation contract', () => {
  it('accepts existing Farm and Plot identifiers without a source name', () => {
    expect(
      parseCreateDataSource({
        baseUrl: 'https://weather.example/api/v1',
        xApiKey: 'test-source-key',
        farm: { id: farmId },
        plot: { id: plotId },
      }),
    ).toEqual({
      baseUrl: 'https://weather.example/api/v1',
      xApiKey: 'test-source-key',
      farm: { id: farmId },
      plot: { id: plotId },
    });
  });

  it('accepts trimmed names for a Farm and Plot that will be created', () => {
    expect(
      parseCreateDataSource({
        name: '  North field source  ',
        baseUrl: 'https://weather.example/api/v1',
        xApiKey: 'test-source-key',
        farm: { name: '  North Farm  ' },
        plot: { name: '  Plot One  ' },
      }),
    ).toEqual({
      name: 'North field source',
      baseUrl: 'https://weather.example/api/v1',
      xApiKey: 'test-source-key',
      farm: { name: 'North Farm' },
      plot: { name: 'Plot One' },
    });
  });

  it.each([
    { farm: { id: farmId, name: 'Farm' }, plot: { id: plotId } },
    { farm: { id: farmId }, plot: { id: plotId, name: 'Plot' } },
    { farm: { name: '   ' }, plot: { name: 'Plot' } },
  ])('rejects an ambiguous or blank hierarchy choice %#', (hierarchy) => {
    expect(() =>
      parseCreateDataSource({
        baseUrl: 'https://weather.example/api/v1',
        xApiKey: 'test-source-key',
        ...hierarchy,
      }),
    ).toThrow('Request body is invalid');
  });
});
