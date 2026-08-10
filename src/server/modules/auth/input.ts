import { z } from "zod";
import { AppError } from "@/server/http/errors";
import { validateEmail } from "./accounts";
import { validatePasswordInput } from "./password";

const emailSchema = z.string().min(1).max(1024);
const passwordSchema = z.string().max(1024);
const tokenSchema = z.string().min(1).max(512);

function invalid(): never {
  throw new AppError("INVALID_REQUEST");
}

export function parseEmail(input: unknown): string {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) {
    return invalid();
  }

  try {
    return validateEmail(parsed.data);
  } catch {
    return invalid();
  }
}

export function parsePassword(input: unknown): string {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    return invalid();
  }

  try {
    validatePasswordInput(parsed.data);
  } catch {
    return invalid();
  }

  return parsed.data;
}

export function parseEmailPassword(input: Record<string, unknown>): {
  email: string;
  password: string;
} {
  return { email: parseEmail(input.email), password: parsePassword(input.password) };
}

export function parseToken(input: unknown): string {
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) {
    return invalid();
  }
  return parsed.data;
}

export function parsePasswordReset(input: Record<string, unknown>): {
  token: string;
  password: string;
} {
  return { token: parseToken(input.token), password: parsePassword(input.password) };
}
