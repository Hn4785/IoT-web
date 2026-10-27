import { randomUUID } from 'node:crypto';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function selectRequestId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;

  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}
