import { z } from 'zod';

const stationCode = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const fieldName = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/);
const measurement = z.enum(['weather', 'water', 'soil']);

const uniqueList = <T extends z.ZodType<string>>(item: T) =>
  z
    .array(item)
    .max(100)
    .refine((items) => new Set(items).size === items.length, 'duplicates are not allowed');

const latestWeatherQuerySchema = z.strictObject({
  station: uniqueList(stationCode).optional(),
  type: uniqueList(measurement).optional(),
  fields: uniqueList(fieldName).optional(),
});

const utcTimestamp = z
  .string()
  .refine(
    (value) => value.endsWith('Z') && !Number.isNaN(Date.parse(value)),
    'UTC timestamp required',
  );

const weatherHistoryQuerySchema = latestWeatherQuerySchema
  .extend({
    begin: utcTimestamp.optional(),
    end: utcTimestamp.optional(),
    limit: z.number().int().min(1).max(5000).default(100),
    order: z.enum(['asc', 'desc']).default('desc'),
    interval: z.enum(['raw', '1m', '5m', '10m', '30m', '1h', '6h', '1d', '1w']).default('raw'),
    aggregate: z.enum(['mean', 'min', 'max', 'first', 'last', 'sum', 'count']).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.interval === 'raw' && value.aggregate !== undefined) {
      context.addIssue({ code: 'custom', path: ['aggregate'], message: 'raw rejects aggregate' });
    }
    if (value.interval !== 'raw' && value.aggregate === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['aggregate'],
        message: 'aggregate is required for non-raw intervals',
      });
    }
  })
  .refine(
    (value) => !value.begin || !value.end || Date.parse(value.begin) <= Date.parse(value.end),
    { path: ['begin'], message: 'begin must not be after end' },
  );

const timestampMs = z.number().int().nonnegative();
const dynamicValue = z.union([z.number(), z.string(), z.boolean(), z.null()]);
const fieldTimestamps = z.record(fieldName, timestampMs);
const latestMeasurement = z
  .object({
    ts: timestampMs,
    time: utcTimestamp,
    _fieldTs: fieldTimestamps,
  })
  .catchall(dynamicValue);
const historyRecord = z.object({ ts: timestampMs, time: utcTimestamp }).catchall(dynamicValue);
const latestByType = z.partialRecord(measurement, latestMeasurement);
const historyByType = z.partialRecord(measurement, z.array(historyRecord));
const successEnvelope = <T extends z.ZodType>(data: T) =>
  z.object({ success: z.literal(true), data }).strict();
const healthResponseSchema = successEnvelope(
  z
    .object({
      service: z.string(),
      version: z.string(),
      status: z.string(),
      environment: z.string(),
      ts: timestampMs,
      time: utcTimestamp,
    })
    .strict(),
);
const stationsResponseSchema = successEnvelope(z.array(stationCode));
const latestResponseSchema = successEnvelope(
  z.array(z.object({ station: stationCode, latest: latestByType }).strict()),
);
const historyResponseSchema = successEnvelope(
  z.array(z.object({ station: stationCode, history: historyByType }).strict()),
);
const failureResponseSchema = z
  .object({ success: z.literal(false), message: z.string().min(1) })
  .strict();

export type LatestWeatherQuery = z.infer<typeof latestWeatherQuerySchema>;
export type WeatherHistoryQuery = z.infer<typeof weatherHistoryQuerySchema>;
export type WeatherHealth = z.infer<typeof healthResponseSchema>['data'];
export type WeatherLatestStation = z.infer<typeof latestResponseSchema>['data'][number];
export type WeatherHistoryStation = z.infer<typeof historyResponseSchema>['data'][number];

export const parseLatestWeatherQuery = (input: unknown) => latestWeatherQuerySchema.parse(input);
export const parseWeatherHistoryQuery = (input: unknown) => weatherHistoryQuerySchema.parse(input);
export const parseWeatherHealthResponse = (input: unknown) => healthResponseSchema.parse(input);
export const parseWeatherStationsResponse = (input: unknown) => stationsResponseSchema.parse(input);
export const parseWeatherLatestResponse = (input: unknown) => latestResponseSchema.parse(input);
export const parseWeatherHistoryResponse = (input: unknown) => historyResponseSchema.parse(input);
export const parseWeatherFailureResponse = (input: unknown) => failureResponseSchema.parse(input);
