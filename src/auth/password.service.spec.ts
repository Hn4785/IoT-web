import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('stores a bounded password as Argon2id and verifies it', async () => {
    const plaintext = 'twelve-chars';
    const encoded = await passwords.hash(plaintext);

    expect(encoded).toMatch(/^\$argon2id\$/);
    expect(encoded).not.toContain(plaintext);
    await expect(passwords.verify(encoded, plaintext)).resolves.toBe(true);
    await expect(passwords.verify(encoded, 'different-password')).resolves.toBe(false);
  });

  it('rejects passwords shorter than twelve characters', async () => {
    await expect(passwords.hash('eleven-char')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});
