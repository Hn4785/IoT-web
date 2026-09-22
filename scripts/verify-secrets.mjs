import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const tracked = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const forbiddenFiles = /(^|\/)(\.env|[^/]+\.(?:pem|key|p12|pfx|dump|backup))$/i;
const signatures = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[oprsu]_[A-Za-z0-9]{30,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];
const applicationKey = /\biot_live_[A-Za-z0-9_-]{20,}\b/;
const findings = [];

for (const path of tracked) {
  if (path === '.env.example') continue;
  if (forbiddenFiles.test(path)) {
    findings.push(`${path}: forbidden tracked secret/data file`);
    continue;
  }

  const content = readFileSync(path);
  if (content.includes(0)) continue;
  const text = content.toString('utf8');
  const hasKnownSignature = signatures.some((signature) => signature.test(text));
  const hasApplicationKey = !path.startsWith('test/') && applicationKey.test(text);
  if (hasKnownSignature || hasApplicationKey) {
    findings.push(`${path}: credential-like value detected`);
  }
}

if (findings.length > 0) {
  console.error('Secret scan failed (values are intentionally not printed):');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Secret scan passed for ${tracked.length} tracked files.`);
