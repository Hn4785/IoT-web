import { AppError, type AppErrorCode } from '../common/errors/app-error.js';

export class AlertConfigError extends AppError {
  constructor(code: string, statusCode: number, message: string) {
    super(code as AppErrorCode, statusCode, message);
  }
}
