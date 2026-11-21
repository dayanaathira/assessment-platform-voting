import { compare, hash } from 'bcrypt';

const BCRYPT_ROUNDS = 12;

/**
 * @param password - Plain-text password.
 * @returns The bcrypt hash to store.
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

/**
 * @param password - Plain-text password to check.
 * @param passwordHash - Stored bcrypt hash.
 * @returns Whether the password matches.
 */
export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(password, passwordHash);
}
