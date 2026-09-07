import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AppError, type AppErrorCode } from './app-error.js';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const status =
      exception instanceof AppError
        ? exception.statusCode
        : exception instanceof HttpException
          ? exception.getStatus()
          : 500;
    const code: AppErrorCode =
      exception instanceof AppError
        ? exception.code
        : status === 404
          ? 'NOT_FOUND'
          : status === 400
            ? 'VALIDATION_ERROR'
            : 'INTERNAL_ERROR';
    const message =
      exception instanceof AppError
        ? exception.safeMessage
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
