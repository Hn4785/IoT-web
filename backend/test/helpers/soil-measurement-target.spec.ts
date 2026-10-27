import { describe, expect, it } from 'vitest';
import { requireLocalMeasurementTarget } from './soil-measurement-target.js';

describe('opt-in soil measurement database target guard', () => {
  it.each([
    'postgresql://tester:fixture@localhost:5432/iot_test?schema=public',
    'postgres://tester:fixture@127.0.0.1/iot_test',
  ])('accepts only the isolated local database: %s', (url) => {
    expect(requireLocalMeasurementTarget(url).pathname).toBe('/iot_test');
  });
  it.each([
    undefined,
    'invalid',
    'postgresql://tester:fixture@remote.example/iot_test',
    'postgresql://tester:fixture@localhost/iot_dev',
    'postgresql://tester:fixture@localhost:5433/iot_test',
    'http://tester:fixture@localhost/iot_test',
    'postgresql://tester:fixture@localhost/iot_test?host=remote.example',
    'postgresql://tester:fixture@localhost/iot_test?dbname=iot_dev',
    'postgresql://tester:fixture@localhost/iot_test?schema=public&port=5433',
    'postgresql://tester:fixture@localhost/iot_test?schema=other',
    'postgresql://tester:fixture@localhost/iot_test#fragment',
  ])('rejects overrides without leaking connection input (%#)', (url) => {
    expect(() => requireLocalMeasurementTarget(url)).toThrow(
      'Measurement requires local PostgreSQL iot_test on port 5432 without connection overrides',
    );
  });
});
