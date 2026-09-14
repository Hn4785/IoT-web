interface ClipboardWriter {
  writeText(value: string): Promise<void>;
}

export function normalizeApiKey(value: string): string {
  return value.trim();
}

export async function copyText(
  value: string,
  clipboard: ClipboardWriter | undefined = globalThis.navigator?.clipboard,
): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
