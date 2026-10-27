import { AppError } from '../common/errors/app-error.js';
import type { WeatherHistoryStation } from '../integrations/weather/contracts.js';
import { normalizeRawHistory, type RawHistoryBatch } from './raw-history.js';
import type { SoilField } from './station-data.contracts.js';

export type TraverseRawHistoryFetchQuery = Readonly<{
  begin: string;
  end: string;
  limit: number;
  order: 'asc';
  interval: 'raw';
  fields: readonly SoilField[];
  stationCode: string;
}>;

export type TraverseRawHistoryCommitCoverage = Readonly<{
  begin: Date;
  end: Date;
}>;

export type TraverseRawHistoryOutcome = 'complete' | 'budget' | 'saturated' | 'stopped';

export type TraverseRawHistoryResult = Readonly<{
  pages: number;
  resumeAt: Date;
  outcome: TraverseRawHistoryOutcome;
}>;

export type TraverseRawHistoryInput = Readonly<{
  stationCode: string;
  fields: readonly SoilField[];
  begin: Date;
  end: Date;
  maxPages: number;
  pageSize: number;
  fetch: (query: TraverseRawHistoryFetchQuery) => Promise<readonly WeatherHistoryStation[]>;
  commit: (
    batch: RawHistoryBatch,
    coverage: TraverseRawHistoryCommitCoverage | undefined,
    resumeAt: Date,
  ) => Promise<void>;
  canContinue?: () => boolean | Promise<boolean>;
}>;

export async function traverseRawHistory(
  input: TraverseRawHistoryInput,
): Promise<TraverseRawHistoryResult> {
  if (
    !Number.isInteger(input.maxPages) ||
    input.maxPages < 1 ||
    input.maxPages > 10 ||
    !Number.isInteger(input.pageSize) ||
    input.pageSize < 1 ||
    input.pageSize > 5000
  ) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid pagination bounds');
  }

  if (
    !(input.begin instanceof Date) ||
    !Number.isFinite(input.begin.getTime()) ||
    !(input.end instanceof Date) ||
    !Number.isFinite(input.end.getTime()) ||
    input.begin.getTime() > input.end.getTime()
  ) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid time range');
  }

  if (!input.stationCode) throw new AppError('VALIDATION_ERROR', 400, 'stationCode is required');
  if (!Array.isArray(input.fields) || input.fields.length === 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'fields must not be empty');
  }

  const canContinue = input.canContinue ?? (() => true);
  let pages = 0;
  let currentBegin = input.begin;
  let lastCommittedResumeAt = input.begin;

  while (pages < input.maxPages) {
    if (!(await canContinue())) {
      return { pages, resumeAt: lastCommittedResumeAt, outcome: 'stopped' };
    }

    const upstream = await input.fetch({
      begin: currentBegin.toISOString(),
      end: input.end.toISOString(),
      limit: input.pageSize,
      order: 'asc',
      interval: 'raw',
      fields: input.fields,
      stationCode: input.stationCode,
    });

    const batch = normalizeRawHistory({
      upstream,
      stationCode: input.stationCode,
      fields: input.fields,
      begin: currentBegin,
      end: input.end,
      order: 'asc',
    });

    if (!(await canContinue())) {
      return { pages, resumeAt: lastCommittedResumeAt, outcome: 'stopped' };
    }

    if (batch.rawCount < input.pageSize) {
      const coverage =
        batch.completeFields.length > 0 ? { begin: currentBegin, end: input.end } : undefined;
      await input.commit(batch, coverage, input.end);
      return { pages: pages + 1, resumeAt: input.end, outcome: 'complete' };
    }

    if (batch.lastTimestamp === null) {
      throw new AppError('UPSTREAM_INVALID_RESPONSE', 502, 'Weather response is invalid');
    }
    const t = new Date(batch.lastTimestamp);
    if (t.getTime() > currentBegin.getTime()) {
      const coverage =
        batch.completeFields.length > 0
          ? { begin: currentBegin, end: new Date(t.getTime() - 1) }
          : undefined;
      await input.commit(batch, coverage, t);
      lastCommittedResumeAt = t;
      pages++;
      currentBegin = t;

      if (pages >= input.maxPages) {
        return { pages, resumeAt: lastCommittedResumeAt, outcome: 'budget' };
      }
    } else {
      await input.commit(batch, undefined, currentBegin);
      return { pages: pages + 1, resumeAt: currentBegin, outcome: 'saturated' };
    }
  }

  return { pages, resumeAt: lastCommittedResumeAt, outcome: 'budget' };
}
