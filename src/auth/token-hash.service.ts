import { createHmac } from 'node:crypto';

const MIN_PEPPER_LENGTH = 32;
const MAX_TOKEN_LENGTH = 4096;

export class TokenHashService {
  constructor(private readonly pepper: string) {
    if (pepper.length < MIN_PEPPER_LENGTH) {
      throw new Error('Credential pepper must contain at least 32 characters');
    }
  }

  hash(token: string): string {
    if (token.length < 1 || token.length > MAX_TOKEN_LENGTH) {
      throw new Error('Token length is outside the accepted bounds');
    }

    return createHmac('sha256', this.pepper).update(token, 'utf8').digest('hex');
  }
}
