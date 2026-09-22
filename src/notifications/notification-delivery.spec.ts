import { describe, expect, it, vi } from 'vitest';

import { OperationsMetrics } from '../operations/operations-signals.js';
import { deliverLifecycleNotifications } from './notification-delivery.js';

describe('notification delivery signals', () => {
  it('records delivered and skipped outcomes without recipient labels', async () => {
    const metrics = new OperationsMetrics();
    const transaction = {
      user: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'u-1' }]),
      },
      inAppNotification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };

    await deliverLifecycleNotifications(transaction as never, 'event-1', 'farm-1', metrics);
    await deliverLifecycleNotifications(transaction as never, 'event-2', 'farm-2', metrics);

    expect(metrics.snapshot()).toEqual([
      {
        name: 'notification_deliveries_total',
        labels: { outcome: 'skipped' },
        value: 1,
      },
      {
        name: 'notification_deliveries_total',
        labels: { outcome: 'delivered' },
        value: 1,
      },
    ]);
    expect(JSON.stringify(metrics.snapshot())).not.toContain('event-');
    expect(JSON.stringify(metrics.snapshot())).not.toContain('farm-');
  });
});
