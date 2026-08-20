import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";

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

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 1024;

/**
 * Validate without trimming or normalizing: spaces and Unicode are deliberate
 * parts of a passphrase, not formatting to silently discard.
 */
export function validatePasswordInput(password: string): void {
  if (
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new Error("Password input is invalid.");
  }
}

function assertPasswordInput(password: string): void {
  validatePasswordInput(password);
}

/** Hash a password with Argon2id. The plaintext is never returned or persisted here. */
export async function hashPassword(password: string): Promise<string> {
  assertPasswordInput(password);
  return hash(password, PASSWORD_HASH_OPTIONS);
}

// Generated at process start and never returned or persisted. It keeps an
// unknown-email login on the same Argon2 verification path without committing a
// password or hash fixture to the repository.
const DUMMY_PASSWORD_HASH = hashPassword(randomBytes(32).toString("base64url"));

/**
 * Verify a password without exposing hash-parser or crypto errors to callers.
 * Invalid stored material fails closed rather than becoming an authentication
 * error with useful attacker-controlled detail.
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH ||
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

/** Verify against stored material or a process-local dummy hash for unknown identities. */
export async function verifyPasswordWithFallback(
  password: string,
  passwordHash?: string,
): Promise<boolean> {
  return verifyPassword(password, passwordHash ?? (await DUMMY_PASSWORD_HASH));
}

export function isPasswordHash(passwordHash: string): boolean {
  return typeof passwordHash === "string" && passwordHash.startsWith("$argon2id$");
}
