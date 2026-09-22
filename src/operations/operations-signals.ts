import { Injectable } from '@nestjs/common';

type HttpMethod = 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT' | 'OTHER';
type HttpStatusClass = '1xx' | '2xx' | '3xx' | '4xx' | '5xx';
type Dependency = 'database' | 'weather';
type EvaluatorOutcome = 'acquired' | 'skipped' | 'failed';
type NotificationOutcome = 'delivered' | 'skipped' | 'failed';

export type MetricSample = Readonly<{
  name:
    | 'authentication_failures_total'
    | 'dependency_failures_total'
    | 'evaluator_runs_total'
    | 'http_requests_total'
    | 'notification_deliveries_total';
  labels: Readonly<Record<string, string>>;
  value: number;
}>;

const HTTP_METHODS = new Set<HttpMethod>([
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
]);

function httpMethod(value: string): HttpMethod {
  const normalized = value.toUpperCase() as HttpMethod;
  return HTTP_METHODS.has(normalized) ? normalized : 'OTHER';
}

function httpStatusClass(statusCode: number): HttpStatusClass {
  const firstDigit = Math.min(5, Math.max(1, Math.floor(statusCode / 100)));
  return `${String(firstDigit)}xx` as HttpStatusClass;
}

@Injectable()
export class OperationsMetrics {
  private readonly counters = new Map<string, MetricSample>();

  recordHttp(method: string, statusCode: number): void {
    this.increment('http_requests_total', {
      method: httpMethod(method),
      status: httpStatusClass(statusCode),
    });
    if (statusCode === 401 || statusCode === 403) {
      this.increment('authentication_failures_total', { status: String(statusCode) });
    }
  }

  recordDependencyFailure(dependency: Dependency): void {
    this.increment('dependency_failures_total', { dependency });
  }

  recordEvaluatorRun(outcome: EvaluatorOutcome): void {
    this.increment('evaluator_runs_total', { outcome });
  }

  recordNotificationDelivery(outcome: NotificationOutcome): void {
    this.increment('notification_deliveries_total', { outcome });
  }

  snapshot(): readonly MetricSample[] {
    return [...this.counters.values()].map((sample) => ({
      ...sample,
      labels: { ...sample.labels },
    }));
  }

  private increment(name: MetricSample['name'], labels: Record<string, string>): void {
    const key = `${name}:${JSON.stringify(labels)}`;
    const current = this.counters.get(key);
    this.counters.set(key, { name, labels, value: (current?.value ?? 0) + 1 });
  }
}

export function requestCompletionLog(requestId: string, method: string, statusCode: number) {
  return {
    event: 'http_request_completed' as const,
    requestId: requestId.slice(0, 128),
    method: httpMethod(method),
    statusCode,
  };
}
