import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { AppError } from '../common/errors/app-error.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';

export type EncryptedSourceSecret = Readonly<{
  ciphertext: string;
  nonce: string;
  authTag: string;
}>;

@Injectable()
export class SourceSecretService {
  constructor(@Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig) {}

  encrypt(plaintext: string): EncryptedSourceSecret {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.config.dataSourceEncryptionKey, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64url'),
      nonce: nonce.toString('base64url'),
      authTag: cipher.getAuthTag().toString('base64url'),
    };
  }

  decrypt(secret: EncryptedSourceSecret): string {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.config.dataSourceEncryptionKey,
        Buffer.from(secret.nonce, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(secret.authTag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(secret.ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch (error) {
      throw new AppError('INTERNAL_ERROR', 500, 'Stored source credential is invalid', {
        cause: error,
      });
    }
  }
}
