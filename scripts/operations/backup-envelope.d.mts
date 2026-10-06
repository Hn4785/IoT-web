export interface BackupHeader {
  schemaVersion: 1;
  createdAt: string;
  releaseRevision: string;
  migrationIds: string[];
  secretNames: string[];
  plaintext: { size: number; sha256: string };
}
export interface BackupOptions {
  input: string;
  output: string;
  keyFile: string;
  metadata?: unknown;
  manifest?: unknown;
}
export function encryptBackup(
  options: BackupOptions,
): Promise<{ header: BackupHeader; outputPath: string }>;
export function decryptBackup(
  options: BackupOptions,
): Promise<{ header: BackupHeader; outputPath: string }>;
