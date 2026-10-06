import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('CI Packaging and Workflows', () => {
  const ciPath = path.join(process.cwd(), '.github/workflows/backend-ci.yml');
  const imagesPath = path.join(process.cwd(), '.github/workflows/backend-images.yml');

  it('workflow files exist', () => {
    expect(fs.existsSync(ciPath)).toBe(true);
    expect(fs.existsSync(imagesPath)).toBe(true);
  });

  it('pins official GitHub Actions and container digests correctly', () => {
    const ciContent = fs.readFileSync(ciPath, 'utf8');
    const imagesContent = fs.readFileSync(imagesPath, 'utf8');

    const CHECKOUT_SHA = '11d5960a326750d5838078e36cf38b85af677262';
    const SETUP_NODE_SHA = '49933ea5288caeca8642d1e84afbd3f7d6820020';
    const PNPM_SETUP_SHA = 'f40ffcd9367d9f12939873eb1018b921a783ffaa';
    const PG_DIGEST = 'ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94';

    expect(ciContent).toContain(CHECKOUT_SHA);
    expect(ciContent).toContain(SETUP_NODE_SHA);
    expect(ciContent).toContain(PNPM_SETUP_SHA);

    expect(imagesContent).toContain(CHECKOUT_SHA);
    expect(imagesContent).toContain(SETUP_NODE_SHA);
    expect(imagesContent).toContain(PNPM_SETUP_SHA);
    expect(imagesContent).toContain(PG_DIGEST);
  });

  it('contains mandatory CI quality gates, test:coverage, audit, secrets, and release:check', () => {
    const ciContent = fs.readFileSync(ciPath, 'utf8');
    expect(ciContent).toContain('pnpm test:coverage');
    expect(ciContent).toContain('pnpm audit');
    expect(ciContent).toContain('pnpm security:secrets');
    expect(ciContent).toContain('pnpm release:check');
  });

  it('contains matrix on both platforms and TEST_DATABASE_URL in images workflow', () => {
    const imagesContent = fs.readFileSync(imagesPath, 'utf8');
    expect(imagesContent).toContain('ubuntu-24.04');
    expect(imagesContent).toContain('ubuntu-24.04-arm');
    expect(imagesContent).toContain('TEST_DATABASE_URL');
    expect(imagesContent).toContain('iot-backend-tools pnpm db:migrate:deploy');
    expect(imagesContent).not.toMatch(/^\s+pnpm db:migrate:deploy$/m);
    expect(imagesContent).toContain('/api/v1/readiness');
    expect(imagesContent).toContain('id -u');
  });

  it('requires every postgres pg_isready command in images workflow to use TCP host 127.0.0.1 before createdb with timeout', () => {
    const imagesContent = fs.readFileSync(imagesPath, 'utf8');
    const probeLines = imagesContent.split('\n').filter((line) => /\bpg_isready\b/.test(line));
    expect(probeLines.length).toBeGreaterThan(0);
    for (const line of probeLines) {
      expect(line).toMatch(/-h\s*127\.0\.0\.1/);
    }
    const loopIndex = imagesContent.indexOf('for attempt in {1..30}; do');
    const probeIndex = imagesContent.indexOf('pg_isready');
    const timeoutIndex = imagesContent.indexOf('if [ $attempt -eq 30 ]; then exit 1; fi');
    const createdbIndex = imagesContent.indexOf('docker exec iot-postgres-ci createdb');
    expect(loopIndex).toBeGreaterThan(0);
    expect(probeIndex).toBeGreaterThan(loopIndex);
    expect(timeoutIndex).toBeGreaterThan(probeIndex);
    expect(createdbIndex).toBeGreaterThan(timeoutIndex);
  });

  it('publishes only the smoke-verified runtime with its commit tag and checksum', () => {
    const content = fs.readFileSync(imagesPath, 'utf8');
    const smoke = content.indexOf('test "$(docker exec iot-api-smoke id -u)" = 1000');
    const tag = content.indexOf('docker tag iot-backend-runtime agrisense-api:${{ github.sha }}');
    const save = content.indexOf('docker save agrisense-api:${{ github.sha }} | gzip');
    const upload = content.indexOf(
      'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
    );
    expect(smoke).toBeGreaterThan(0);
    expect(tag).toBeGreaterThan(smoke);
    expect(save).toBeGreaterThan(tag);
    expect(upload).toBeGreaterThan(save);
    expect(content.indexOf('- name: Cleanup CI container and network')).toBeGreaterThan(upload);
    expect(
      content.match(/if: github.event_name == 'push' && github.ref == 'refs\/heads\/BE'/g),
    ).toHaveLength(2);
    expect(content).toContain('pull_request:');
    expect(content).toContain('runtime-artifact/runtime.tar.gz');
    expect(content).toContain('runtime-artifact/SHA256SUMS');
    expect(content).toContain('sha256sum runtime.tar.gz > SHA256SUMS');
    expect(content).toContain('name: runtime-${{ matrix.os }}-${{ github.sha }}');
    expect(content).toContain('retention-days: 3');
    expect(content).toContain('if-no-files-found: error');
    expect(content).toContain('compression-level: 0');
    expect(content).not.toContain('docker save iot-backend-tools');
  });
});
