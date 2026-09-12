import { ArgumentsHost, HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
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
      error: { code: 'VALIDATION_ERROR', message: 'Request is invalid' },
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

  it.each([
    [413, 'Request body is too large'],
    [415, 'Content type is not supported'],
  ] as const)('maps HTTP %i to a safe validation error', (status, message) => {
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    new HttpErrorFilter().catch(
      new HttpException('unsafe framework detail', status),
      createHost('req-boundary', reply),
    );

    expect(reply.status).toHaveBeenCalledWith(status);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: { code: 'VALIDATION_ERROR', message },
      requestId: 'req-boundary',
    });
  });

  it.each(['P1001', 'P1002', 'P1008', 'P1017', 'ECONNREFUSED'])(
    'maps verified database connectivity error %s to a safe 503',
    (databaseCode) => {
      const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };
      const error = new Prisma.PrismaClientKnownRequestError('secret database failure', {
        code: databaseCode,
        clientVersion: '7.10.0',
      });

      new HttpErrorFilter().catch(error, createHost('req-db', reply));

      expect(reply.status).toHaveBeenCalledWith(503);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is temporarily unavailable' },
        requestId: 'req-db',
      });
    },
  );

  it('keeps non-connectivity Prisma errors as safe 500 responses', () => {
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };
    const error = new Prisma.PrismaClientKnownRequestError('record conflict detail', {
      code: 'P2002',
      clientVersion: '7.10.0',
    });

    new HttpErrorFilter().catch(error, createHost('req-query', reply));

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      requestId: 'req-query',
    });
  });
});
