import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { Prisma } from '../../generated/prisma/client.js';
import { AppError, type AppErrorCode } from './app-error.js';

const DATABASE_UNAVAILABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'ECONNREFUSED']);

function isDatabaseUnavailable(exception: unknown): boolean {
  return (
    exception instanceof Prisma.PrismaClientKnownRequestError &&
    DATABASE_UNAVAILABLE_CODES.has(exception.code)
  );
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const databaseUnavailable = isDatabaseUnavailable(exception);
    const status =
      exception instanceof AppError
        ? exception.statusCode
        : databaseUnavailable
          ? 503
          : exception instanceof HttpException
            ? exception.getStatus()
            : 500;
    const code: AppErrorCode =
      exception instanceof AppError
        ? exception.code
        : databaseUnavailable
          ? 'DATABASE_UNAVAILABLE'
          : status === 404
            ? 'NOT_FOUND'
            : status === 400
              ? 'VALIDATION_ERROR'
              : 'INTERNAL_ERROR';
    const message =
      exception instanceof AppError
        ? exception.safeMessage
        : databaseUnavailable
          ? 'Database is temporarily unavailable'
          : status === 404
            ? 'Resource not found'
            : 'An unexpected error occurred';

    this.logger.error({ requestId: request.id, code, status });
    void reply.status(status).send({
      success: false,
      error: { code, message },
      requestId: request.id,
    });
  }
}
