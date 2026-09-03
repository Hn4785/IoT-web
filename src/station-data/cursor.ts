import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';

const uuid = z.uuid();
const name = z.string().min(1).max(160);
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);

const cursorPayloadSchema = z.discriminatedUnion('kind', [
  z.strictObject({ v: z.literal(1), kind: z.literal('farm'), name, id: uuid }),
  z.strictObject({
    v: z.literal(1),
    kind: z.literal('plot'),
    parentId: uuid,
    name,
    id: uuid,
  }),
  z.strictObject({
    v: z.literal(1),
    kind: z.literal('station'),
    parentId: uuid,
    name,
    id: uuid,
  }),
  z.strictObject({ v: z.literal(1), kind: z.literal('client-station'), name, id: uuid }),
  z.strictObject({
    v: z.literal(1),
    kind: z.literal('soil-history'),
    queryFingerprint: fingerprint,
    boundaryTime: z.iso.datetime({ offset: true }),
    boundaryFingerprint: fingerprint,
    boundaryOccurrence: z.number().int().min(1).max(5000),
  }),
]);

export type CursorPayload = z.infer<typeof cursorPayloadSchema>;
export type CursorKind = CursorPayload['kind'];

const invalidCursor = (): AppError =>
  new AppError('VALIDATION_ERROR', 400, 'Cursor is invalid');

export function encodeCursor(value: CursorPayload): string {
  const parsed = cursorPayloadSchema.safeParse(value);
  if (!parsed.success) throw invalidCursor();

  const encoded = Buffer.from(JSON.stringify(parsed.data), 'utf8').toString('base64url');
  if (encoded.length > 2048) throw invalidCursor();
  return encoded;
}

export function decodeCursor<K extends CursorKind>(
  value: string,
  expectedKind: K,
): Extract<CursorPayload, { kind: K }> {
  try {
    if (value.length < 1 || value.length > 2048) throw invalidCursor();
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = cursorPayloadSchema.safeParse(JSON.parse(decoded));
    if (!parsed.success || parsed.data.kind !== expectedKind) throw invalidCursor();
    return parsed.data as Extract<CursorPayload, { kind: K }>;
  } catch {
    throw invalidCursor();
  }
}
