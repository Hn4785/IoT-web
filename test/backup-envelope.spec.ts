import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { createReadStream, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { encryptBackup, decryptBackup } from '../scripts/operations/backup-envelope.mjs';

vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  return { ...original, createReadStream: vi.fn(original.createReadStream) };
});
const originalFs = await vi.importActual<typeof import('node:fs')>('node:fs');
const manifest = {
  releaseRevision: '1a2b3c4d5e6f',
  migrationIds: ['20260830_init'],
  secretNames: ['DATA_SOURCE_ENCRYPTION_KEY'],
};

describe('authenticated portable backup', () => {
  let dir: string, keyFile: string, input: string, output: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'iot-backup-'));
    keyFile = join(dir, 'key');
    input = join(dir, 'input.dump');
    output = join(dir, 'backup.enc');
    await writeFile(keyFile, randomBytes(32).toString('base64'));
    await writeFile(input, Buffer.concat([Buffer.from('PGDMP'), randomBytes(64)]));
    vi.mocked(createReadStream).mockImplementation(originalFs.createReadStream);
  });
  afterEach(async () => {
    vi.clearAllMocks();
    // mkdtemp returns this test's exact isolated directory, never a user backup path.
    await rm(dir, { recursive: true, force: true });
  });
  const options = () => ({ input, output, keyFile, metadata: manifest });

  it('generates a separate key file without printing or replacing the key', async () => {
    const target = join(dir, 'new.key');
    const args = ['scripts/operations/backup-envelope.mjs', 'keygen', '--key-file', target];
    expect(execFileSync(process.execPath, args, { encoding: 'utf8' }).trim()).toBe(
      'SUCCESS: KEY_CREATED',
    );
    const before = await readFile(target, 'utf8');
    expect(Buffer.from(before, 'base64').length).toBe(32);
    expect(() => execFileSync(process.execPath, args, { stdio: 'pipe' })).toThrow();
    expect(await readFile(target, 'utf8')).toBe(before);
  });

  it.each([64, 256 * 1024])('streams and authenticates %i bytes', async (size) => {
    const bytes = Buffer.concat([Buffer.from('PGDMP'), randomBytes(size)]);
    await writeFile(input, bytes);
    const encrypted = await encryptBackup(options());
    const restored = join(dir, 'restored.dump');
    const result = await decryptBackup({ input: output, output: restored, keyFile });
    expect(encrypted.header.plaintext.size).toBe(bytes.length);
    expect(result.header.releaseRevision).toBe(manifest.releaseRevision);
    expect(await readFile(restored)).toEqual(bytes);
  });
  it.each(['key', 'tag', 'header', 'ciphertext', 'truncation'])(
    'rejects %s corruption without publishing plaintext',
    async (kind) => {
      await encryptBackup(options());
      const bytes = await readFile(output);
      if (kind === 'key') await writeFile(keyFile, randomBytes(32).toString('base64'));
      else if (kind === 'truncation') await writeFile(output, bytes.subarray(0, bytes.length - 10));
      else {
        const index =
          kind === 'tag' ? bytes.length - 1 : kind === 'header' ? 30 : bytes.length - 20;
        bytes[index] = (bytes[index] ?? 0) ^ 1;
        await writeFile(output, bytes);
      }
      await expect(
        decryptBackup({ input: output, output: join(dir, 'never.dump'), keyFile }),
      ).rejects.toThrow();
      const files = await readdir(dir);
      expect(files).not.toContain('never.dump');
      expect(files.some((name) => name.includes('.part.'))).toBe(false);
    },
  );
  it.each([
    { releaseRevision: 'z' },
    { leak: 'no secrets allowed' },
    { secretNames: ['UNKNOWN'] },
    { migrationIds: [] },
  ])('rejects malformed metadata %j', async (override) => {
    await expect(
      encryptBackup({ ...options(), metadata: { ...manifest, ...override } }),
    ).rejects.toThrow();
  });
  it.each(['cw==', '???'])('rejects invalid encryption key %s', async (value) => {
    await writeFile(keyFile, value);
    await expect(encryptBackup(options())).rejects.toThrow();
  });
  it('does not replace existing files or the source archive', async () => {
    const source = await readFile(input);
    await expect(encryptBackup({ ...options(), output: input })).rejects.toThrow();
    await writeFile(output, 'existing');
    await expect(encryptBackup(options())).rejects.toThrow();
    expect(await readFile(output, 'utf8')).toBe('existing');
    expect(await readFile(input)).toEqual(source);
  });
  it('fails closed when the input changes between inspection and encryption', async () => {
    vi.mocked(createReadStream)
      .mockImplementationOnce(originalFs.createReadStream)
      .mockImplementationOnce((file, opts) => {
        writeFileSync(input, Buffer.concat([Buffer.from('PGDMP'), randomBytes(64)]));
        return originalFs.createReadStream(file, opts);
      });
    await expect(encryptBackup(options())).rejects.toThrow(/Integrity/);
    expect(await readdir(dir)).not.toContain('backup.enc');
    expect((await readdir(dir)).some((name) => name.includes('.part.'))).toBe(false);
  });
  it('runs the CLI with manifest names only and fixed nonsecret output', async () => {
    const manifestFile = join(dir, 'manifest.json');
    await writeFile(manifestFile, JSON.stringify(manifest));
    const cli = (args: string[]) =>
      execFileSync(process.execPath, ['scripts/operations/backup-envelope.mjs', ...args], {
        encoding: 'utf8',
      }).trim();
    expect(
      cli([
        'encrypt',
        '--input',
        input,
        '--output',
        output,
        '--key-file',
        keyFile,
        '--manifest',
        manifestFile,
      ]),
    ).toBe('SUCCESS: ENCRYPT_COMPLETED');
    const restored = join(dir, 'cli.dump');
    expect(cli(['decrypt', '--input', output, '--output', restored, '--key-file', keyFile])).toBe(
      'SUCCESS: DECRYPT_COMPLETED',
    );
    expect(await readFile(restored)).toEqual(await readFile(input));
  });
});
