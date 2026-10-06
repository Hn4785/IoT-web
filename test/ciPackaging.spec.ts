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
});
