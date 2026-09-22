import { describe, expect, it, vi } from 'vitest';

import type { RuntimeConfig } from '../config/runtime-config.js';
import type { PrismaService } from '../database/prisma.service.js';
import { OperationsMetrics } from '../operations/operations-signals.js';
import type { SoilMetadataProvider } from '../station-data/soil-metadata.provider.js';
import type { StationDataService } from '../station-data/station-data.service.js';
import { AlertEvaluationService } from './alert-evaluation.service.js';

describe('AlertEvaluationService scheduler boundary', () => {
  it('records finite evaluator run outcomes', async () => {
    const metrics = new OperationsMetrics();
    const service = new AlertEvaluationService(
      {} as PrismaService,
      {} as StationDataService,
      {} as RuntimeConfig,
      {} as SoilMetadataProvider,
      metrics,
    );
    const internal = service as unknown as {
      runAcquiredBatch: () => Promise<{ acquired: boolean; evaluated: number }>;
    };
    vi.spyOn(internal, 'runAcquiredBatch').mockResolvedValue({ acquired: true, evaluated: 2 });

    await service.runOnce();

    expect(metrics.snapshot()).toEqual([
      { name: 'evaluator_runs_total', labels: { outcome: 'acquired' }, value: 1 },
    ]);
  });

  it('contains a rejected scheduled run and records a safe error code', async () => {
    const service = new AlertEvaluationService(
      {} as PrismaService,
      {} as StationDataService,
      {} as RuntimeConfig,
      {} as SoilMetadataProvider,
    );
    const warn = vi.fn();
    const scheduled = service as unknown as {
      logger: {
        warn: (entry: unknown) => void;
      };
      runScheduled: () => void;
    };
    Object.defineProperty(scheduled, 'logger', { value: { warn } });
    vi.spyOn(service, 'runOnce').mockRejectedValue(new TypeError('sensitive detail'));

    scheduled.runScheduled();
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledOnce();
    });

    expect(warn).toHaveBeenCalledWith({
      event: 'alert_evaluation_run_failed',
      errorCode: 'TypeError',
    });
  });
});
