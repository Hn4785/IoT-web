import { describe, expect, it } from 'vitest';

import { evaluateAlertSample } from './alert-evaluator.js';

const initial = {
  lastObservedAt: null,
  consecutiveBreachCount: 0,
  consecutiveRecoveryCount: 0,
};

describe('evaluateAlertSample', () => {
  it('opens only after two distinct breached samples', () => {
    const first = evaluateAlertSample(
      { operator: 'ABOVE', threshold: 30 },
      initial,
      { observedAt: new Date('2026-09-16T00:00:00Z'), value: 31, usable: true },
      false,
    );
    expect(first).toMatchObject({ accepted: true, breachCount: 1, action: 'NONE' });
    const second = evaluateAlertSample(
      { operator: 'ABOVE', threshold: 30 },
      { ...initial, lastObservedAt: new Date('2026-09-16T00:00:00Z'), consecutiveBreachCount: 1 },
      { observedAt: new Date('2026-09-16T00:01:00Z'), value: 32, usable: true },
      false,
    );
    expect(second).toMatchObject({ breachCount: 2, action: 'OPEN' });
  });

  it('resolves only after two distinct normal samples', () => {
    const result = evaluateAlertSample(
      { operator: 'BELOW', threshold: 20 },
      {
        lastObservedAt: new Date('2026-09-16T00:00:00Z'),
        consecutiveBreachCount: 0,
        consecutiveRecoveryCount: 1,
      },
      { observedAt: new Date('2026-09-16T00:01:00Z'), value: 25, usable: true },
      true,
    );
    expect(result).toMatchObject({ recoveryCount: 2, action: 'RESOLVE' });
  });

  it.each([
    { observedAt: new Date('2026-09-16T00:00:00Z'), value: 31, usable: true },
    { observedAt: new Date('2026-09-15T23:59:00Z'), value: 31, usable: true },
    { observedAt: new Date('2026-09-16T00:01:00Z'), value: 31, usable: false },
    { observedAt: new Date('2026-09-16T00:01:00Z'), value: Number.NaN, usable: true },
  ])('does not advance duplicate, older, unusable or invalid samples', (sample) => {
    const result = evaluateAlertSample(
      { operator: 'ABOVE', threshold: 30 },
      {
        lastObservedAt: new Date('2026-09-16T00:00:00Z'),
        consecutiveBreachCount: 1,
        consecutiveRecoveryCount: 0,
      },
      sample,
      false,
    );
    expect(result).toMatchObject({ accepted: false, breachCount: 1, action: 'NONE' });
  });
});
