import { Injectable } from '@nestjs/common';
import { argon2id, hash as argonHash, verify as argonVerify } from 'argon2';

import { AppError } from '../common/errors/app-error.js';

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

function assertPasswordLength(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Password must contain between 12 and 128 characters',
    );
  }
}

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    assertPasswordLength(password);
    return argonHash(password, {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
      hashLength: 32,
    });
  }

  async verify(encodedHash: string, password: string): Promise<boolean> {
    assertPasswordLength(password);
    if (!encodedHash.startsWith('$argon2id$') || encodedHash.length > 512) {
      return false;
    }

    try {
      return await argonVerify(encodedHash, password);
    } catch {
      return false;
    }
  }
}
