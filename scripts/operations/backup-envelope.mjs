import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAGIC = Buffer.from('IOTBKP01', 'ascii');
const ALLOWED_SECRETS = new Set(['DATA_SOURCE_ENCRYPTION_KEY', 'CREDENTIAL_PEPPER', 'JWT_SECRET']);
const isHex = (s) => typeof s === 'string' && /^[0-9a-fA-F]{7,64}$/.test(s);
const isIdList = (a) =>
  Array.isArray(a) &&
  a.length > 0 &&
  a.every((x) => typeof x === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(x));
const validDate = (d) => typeof d === 'string' && !isNaN(Date.parse(d));
const validSecrets = (s) => Array.isArray(s) && s.every((x) => ALLOWED_SECRETS.has(x));

async function loadKey(keyFile) {
  if (!keyFile) throw new Error('Key file required');
  const raw = (await fs.readFile(keyFile, 'utf8')).trim();
  const buf = Buffer.from(raw, 'base64');
  if (!/^[A-Za-z0-9+/]{43}=$/.test(raw) || buf.length !== 32 || buf.toString('base64') !== raw) {
    throw new Error('Invalid key');
  }
  return buf;
}

async function checkOutput(inPath, outPath) {
  if (path.resolve(inPath) === path.resolve(outPath)) throw new Error('Same input/output');
  const st = await fs.lstat(outPath).catch((e) => (e.code === 'ENOENT' ? null : Promise.reject(e)));
  if (st) throw new Error('Output exists or symlink');
}

async function publishStream(inStream, transforms, destFile) {
  const r = path.resolve(destFile);
  const part = path.join(
    path.dirname(r),
    `.${path.basename(r)}.part.${crypto.randomBytes(6).toString('hex')}`,
  );
  const out = createWriteStream(part, { flags: 'wx', mode: 0o600 });
  try {
    await pipeline(inStream, ...transforms, out);
    await fs.link(part, destFile);
  } finally {
    await fs.unlink(part).catch(() => {});
  }
}

function createStreamInspector(expectedHeader) {
  let checked = false,
    buf = Buffer.alloc(0),
    bytes = 0;
  const hash = crypto.createHash('sha256');
  const t = new Transform({
    transform(chunk, _, cb) {
      bytes += chunk.length;
      hash.update(chunk);
      if (!checked) {
        buf = Buffer.concat([buf, chunk]);
        if (buf.length >= 5) {
          if (buf.subarray(0, 5).toString('ascii') !== 'PGDMP')
            return cb(new Error('Missing PGDMP signature'));
          checked = true;
        }
      }
      cb(null, expectedHeader ? chunk : undefined);
    },
    flush(cb) {
      if (!checked || bytes < 5) return cb(new Error('Missing PGDMP signature'));
      if (expectedHeader) {
        const pt = expectedHeader.plaintext;
        if (bytes !== pt.size || hash.digest('hex') !== pt.sha256)
          return cb(new Error('Integrity failed'));
      }
      cb();
    },
  });
  t.result = () => ({ size: bytes, sha256: hash.digest('hex') });
  return t;
}

function validateMeta(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid manifest');
  if (
    Object.keys(raw).some((k) => !['releaseRevision', 'migrationIds', 'secretNames'].includes(k))
  ) {
    throw new Error('Disallowed manifest field');
  }
  if (!isHex(raw.releaseRevision)) throw new Error('Invalid releaseRevision');
  if (!isIdList(raw.migrationIds)) throw new Error('Invalid migrationIds');
  const secrets = raw.secretNames ?? [...ALLOWED_SECRETS];
  if (!validSecrets(secrets)) throw new Error('Invalid secretNames');
  return {
    releaseRevision: raw.releaseRevision,
    migrationIds: raw.migrationIds,
    secretNames: secrets,
  };
}

function validateHeader(h) {
  if (!h || typeof h !== 'object') throw new Error('Invalid header');
  const allowed = new Set([
    'schemaVersion',
    'createdAt',
    'releaseRevision',
    'migrationIds',
    'secretNames',
    'plaintext',
  ]);
  if (Object.keys(h).some((k) => !allowed.has(k))) throw new Error('Disallowed header field');
  if (h.schemaVersion !== 1 || !validDate(h.createdAt)) throw new Error('Invalid header version');
  if (!isHex(h.releaseRevision)) throw new Error('Invalid header revision');
  if (!isIdList(h.migrationIds)) throw new Error('Invalid header migrations');
  if (!validSecrets(h.secretNames)) throw new Error('Invalid header secrets');
  const pt = h.plaintext;
  if (
    !pt ||
    typeof pt !== 'object' ||
    Object.keys(pt).some((k) => k !== 'size' && k !== 'sha256')
  ) {
    throw new Error('Invalid header plaintext');
  }
  if (!Number.isSafeInteger(pt.size) || pt.size < 5 || !/^[0-9a-fA-F]{64}$/.test(pt.sha256 || '')) {
    throw new Error('Invalid plaintext size/sha256');
  }
}

export async function encryptBackup(opts) {
  const { input, output } = opts;
  await checkOutput(input, output);
  const key = await loadKey(opts.keyFile);
  let meta = opts.metadata ?? opts.manifest;
  if (typeof meta === 'string') {
    meta = JSON.parse(meta.trim().startsWith('{') ? meta : await fs.readFile(meta, 'utf8'));
  }
  const cleanMeta = validateMeta(meta);

  const inStat = await fs.stat(input);
  if (!inStat.isFile() || inStat.size < 5) throw new Error('Input is not a pg_dump archive');
  const inspector = createStreamInspector(null);
  await pipeline(createReadStream(input), inspector);

  const header = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    ...cleanMeta,
    plaintext: inspector.result(),
  };
  const headerBuf = Buffer.from(JSON.stringify(header), 'utf8');
  if (headerBuf.length > 16384) throw new Error('Header exceeds 16KiB limit');

  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(headerBuf);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(headerBuf.length);
  const prefix = Buffer.concat([MAGIC, nonce, lenBuf, headerBuf]);

  let started = false;
  const cipherStream = new Transform({
    transform(c, _, cb) {
      if (!started) {
        this.push(prefix);
        started = true;
      }
      const enc = cipher.update(c);
      if (enc.length) this.push(enc);
      cb();
    },
    flush(cb) {
      if (!started) this.push(prefix);
      const fin = cipher.final();
      if (fin.length) this.push(fin);
      this.push(cipher.getAuthTag());
      cb();
    },
  });

  // Recheck the bytes actually encrypted: the dump may have changed after inspection.
  await publishStream(
    createReadStream(input),
    [createStreamInspector(header), cipherStream],
    output,
  );
  return { header, outputPath: path.resolve(output) };
}

export async function decryptBackup(opts) {
  const { input, output } = opts;
  await checkOutput(input, output);
  const key = await loadKey(opts.keyFile);

  const inStat = await fs.stat(input);
  if (!inStat.isFile() || inStat.size < 40) throw new Error('Envelope truncated or invalid');

  const fd = await fs.open(input, 'r');
  let nonce, headerBuf, tag, headerLen;
  try {
    const pref = (await fd.read(Buffer.alloc(24), 0, 24, 0)).buffer;
    if (!pref.subarray(0, 8).equals(MAGIC)) throw new Error('Invalid envelope magic');
    nonce = pref.subarray(8, 20);
    headerLen = pref.readUInt32BE(20);
    if (headerLen < 2 || headerLen > 16384 || inStat.size < 24 + headerLen + 16) {
      throw new Error('Invalid envelope header length or truncated');
    }
    headerBuf = (await fd.read(Buffer.alloc(headerLen), 0, headerLen, 24)).buffer;
    tag = (await fd.read(Buffer.alloc(16), 0, 16, inStat.size - 16)).buffer;
  } finally {
    await fd.close();
  }

  const header = JSON.parse(headerBuf.toString('utf8'));
  validateHeader(header);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(headerBuf);
  decipher.setAuthTag(tag);

  const inspector = createStreamInspector(header);
  await publishStream(
    createReadStream(input, { start: 24 + headerLen, end: inStat.size - 17 }),
    [decipher, inspector],
    output,
  );
  return { header, outputPath: path.resolve(output) };
}

function parseCli(argv) {
  const [cmd, ...rest] = argv;
  if (cmd === 'keygen') {
    return rest.length === 2 && rest[0] === '--key-file' && rest[1]
      ? { command: cmd, keyFile: rest[1] }
      : null;
  }
  if (cmd !== 'encrypt' && cmd !== 'decrypt') return null;
  const res = { command: cmd };
  for (let i = 0; i < rest.length; i += 2) {
    const k = rest[i].replace(/^--/, '');
    if (!['input', 'output', 'key-file', 'manifest'].includes(k)) return null;
    res[k === 'key-file' ? 'keyFile' : k] = rest[i + 1];
  }
  return res.input && res.output && res.keyFile && (cmd !== 'encrypt' || res.manifest) ? res : null;
}

async function main() {
  const parsed = parseCli(process.argv.slice(2));
  if (!parsed) {
    console.error('FAILURE: INVALID_ARGUMENTS');
    process.exit(1);
  }
  try {
    if (parsed.command === 'keygen') {
      await fs.writeFile(parsed.keyFile, crypto.randomBytes(32).toString('base64'), {
        flag: 'wx',
        mode: 0o600,
      });
      console.log('SUCCESS: KEY_CREATED');
      return;
    }
    const isEnc = parsed.command === 'encrypt';
    await (isEnc ? encryptBackup(parsed) : decryptBackup(parsed));
    console.log(isEnc ? 'SUCCESS: ENCRYPT_COMPLETED' : 'SUCCESS: DECRYPT_COMPLETED');
    process.exit(0);
  } catch (err) {
    const m = (err?.message || '').toLowerCase();
    const c = (s) => m.includes(s) || err?.code === s.toUpperCase();
    const fail = (cat) => {
      console.error(cat);
      process.exit(1);
    };
    if (c('output exists') || c('eexist')) fail('FAILURE: OUTPUT_EXISTS');
    if (c('invalid key')) fail('FAILURE: INVALID_KEY');
    if (c('pgdmp')) fail('FAILURE: INVALID_INPUT');
    if (c('manifest') || c('release') || c('migration') || c('secret'))
      fail('FAILURE: INVALID_MANIFEST');
    if (c('auth') || c('integrity') || c('truncated') || c('magic'))
      fail('FAILURE: AUTHENTICATION_FAILED');
    fail('FAILURE: OPERATION_FAILED');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
