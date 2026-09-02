import { describe, expect, it } from 'vitest';

import { AuthorizationPolicy } from './authorization.policy.js';

describe('AuthorizationPolicy', () => {
  const policy = new AuthorizationPolicy();

  it.each([
    ['ADMIN', true],
    ['FARMER', true],
    ['CLIENT_DEVELOPER', false],
  ] as const)('allows %s browser principals to enter station scope checks: %s', (role, allowed) => {
    expect(policy.canUseBrowserStationData(role)).toBe(allowed);
  });

  it('limits account grants to their compatible target roles', () => {
    expect(policy.canReceiveFarmMembership('FARMER')).toBe(true);
    expect(policy.canReceiveFarmMembership('ADMIN')).toBe(false);
    expect(policy.canReceiveStationGrant('CLIENT_DEVELOPER')).toBe(true);
    expect(policy.canReceiveStationGrant('FARMER')).toBe(false);
  });
});
