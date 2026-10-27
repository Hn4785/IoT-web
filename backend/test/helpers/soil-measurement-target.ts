export function requireLocalMeasurementTarget(value: string | undefined): URL {
  try {
    const target = new URL(value ?? '');
    if (
      !['postgresql:', 'postgres:'].includes(target.protocol) ||
      target.pathname !== '/iot_test' ||
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      (target.port || '5432') !== '5432' ||
      !target.username ||
      target.hash ||
      [...target.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')
    )
      throw new Error('Invalid measurement target');
    return target;
  } catch {
    // Invalid URL diagnostics must not print database credentials.
    throw new Error(
      'Measurement requires local PostgreSQL iot_test on port 5432 without connection overrides',
    );
  }
}
