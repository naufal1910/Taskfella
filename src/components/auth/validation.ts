export type AuthFormMode = "signup" | "login" | "forgot" | "reset" | "resend" | "verify";

export type AuthField = "email" | "password" | "confirmation";

export interface AuthFieldValues {
  email: string;
  password: string;
  confirmation: string;
}

export type AuthFieldErrors = Partial<Record<AuthField, string>>;

const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1024;
export const MIN_PASSWORD_LENGTH = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

export function validateAuthFields(mode: AuthFormMode, values: AuthFieldValues): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const hasEmail = mode === "signup" || mode === "login" || mode === "forgot" || mode === "resend";
  const hasPassword = mode === "signup" || mode === "login" || mode === "reset";

  if (hasEmail) {
    const trimmedEmail = values.email.trim();
    const normalizedEmail = trimmedEmail.normalize("NFKC").toLowerCase();
    if (
      trimmedEmail.length === 0 ||
      trimmedEmail.length > MAX_EMAIL_LENGTH ||
      normalizedEmail.length > MAX_EMAIL_LENGTH ||
      !EMAIL_PATTERN.test(normalizedEmail)
    ) {
      errors.email = "Enter a valid email address.";
    }
  }

  if (hasPassword) {
    if (values.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    } else if (values.password.length > MAX_PASSWORD_LENGTH) {
      errors.password = `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`;
    }
  }

  if (mode === "reset") {
    if (values.confirmation.length > MAX_PASSWORD_LENGTH) {
      errors.confirmation = `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`;
    } else if (values.password !== values.confirmation) {
      errors.confirmation = "Passwords must match.";
    }
  }

  return errors;
}
