import { describe, expect, it } from 'vitest';

import { makeTestRuntimeConfig } from '../../test/helpers/runtime-config.js';
import { SourceSecretService } from './source-secret.service.js';

describe('SourceSecretService', () => {
  const config = makeTestRuntimeConfig({
    dataSourceEncryptionKey: Buffer.alloc(32, 19),
  });

  it('round trips a secret without storing plaintext', () => {
    const service = new SourceSecretService(config);
    const encrypted = service.encrypt('provider-secret');

    expect(encrypted.ciphertext).not.toContain('provider-secret');
    expect(service.decrypt(encrypted)).toBe('provider-secret');
  });

  it('uses a fresh nonce for each encryption', () => {
    const service = new SourceSecretService(config);

    expect(service.encrypt('same-secret')).not.toEqual(service.encrypt('same-secret'));
  });

  it('rejects tampered ciphertext', () => {
    const service = new SourceSecretService(config);
    const encrypted = service.encrypt('provider-secret');
    const tampered = {
      ...encrypted,
      ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA`,
    };

    expect(() => service.decrypt(tampered)).toThrow('Stored source credential is invalid');
  });
});
