import { describe, expect, it } from 'vitest';

import { sanitizeAuditMetadata } from './security-audit.service.js';

describe('sanitizeAuditMetadata', () => {
  it('redacts credential-shaped fields recursively while retaining safe identifiers', () => {
    expect(
      sanitizeAuditMetadata({
        currentPassword: 'secret-value',
        nested: { refreshToken: 'token-value', stationCount: 2 },
        previousApiKeyId: 'safe-key-id',
      }),
    ).toEqual({
      currentPassword: '[REDACTED]',
      nested: { refreshToken: '[REDACTED]', stationCount: 2 },
      previousApiKeyId: 'safe-key-id',
    });
  });
});
