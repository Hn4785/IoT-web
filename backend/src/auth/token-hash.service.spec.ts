import { TokenHashService } from './token-hash.service.js';

describe('TokenHashService', () => {
  it('creates a deterministic keyed SHA-256 digest', () => {
    const token = 'opaque-session-token';
    const first = new TokenHashService('a'.repeat(32));
    const second = new TokenHashService('b'.repeat(32));

    expect(first.hash(token)).toBe(first.hash(token));
    expect(first.hash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(first.hash(token)).not.toBe(second.hash(token));
    expect(first.hash(token)).not.toContain(token);
  });

  it('rejects empty tokens and short peppers', () => {
    expect(() => new TokenHashService('short')).toThrow();
    expect(() => new TokenHashService('a'.repeat(32)).hash('')).toThrow();
  });
});
