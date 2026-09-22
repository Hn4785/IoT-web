import { describe, expect, it, vi } from 'vitest';

import { OperationsMetrics, requestCompletionLog } from './operations-signals.js';
import { ReadinessService } from './readiness.service.js';

describe('operations signals', () => {
  it('bounds a stalled database readiness probe', async () => {
    const query = vi.fn(() => new Promise<never>(() => undefined));
    const prisma = { $queryRaw: query };
    const service = new ReadinessService(prisma as never, new OperationsMetrics(), 5);

    const results = await Promise.all([service.probe(), service.probe(), service.probe()]);

    expect(results).toEqual([
      expect.objectContaining({ status: 'unavailable' }),
      expect.objectContaining({ status: 'unavailable' }),
      expect.objectContaining({ status: 'unavailable' }),
    ]);
    expect(query).toHaveBeenCalledOnce();
  });

  it('stores only finite metric dimensions', () => {
    const metrics = new OperationsMetrics();
    metrics.recordHttp('GET', 200);
    metrics.recordHttp('POST', 403);
    metrics.recordDependencyFailure('database');
    metrics.recordEvaluatorRun('acquired');
    metrics.recordNotificationDelivery('delivered');

    expect(metrics.snapshot()).toEqual([
      { name: 'http_requests_total', labels: { method: 'GET', status: '2xx' }, value: 1 },
      { name: 'http_requests_total', labels: { method: 'POST', status: '4xx' }, value: 1 },
      { name: 'authentication_failures_total', labels: { status: '403' }, value: 1 },
      { name: 'dependency_failures_total', labels: { dependency: 'database' }, value: 1 },
      { name: 'evaluator_runs_total', labels: { outcome: 'acquired' }, value: 1 },
      {
        name: 'notification_deliveries_total',
        labels: { outcome: 'delivered' },
        value: 1,
      },
    ]);
    expect(JSON.stringify(metrics.snapshot())).not.toContain('/api/');
  });

  it('builds a structured request log from allowlisted fields only', () => {
    expect(requestCompletionLog('request-1', 'GET', 204)).toEqual({
      event: 'http_request_completed',
      requestId: 'request-1',
      method: 'GET',
      statusCode: 204,
    });
  });
});
