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

function httpErrorCode(status: number): AppErrorCode {
  if (status === 400 || status === 413 || status === 415) return 'VALIDATION_ERROR';
  if (status === 404) return 'NOT_FOUND';
  return 'INTERNAL_ERROR';
}

function httpErrorMessage(status: number): string {
  if (status === 400) return 'Request is invalid';
  if (status === 413) return 'Request body is too large';
  if (status === 415) return 'Content type is not supported';
  if (status === 404) return 'Resource not found';
  return 'An unexpected error occurred';
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
          : httpErrorCode(status);
    const message =
      exception instanceof AppError
        ? exception.safeMessage
        : databaseUnavailable
          ? 'Database is temporarily unavailable'
          : httpErrorMessage(status);

    this.logger.error({ requestId: request.id, code, status });
    void reply.status(status).send({
      success: false,
      error: { code, message },
      requestId: request.id,
    });
  }
}
