import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('tooling', () => {
  it('executes TypeScript tests', () => {
    expect(2 + 2).toBe(4);
  });
  it('excludes generated acceptance artifacts without excluding source tests from lint', () => {
    const config = readFileSync(new URL('../eslint.config.mjs', import.meta.url), 'utf8');
    expect(config).toContain('artifacts/**');
    expect(config).not.toContain('test/**');
  });
});
