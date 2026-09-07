import { ArgumentsHost, HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { HttpErrorFilter } from './http-error.filter.js';

const createHost = (
  requestId: string,
  reply: { status: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> },
) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ id: requestId }),
      getResponse: () => reply,
    }),
  }) as unknown as ArgumentsHost;

describe('HttpErrorFilter', () => {
  it('maps a generic 400 HttpException to VALIDATION_ERROR', () => {
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    new HttpErrorFilter().catch(
      new HttpException('Bad Request', 400),
      createHost('req-123', reply),
    );

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'An unexpected error occurred' },
      requestId: 'req-123',
    });
  });

  it('keeps a generic 403 HttpException as INTERNAL_ERROR', () => {
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    new HttpErrorFilter().catch(new HttpException('Forbidden', 403), createHost('req-456', reply));

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      requestId: 'req-456',
    });
  });
});
