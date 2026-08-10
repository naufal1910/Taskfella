"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MIN_PASSWORD_LENGTH = 12;

type AuthFormMode = "signup" | "login" | "forgot" | "reset" | "resend" | "verify";

interface AuthFormProps {
  mode: AuthFormMode;
  token?: string;
}

interface ApiError {
  code?: string;
  message?: string;
}

const copy: Record<Exclude<AuthFormMode, "verify" | "resend">, { title: string; intro: string }> = {
  signup: {
    title: "Create your account",
    intro: "Start with an email address and a memorable passphrase.",
  },
  login: {
    title: "Welcome back",
    intro: "Sign in to continue your focused work.",
  },
  forgot: {
    title: "Forgot your password?",
    intro:
      "Enter your address and we will explain the next step without revealing account details.",
  },
  reset: {
    title: "Choose a new password",
    intro: "Use a passphrase you will remember. The link is single-use and expires soon.",
  },
};

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const value = part.trim();
    if (!value.startsWith(prefix)) continue;
    try {
      return decodeURIComponent(value.slice(prefix.length));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("csrf");
  }

  const token = readCookie("taskfella_csrf");
  if (!token) {
    throw new Error("csrf");
  }
  return token;
}

function errorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "TOKEN_EXPIRED":
      return "This link has expired. Request a fresh link and try again.";
    case "TOKEN_ALREADY_USED":
      return "This link has already been used. Request a fresh link if you still need one.";
    case "TOKEN_SUPERSEDED":
      return "This link was replaced by a newer one. Request a fresh link if you still need one.";
    case "TOKEN_INVALID":
      return "This link is invalid. Check the message or request a fresh one.";
    case "RATE_LIMITED":
      return "Too many attempts. Wait a while and try again.";
    case "INVALID_CREDENTIALS":
      return "The email or password is incorrect.";
    case "EMAIL_NOT_VERIFIED":
      return "Verify your email address before signing in, then try again.";
    case "INVALID_REQUEST":
      return "Check the highlighted information and try again.";
    default:
      return fallback;
  }
}

export function AuthForm({ mode, token }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const router = useRouter();
  const [pending, setPending] = useState(mode === "verify" && Boolean(token));
  const [success, setSuccess] = useState<string>();
  const [error, setError] = useState<string | undefined>(
    mode === "verify" && !token
      ? "This verification link is missing its one-time token."
      : undefined,
  );
  const verificationStarted = useRef(false);

  const isVerify = mode === "verify";
  const isPasswordForm = mode === "signup" || mode === "login" || mode === "reset";
  const content = mode === "verify" || mode === "resend" ? undefined : copy[mode];

  const submit = useCallback(
    async (event?: React.FormEvent<HTMLFormElement>): Promise<void> => {
      event?.preventDefault();
      setPending(true);
      setError(undefined);
      setSuccess(undefined);

      if (mode === "reset" && password !== confirmation) {
        setPending(false);
        setError("The passwords do not match.");
        return;
      }

      const endpoint =
        mode === "signup"
          ? "/api/auth/signup"
          : mode === "login"
            ? "/api/auth/login"
            : mode === "forgot"
              ? "/api/auth/forgot-password"
              : mode === "reset"
                ? "/api/auth/reset-password"
                : mode === "resend"
                  ? "/api/auth/resend-verification"
                  : "/api/auth/verify-email";

      const body =
        mode === "verify"
          ? { token }
          : mode === "reset"
            ? { token, password }
            : mode === "signup" || mode === "login"
              ? { email, password }
              : { email };

      try {
        const csrf = await getCsrfToken();
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrf,
          },
          body: JSON.stringify(body),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: ApiError;
          message?: string;
        };

        if (!response.ok) {
          setError(
            errorMessage(payload.error?.code, "We could not complete that request. Try again."),
          );
          return;
        }

        setSuccess(payload.message ?? "Request complete.");
        if (mode === "verify" && window.history.replaceState) {
          window.history.replaceState({}, "", "/verify-email");
        }
        if (mode === "reset" && window.history.replaceState) {
          window.history.replaceState({}, "", "/reset-password");
        }
        if (mode === "login") {
          router.push("/account");
        }
      } catch {
        setError("We could not reach Taskfella. Check your connection and try again.");
      } finally {
        setPending(false);
      }
    },
    [confirmation, email, mode, password, router, token],
  );

  useEffect(() => {
    if (!isVerify || !token || verificationStarted.current) return;
    verificationStarted.current = true;
    void submit();
  }, [isVerify, submit, token]);

  if (isVerify) {
    return (
      <section className="auth-card" aria-labelledby="verify-title">
        <p className="eyebrow">Email verification</p>
        <h1 id="verify-title">Confirm your email address</h1>
        <p className="auth-intro">We are checking your one-time verification link.</p>
        <div className="auth-feedback" aria-live="polite" role={error ? "alert" : "status"}>
          {pending && <p>Pending…</p>}
          {success && <p className="feedback-success">{success}</p>}
          {error && <p className="feedback-error">{error}</p>}
        </div>
        <p className="auth-links">
          <Link href="/login">Go to sign in</Link>
        </p>
      </section>
    );
  }

  const title = mode === "resend" ? "Resend verification email" : content?.title;
  const intro =
    mode === "resend"
      ? "We will send a fresh link when the address needs verification."
      : content?.intro;

  return (
    <section className="auth-card" aria-labelledby={`${mode}-title`}>
      <p className="eyebrow">Taskfella account</p>
      <h1 id={`${mode}-title`}>{title}</h1>
      <p className="auth-intro">{intro}</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        {(mode === "signup" || mode === "login" || mode === "forgot" || mode === "resend") && (
          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete={mode === "login" ? "username" : "email"}
              maxLength={320}
              required
              aria-describedby={`${mode}-email-help`}
            />
            <small id={`${mode}-email-help`}>Use the address associated with your account.</small>
          </label>
        )}

        {isPasswordForm && (
          <label className="field">
            <span>{mode === "reset" ? "New password" : "Password"}</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                mode === "signup"
                  ? "new-password"
                  : mode === "reset"
                    ? "new-password"
                    : "current-password"
              }
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={1024}
              required
              aria-describedby={`${mode}-password-help`}
            />
            <small id={`${mode}-password-help`}>
              Use at least {MIN_PASSWORD_LENGTH} characters. Spaces and passphrases are welcome.
            </small>
          </label>
        )}

        {mode === "reset" && (
          <label className="field">
            <span>Repeat new password</span>
            <input
              type="password"
              name="password-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={1024}
              required
            />
          </label>
        )}

        <button
          className="primary-action button-action auth-submit"
          type="submit"
          disabled={pending}
        >
          {pending
            ? "Working…"
            : mode === "signup"
              ? "Create account"
              : mode === "login"
                ? "Sign in"
                : mode === "forgot"
                  ? "Send reset instructions"
                  : mode === "reset"
                    ? "Reset password"
                    : "Send fresh link"}
        </button>
      </form>
      <div className="auth-feedback" aria-live="polite" role={error ? "alert" : "status"}>
        {success && <p className="feedback-success">{success}</p>}
        {error && <p className="feedback-error">{error}</p>}
      </div>
      <p className="auth-links">
        {mode === "signup" && (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        )}
        {mode === "login" && (
          <>
            <Link href="/forgot-password">Forgot password?</Link> ·{" "}
            <Link href="/signup">Create account</Link>
          </>
        )}
        {mode === "forgot" && (
          <>
            Need to verify an address? <Link href="/verify-email/resend">Resend verification</Link>
          </>
        )}
        {mode === "reset" && <Link href="/login">Return to sign in</Link>}
        {mode === "resend" && <Link href="/login">Return to sign in</Link>}
      </p>
    </section>
  );
}
