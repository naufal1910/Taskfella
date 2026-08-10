import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id parameters are intentionally kept in one place so password hashes
 * can be reviewed and upgraded without spreading crypto configuration through
 * authentication callers.
 */
export const PASSWORD_HASH_OPTIONS = {
  // @node-rs/argon2 exposes these as ambient const enums; numeric values keep
  // this module compatible with TypeScript isolatedModules and the runtime.
  algorithm: 2,
  version: 1,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

const MAX_PASSWORD_LENGTH = 1024;

function assertPasswordInput(password: string): void {
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new Error("Password input is invalid.");
  }
}

/** Hash a password with Argon2id. The plaintext is never returned or persisted here. */
export async function hashPassword(password: string): Promise<string> {
  assertPasswordInput(password);
  return hash(password, PASSWORD_HASH_OPTIONS);
}

/**
 * Verify a password without exposing hash-parser or crypto errors to callers.
 * Invalid stored material fails closed rather than becoming an authentication
 * error with useful attacker-controlled detail.
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > MAX_PASSWORD_LENGTH ||
    typeof passwordHash !== "string" ||
    passwordHash.length === 0
  ) {
    return false;
  }

  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function isPasswordHash(passwordHash: string): boolean {
  return typeof passwordHash === "string" && passwordHash.startsWith("$argon2id$");
}
