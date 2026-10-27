import type { AlertCondition } from './alert-rule.contracts.js';

export type EvaluationState = Readonly<{
  lastObservedAt: Date | null;
  consecutiveBreachCount: number;
  consecutiveRecoveryCount: number;
}>;

export type EvaluationSample = Readonly<{
  observedAt: Date;
  value: number;
  usable: boolean;
}>;

export type EvaluationDecision = Readonly<{
  accepted: boolean;
  result: 'BREACH' | 'NORMAL' | 'IGNORED';
  action: 'OPEN' | 'RESOLVE' | 'NONE';
  breachCount: number;
  recoveryCount: number;
}>;

export function evaluateAlertSample(
  condition: AlertCondition,
  state: EvaluationState,
  sample: EvaluationSample,
  hasUnresolvedAlert: boolean,
): EvaluationDecision {
  if (
    !sample.usable ||
    !Number.isFinite(sample.value) ||
    (state.lastObservedAt !== null && sample.observedAt <= state.lastObservedAt)
  ) {
    return {
      accepted: false,
      result: 'IGNORED',
      action: 'NONE',
      breachCount: state.consecutiveBreachCount,
      recoveryCount: state.consecutiveRecoveryCount,
    };
  }

  const breached = isBreached(condition, sample.value);
  const breachCount = breached ? state.consecutiveBreachCount + 1 : 0;
  const recoveryCount = breached ? 0 : state.consecutiveRecoveryCount + 1;
  return {
    accepted: true,
    result: breached ? 'BREACH' : 'NORMAL',
    action:
      breached && !hasUnresolvedAlert && breachCount >= 2
        ? 'OPEN'
        : !breached && hasUnresolvedAlert && recoveryCount >= 2
          ? 'RESOLVE'
          : 'NONE',
    breachCount,
    recoveryCount,
  };
}

function isBreached(condition: AlertCondition, value: number): boolean {
  switch (condition.operator) {
    case 'ABOVE':
      return value > condition.threshold;
    case 'BELOW':
      return value < condition.threshold;
    case 'OUTSIDE_RANGE':
      return value < condition.lowerThreshold || value > condition.upperThreshold;
  }
}
