export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface SerializedAppError {
  code: AppErrorCode;
  statusCode: number;
  safeMessage: string;
}

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    readonly statusCode: number,
    readonly safeMessage: string,
    options?: ErrorOptions,
  ) {
    super(safeMessage, options);
  }

  toJSON(): SerializedAppError {
    return {
      code: this.code,
      statusCode: this.statusCode,
      safeMessage: this.safeMessage,
    };
  }
}
