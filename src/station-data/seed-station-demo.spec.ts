import { describe, expect, it } from 'vitest';

import {
  assertDemoSeedTarget,
  DEMO_KEYS,
  type DemoSeedRepository,
  ensureDemoRecords,
} from './seed-station-demo.js';

type Farm = { id: string; name: string };
type Plot = { id: string; farmId: string; name: string };
type Station = { id: string; plotId: string; upstreamCode: string; name: string };

class FakeDemoSeedRepository implements DemoSeedRepository {
  readonly farms: Farm[] = [];
  readonly plots: Plot[] = [];
  readonly stations: Station[] = [];
  created = { farms: 0, plots: 0, stations: 0 };

  findFarmsByName(name: string): Promise<readonly Farm[]> {
    return Promise.resolve(this.farms.filter((farm) => farm.name === name));
  }

  createFarm(name: string): Promise<Farm> {
    const farm = { id: `farm-${String(this.farms.length + 1)}`, name };
    this.farms.push(farm);
    this.created.farms += 1;
    return Promise.resolve(farm);
  }

  findPlot(farmId: string, name: string): Promise<Plot | null> {
    return Promise.resolve(
      this.plots.find((plot) => plot.farmId === farmId && plot.name === name) ?? null,
    );
  }

  createPlot(farmId: string, name: string): Promise<Plot> {
    const plot = { id: `plot-${String(this.plots.length + 1)}`, farmId, name };
    this.plots.push(plot);
    this.created.plots += 1;
    return Promise.resolve(plot);
  }

  findStationByCode(code: string): Promise<Station | null> {
    return Promise.resolve(this.stations.find((station) => station.upstreamCode === code) ?? null);
  }

  createStation(input: { plotId: string; upstreamCode: string; name: string }): Promise<Station> {
    const station = { id: `station-${String(this.stations.length + 1)}`, ...input };
    this.stations.push(station);
    this.created.stations += 1;
    return Promise.resolve(station);
  }
}

describe('station demo seed safety', () => {
  it.each([
    ['postgresql://user:pass@localhost:5432/iot_dev', 'production', ['--confirm-demo-seed']],
    ['postgresql://user:pass@localhost:5432/iot_test', 'development', ['--confirm-demo-seed']],
    ['postgresql://user:pass@localhost:5432/another', 'development', ['--confirm-demo-seed']],
    ['https://example.test/iot_dev', 'development', ['--confirm-demo-seed']],
    ['postgresql://user:pass@localhost:5432/iot_dev', 'development', []],
    ['postgresql://user:pass@localhost:5432/iot_dev', 'development', ['--confirm']],
  ] as const)('rejects unsafe target %#', (databaseUrl, nodeEnv, args) => {
    expect(() => {
      assertDemoSeedTarget(databaseUrl, nodeEnv, args);
    }).toThrow();
  });

  it('accepts only an explicitly confirmed non-production iot_dev target', () => {
    expect(() => {
      assertDemoSeedTarget('postgresql://user:pass@localhost:5432/iot_dev', 'development', [
        '--confirm-demo-seed',
      ]);
    }).not.toThrow();
  });

  it('creates stable records once and is idempotent', async () => {
    const repository = new FakeDemoSeedRepository();

    await expect(ensureDemoRecords(repository)).resolves.toEqual({ created: 4, existing: 0 });
    await expect(ensureDemoRecords(repository)).resolves.toEqual({ created: 0, existing: 4 });

    expect(repository.farms).toEqual([expect.objectContaining({ name: DEMO_KEYS.farmName })]);
    expect(repository.plots).toEqual([
      expect.objectContaining({ name: DEMO_KEYS.plotName, farmId: repository.farms[0]?.id }),
    ]);
    expect(repository.stations.map((station) => station.upstreamCode)).toEqual([
      'NODE01',
      'NODE02',
    ]);
    expect(repository.created).toEqual({ farms: 1, plots: 1, stations: 2 });
  });

  it('rejects duplicate farm names and station natural-key conflicts', async () => {
    const duplicateFarm = new FakeDemoSeedRepository();
    duplicateFarm.farms.push(
      { id: 'farm-1', name: DEMO_KEYS.farmName },
      { id: 'farm-2', name: DEMO_KEYS.farmName },
    );
    await expect(ensureDemoRecords(duplicateFarm)).rejects.toThrow('conflict');

    const stationConflict = new FakeDemoSeedRepository();
    stationConflict.stations.push({
      id: 'station-existing',
      plotId: 'another-plot',
      upstreamCode: 'NODE01',
      name: 'Unexpected station',
    });
    await expect(ensureDemoRecords(stationConflict)).rejects.toThrow('conflict');
  });
});
