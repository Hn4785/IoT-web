import { z } from 'zod';

const UTC_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

function isUtcDateTime(value: string): boolean {
  const match = UTC_DATE_TIME_PATTERN.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = ''] = match;
  const expected = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const actual = [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  ];
  const expectedMilliseconds = Number(fraction.padEnd(3, '0'));
  return (
    actual.every((part, index) => part === expected[index]) &&
    date.getUTCMilliseconds() === expectedMilliseconds
  );
}

export const utcTimestampSchema = z
  .string()
  .refine(isUtcDateTime, 'A valid UTC date-time is required');
