import { describe, expect, it } from 'vitest';

import { parseWeatherHistoryResponse } from '../integrations/weather/contracts.js';
import type { RawHistoryBatch } from './raw-history.js';
import {
  traverseRawHistory,
  type TraverseRawHistoryFetchQuery,
  type TraverseRawHistoryInput,
} from './raw-history-traversal.js';

const begin = new Date('2026-10-01T00:00:00.000Z');
const end = new Date('2026-10-01T01:00:00.000Z');
const t0 = begin.getTime();
const t1 = begin.getTime() + 1000;
const t2 = begin.getTime() + 2000;

const row = (ts: number, moisture: unknown, temperature?: unknown) => ({
  ts,
  time: new Date(ts).toISOString(),
  moisture,
  ...(temperature !== undefined ? { temperature } : {}),
});

const makeUpstream = (stationCode: string, records: unknown[]) =>
  parseWeatherHistoryResponse({
    success: true,
    data: [{ station: stationCode, history: { soil: records } }],
  }).data;

type CommitRecord = {
  batch: RawHistoryBatch;
  coverage?: { begin: Date; end: Date } | undefined;
  resumeAt: Date;
};

const createHarness = (defaults?: Partial<TraverseRawHistoryInput>) => {
  const commits: CommitRecord[] = [];
  const run = (input?: Partial<TraverseRawHistoryInput>) =>
    traverseRawHistory({
      stationCode: 'RAW01',
      fields: ['moisture'],
      begin,
      end,
      maxPages: 3,
      pageSize: 2,
      fetch: () => Promise.resolve(makeUpstream('RAW01', [])),
      commit: (batch, coverage, resumeAt) => {
        commits.push({ batch, coverage, resumeAt });
        return Promise.resolve();
      },
      ...defaults,
      ...input,
    });
  return { commits, run };
};

describe('traverseRawHistory', () => {
  it('fixture 1: valid empty page is complete with full coverage', async () => {
    let query: TraverseRawHistoryFetchQuery | undefined;
    const { commits, run } = createHarness();
    const result = await run({
      fields: ['moisture', 'temperature'],
      pageSize: 5,
      fetch: (q) => {
        query = q;
        return Promise.resolve(makeUpstream('RAW01', []));
      },
    });

    expect(result).toEqual({ pages: 1, resumeAt: end, outcome: 'complete' });
    expect(query).toEqual({
      begin: begin.toISOString(),
      end: end.toISOString(),
      limit: 5,
      order: 'asc',
      interval: 'raw',
      fields: ['moisture', 'temperature'],
      stationCode: 'RAW01',
    });
    expect(commits).toHaveLength(1);
    expect(commits[0]?.coverage).toEqual({ begin, end });
    expect(commits[0]?.resumeAt).toEqual(end);
    expect(commits[0]?.batch.rawCount).toBe(0);
  });

  it('fixture 2: 1 full page then underfull overlapping tail', async () => {
    const queries: TraverseRawHistoryFetchQuery[] = [];
    const { commits, run } = createHarness();
    const result = await run({
      fetch: (q) => {
        queries.push(q);
        return Promise.resolve(
          makeUpstream('RAW01', queries.length === 1 ? [row(t0, 40), row(t1, 41)] : [row(t1, 41)]),
        );
      },
    });

    expect(result).toEqual({ pages: 2, resumeAt: end, outcome: 'complete' });
    expect(queries[1]).toMatchObject({ begin: new Date(t1).toISOString() });
    expect(commits.map((c) => ({ coverage: c.coverage, resumeAt: c.resumeAt }))).toEqual([
      { coverage: { begin, end: new Date(t1 - 1) }, resumeAt: new Date(t1) },
      { coverage: { begin: new Date(t1), end }, resumeAt: end },
    ]);
  });

  it('fixture 3: same-time saturation commits readings without coverage and does not advance', async () => {
    let fetchCount = 0;
    const { commits, run } = createHarness();
    const result = await run({
      fetch: () => {
        fetchCount++;
        return Promise.resolve(makeUpstream('RAW01', [row(t0, 40), row(t0, 40)]));
      },
    });

    expect(fetchCount).toBe(1);
    expect(result).toEqual({ pages: 1, resumeAt: begin, outcome: 'saturated' });
    expect(commits.map((c) => ({ coverage: c.coverage, resumeAt: c.resumeAt }))).toEqual([
      { coverage: undefined, resumeAt: begin },
    ]);
  });

  it('fixture 4: budget 2 of 3 pages returns last committed inclusive boundary', async () => {
    let fetchCount = 0;
    const { commits, run } = createHarness();
    const result = await run({
      maxPages: 2,
      fetch: (q) => {
        fetchCount++;
        return Promise.resolve(
          makeUpstream(
            'RAW01',
            q.begin === begin.toISOString()
              ? [row(t0, 40), row(t1, 41)]
              : [row(t1, 41), row(t2, 42)],
          ),
        );
      },
    });

    expect(fetchCount).toBe(2);
    expect(result).toEqual({ pages: 2, resumeAt: new Date(t2), outcome: 'budget' });
    expect(commits.map((c) => ({ coverage: c.coverage, resumeAt: c.resumeAt }))).toEqual([
      { coverage: { begin, end: new Date(t1 - 1) }, resumeAt: new Date(t1) },
      { coverage: { begin: new Date(t1), end: new Date(t2 - 1) }, resumeAt: new Date(t2) },
    ]);
  });

  it('fixture 5: callback page2 failure propagates and never declares success', async () => {
    let page = 0;
    const { commits, run } = createHarness();
    await expect(
      run({
        fetch: () => {
          page++;
          if (page === 1) return Promise.resolve(makeUpstream('RAW01', [row(t0, 40), row(t1, 41)]));
          return Promise.reject(new Error('Upstream timeout on page 2'));
        },
      }),
    ).rejects.toThrow('Upstream timeout on page 2');

    expect(commits).toHaveLength(1);
    expect(commits[0]?.resumeAt).toEqual(new Date(t1));
  });

  it('fixture 6: stop before commit prevents writes and returns stopped', async () => {
    let calls = 0;
    const { commits, run } = createHarness();
    const result = await run({
      canContinue: () => ++calls <= 1,
      fetch: () => Promise.resolve(makeUpstream('RAW01', [row(t0, 40)])),
    });

    expect(commits).toHaveLength(0);
    expect(result).toEqual({ pages: 0, resumeAt: begin, outcome: 'stopped' });
  });

  it('fixture 7: sparse field limits coverage to eligible fields, malformed throws', async () => {
    const { commits: c1, run: run1 } = createHarness();
    await run1({
      fields: ['moisture', 'temperature'],
      pageSize: 5,
      fetch: () => Promise.resolve(makeUpstream('RAW01', [row(t0, 40)])),
    });
    expect(c1[0]?.batch.completeFields).toEqual(['moisture']);
    expect(c1[0]?.coverage).toEqual({ begin, end });

    const { commits: c2, run: run2 } = createHarness();
    await run2({
      pageSize: 5,
      fetch: () => Promise.resolve(makeUpstream('RAW01', [row(t0, 40), row(t0, 41)])),
    });
    expect(c2[0]?.batch.completeFields).toEqual([]);
    expect(c2[0]?.coverage).toBeUndefined();

    const { run: run3 } = createHarness();
    await expect(
      run3({ fetch: () => Promise.resolve(makeUpstream('OTHER', [])) }),
    ).rejects.toThrow();
  });

  it('fixture 8: same-time overlap hands idempotent boundary input to commit', async () => {
    let page = 0;
    const { commits, run } = createHarness();
    await run({
      fetch: () => {
        page++;
        return Promise.resolve(
          makeUpstream('RAW01', page === 1 ? [row(t0, 40), row(t1, 41)] : [row(t1, 41)]),
        );
      },
    });

    expect(commits).toHaveLength(2);
    const iso = new Date(t1).toISOString();
    expect(commits[0]?.batch.readings.some((r) => r.observedAt === iso)).toBe(true);
    expect(commits[1]?.batch.readings.some((r) => r.observedAt === iso)).toBe(true);
  });
});
