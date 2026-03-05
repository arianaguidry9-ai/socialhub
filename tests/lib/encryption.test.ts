import { encrypt, decrypt } from '@/lib/encryption';

// Set required env for tests
process.env.ENCRYPTION_SECRET = 'test-secret-key-for-unit-tests-only';

describe('Encryption', () => {
  it('should encrypt and decrypt a string', () => {
    const plaintext = 'my-secret-access-token-12345';
    const encrypted = encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(typeof encrypted).toBe('string');

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'same-text';
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2);
    // Both should decrypt to the same value
    expect(decrypt(enc1)).toBe(plaintext);
    expect(decrypt(enc2)).toBe(plaintext);
  });

  it('should throw on tampered ciphertext', () => {
    const encrypted = encrypt('hello');
    const tampered = encrypted.slice(0, -4) + 'XXXX';
    expect(() => decrypt(tampered)).toThrow();
  });

  it('should handle empty strings', () => {
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('should handle unicode content', () => {
    const plaintext = 'こんにちは世界 🌍 émojis';
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });
});
