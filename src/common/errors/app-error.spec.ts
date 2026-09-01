import { AppError } from './app-error.js';

describe('AppError serialization', () => {
  it('exposes only safe public fields', () => {
    const cause = new Error('private upstream detail');
    const error = new AppError('UPSTREAM_UNAVAILABLE', 502, 'Weather service is unavailable', {
      cause,
    });

    expect(error.toJSON()).toEqual({
      code: 'UPSTREAM_UNAVAILABLE',
      statusCode: 502,
      safeMessage: 'Weather service is unavailable',
    });
    expect(JSON.stringify(error)).not.toContain('private upstream detail');
    expect(JSON.stringify(error)).not.toContain('stack');
  });
});
