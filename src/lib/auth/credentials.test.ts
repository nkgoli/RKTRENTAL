import { describe, expect, it } from 'vitest';
import { verifyPasswordHash } from './credentials';
import { hashPassword } from './password';

describe('stored password credentials', () => {
  it('creates a salted scrypt hash and accepts the correct password', async () => {
    const password = 'JordanDemo#2026';
    const passwordHash = await hashPassword(password);

    expect(passwordHash).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    await expect(verifyPasswordHash(password, passwordHash)).resolves.toBe(true);
  });

  it('uses a new random salt for each hash', async () => {
    const firstHash = await hashPassword('same password');
    const secondHash = await hashPassword('same password');

    expect(firstHash).not.toBe(secondHash);
    await expect(verifyPasswordHash('same password', secondHash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const passwordHash = await hashPassword('correct horse battery staple');

    await expect(verifyPasswordHash('incorrect password', passwordHash)).resolves.toBe(false);
  });

  it('rejects accounts without a stored password hash', async () => {
    await expect(verifyPasswordHash('any-password', null)).resolves.toBe(false);
  });

  it('rejects malformed hashes and oversized passwords', async () => {
    await expect(verifyPasswordHash('any-password', 'invalid')).resolves.toBe(false);
    const oversizedPassword = 'a'.repeat(1025);
    const wellFormedHash = `scrypt$16384$8$1$${'a'.repeat(32)}$${'b'.repeat(128)}`;
    await expect(verifyPasswordHash(oversizedPassword, wellFormedHash)).resolves.toBe(false);
  });
});
