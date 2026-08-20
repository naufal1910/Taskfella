"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/primitives";
import {
  type AuthFieldErrors,
  type AuthFormMode,
  MIN_PASSWORD_LENGTH,
  validateAuthFields,
} from "./validation";

interface AuthFormProps {
  mode: AuthFormMode;
  token?: string;
}

interface ApiError {
  code?: string;
  message?: string;
}

type TokenErrorCode = "TOKEN_EXPIRED" | "TOKEN_ALREADY_USED" | "TOKEN_SUPERSEDED" | "TOKEN_INVALID";

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

const tokenErrorCodes = new Set<TokenErrorCode>([
  "TOKEN_EXPIRED",
  "TOKEN_ALREADY_USED",
  "TOKEN_SUPERSEDED",
  "TOKEN_INVALID",
]);

function isTokenErrorCode(code: string | undefined): code is TokenErrorCode {
  return code !== undefined && tokenErrorCodes.has(code as TokenErrorCode);
}

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

export function authErrorMessage(
  code: string | undefined,
  fallback = "We could not complete that request. Try again.",
): string {
  switch (code) {
    case "TOKEN_EXPIRED":
      return "This link has expired. Request a fresh link and try again.";
    case "TOKEN_ALREADY_USED":
      return "This link has already been used. Request a fresh link if you still need one.";
    case "TOKEN_SUPERSEDED":
      return "This link was replaced by a newer one. Request a fresh link if you still need one.";
    case "TOKEN_INVALID":
      return "This link is invalid. Request a fresh link and try again.";
    case "RATE_LIMITED":
      return "Too many attempts. Wait a while and try again.";
    case "INVALID_CREDENTIALS":
      return "The email or password is incorrect.";
    case "EMAIL_NOT_VERIFIED":
      return "Verify your email address before signing in, then try again.";
    case "INVALID_REQUEST":
      return "Check your information and try again.";
    case "EMAIL_DELIVERY_FAILED":
    case "DATABASE_UNAVAILABLE":
    case "INTERNAL_ERROR":
      return "We could not complete that request safely. Try again later.";
    default:
      return fallback;
  }
}

function AuthFeedback({
  pending,
  success,
  error,
  pendingMessage = "Working…",
}: {
  pending: boolean;
  success?: string;
  error?: string;
  pendingMessage?: string;
}) {
  if (!pending && !success && !error) return null;

  const tone = pending ? "pending" : error ? "error" : "success";
  const label = pending ? "In progress" : error ? "Unable to continue" : "Complete";
  const message = pending ? pendingMessage : (success ?? error);

  return (
    <div
      className={`auth-feedback auth-feedback--${tone}`}
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
      aria-atomic="true"
      aria-busy={pending || undefined}
    >
      <strong>{label}</strong>
      <p>{message}</p>
    </div>
  );
}

function tokenStateCopy(
  mode: "verify" | "reset",
  code: TokenErrorCode | undefined,
  missing: boolean,
) {
  const actionHref = mode === "verify" ? "/verify-email/resend" : "/forgot-password";
  const actionLabel =
    mode === "verify" ? "Request a fresh verification link" : "Request a new reset link";

  if (missing) {
    return {
      badge: "Link unavailable",
      status: "danger" as const,
      title:
        mode === "verify"
          ? "This verification link is incomplete."
          : "This reset link is incomplete.",
      description:
        mode === "verify"
          ? "Open the complete link from your email, or request a fresh verification link."
          : "Open the complete link from your email, or request a new password reset link.",
      actionHref,
      actionLabel,
    };
  }

  switch (code) {
    case "TOKEN_EXPIRED":
      return {
        badge: "Link expired",
        status: "warning" as const,
        title: "This link has expired.",
        description: "Request a fresh link and use it before it expires.",
        actionHref,
        actionLabel,
      };
    case "TOKEN_ALREADY_USED":
      return {
        badge: "Link already used",
        status: "warning" as const,
        title: "This link has already been used.",
        description: "For your security, one-time links cannot be used again.",
        actionHref,
        actionLabel,
      };
    case "TOKEN_SUPERSEDED":
      return {
        badge: "Link replaced",
        status: "warning" as const,
        title: "This link was replaced.",
        description: "A newer link is available. Request another one if needed.",
        actionHref,
        actionLabel,
      };
    default:
      return {
        badge: "Link unavailable",
        status: "danger" as const,
        title: "This link is not valid.",
        description: "Request a fresh link and try again.",
        actionHref,
        actionLabel,
      };
  }
}

export function TokenState({
  mode,
  code,
  missing = false,
}: {
  mode: "verify" | "reset";
  code?: TokenErrorCode;
  missing?: boolean;
}) {
  const state = tokenStateCopy(mode, code, missing);
  const titleId = `${mode}-token-title`;

  return (
    <section className="auth-card auth-card--state" aria-labelledby={titleId}>
      <div className="auth-state">
        <StatusBadge status={state.status}>{state.badge}</StatusBadge>
        <p className="eyebrow">{mode === "verify" ? "Email verification" : "Password reset"}</p>
        <h1 id={titleId}>{state.title}</h1>
        <p className="auth-intro">{state.description}</p>
        <div className="auth-state__actions">
          <Link className="ui-button ui-button--primary" href={state.actionHref}>
            {state.actionLabel}
          </Link>
          <Link className="ui-button ui-button--secondary" href="/login">
            Return to sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

export function CompletionState({ mode, message }: { mode: "verify" | "reset"; message: string }) {
  const titleId = `${mode}-success-title`;

  return (
    <section className="auth-card auth-card--state" aria-labelledby={titleId}>
      <div className="auth-state">
        <StatusBadge status="success">Complete</StatusBadge>
        <p className="eyebrow">{mode === "verify" ? "Email verification" : "Password reset"}</p>
        <h1 id={titleId}>{mode === "verify" ? "Email verified" : "Password reset"}</h1>
        <p className="auth-intro">{message}</p>
        <div className="auth-state__actions">
          <Link className="ui-button ui-button--primary" href="/login">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

export function AuthForm({ mode, token }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const router = useRouter();
  const [pending, setPending] = useState(mode === "verify" && Boolean(token));
  const [success, setSuccess] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [errorCode, setErrorCode] = useState<string | undefined>(
    (mode === "verify" || mode === "reset") && !token ? "TOKEN_INVALID" : undefined,
  );
  const [error, setError] = useState<string | undefined>(
    (mode === "verify" || mode === "reset") && !token
      ? authErrorMessage("TOKEN_INVALID")
      : undefined,
  );
  const verificationStarted = useRef(false);
  const isVerify = mode === "verify";
  const isTokenMode = mode === "verify" || mode === "reset";
  const content =
    isTokenMode && mode !== "reset" ? undefined : mode === "resend" ? undefined : copy[mode];

  const submit = useCallback(
    async (event?: FormEvent<HTMLFormElement>): Promise<void> => {
      event?.preventDefault();
      if ((mode === "verify" || mode === "reset") && !token) return;

      setPending(true);
      setError(undefined);
      setErrorCode(undefined);
      setSuccess(undefined);
      setFieldErrors({});

      const nextFieldErrors = validateAuthFields(mode, { email, password, confirmation });
      if (Object.keys(nextFieldErrors).length > 0) {
        setPending(false);
        setFieldErrors(nextFieldErrors);
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
          const apiFieldErrors =
            payload.error?.code === "INVALID_REQUEST"
              ? validateAuthFields(mode, { email, password, confirmation })
              : {};
          setFieldErrors(apiFieldErrors);
          setErrorCode(
            Object.keys(apiFieldErrors).length > 0
              ? undefined
              : (payload.error?.code ?? "UNKNOWN_ERROR"),
          );
          setError(
            Object.keys(apiFieldErrors).length > 0
              ? undefined
              : authErrorMessage(payload.error?.code),
          );
          return;
        }

        const message = payload.message ?? "Request complete.";
        setErrorCode(undefined);
        setSuccess(message);
        if (mode === "verify" && window.history.replaceState) {
          window.history.replaceState({}, "", "/verify-email");
        }
        if (mode === "reset") {
          setPassword("");
          setConfirmation("");
          if (window.history.replaceState) {
            window.history.replaceState({}, "", "/reset-password");
          }
        }
        if (mode === "login") {
          router.push("/account");
        }
      } catch {
        setErrorCode("NETWORK_ERROR");
        setError("We could not reach Taskfella. Check your connection and try again.");
      } finally {
        setPending(false);
      }
    },
    [confirmation, email, mode, password, router, token],
  );

  useEffect(() => {
    const firstInvalidField = (["email", "password", "confirmation"] as const).find(
      (field) => fieldErrors[field],
    );
    if (!firstInvalidField) return;
    document.getElementById(`${mode}-${firstInvalidField}`)?.focus();
  }, [fieldErrors, mode]);

  useEffect(() => {
    if (!isVerify || !token || verificationStarted.current) return;
    verificationStarted.current = true;
    void submit();
  }, [isVerify, submit, token]);

  const tokenMissing = isTokenMode && !token;
  if (isVerify && success) {
    return <CompletionState mode="verify" message={success} />;
  }
  if (isVerify && (tokenMissing || isTokenErrorCode(errorCode))) {
    return (
      <TokenState
        mode="verify"
        code={errorCode as TokenErrorCode | undefined}
        missing={tokenMissing}
      />
    );
  }
  if (isVerify) {
    return (
      <section
        className="auth-card auth-card--state"
        aria-labelledby="verify-title"
        aria-busy={pending}
      >
        <div className="auth-state">
          <StatusBadge status={error ? "danger" : "neutral"}>
            {error ? "Needs attention" : "Checking"}
          </StatusBadge>
          <p className="eyebrow">Email verification</p>
          <h1 id="verify-title">Confirm your email address</h1>
          <p className="auth-intro">We are checking your one-time verification link.</p>
          <AuthFeedback
            pending={pending}
            success={success}
            error={error}
            pendingMessage="Checking your verification link…"
          />
          <p className="auth-links">
            Need another link? <Link href="/verify-email/resend">Request verification again</Link>
          </p>
        </div>
      </section>
    );
  }

  if (mode === "reset" && success) {
    return <CompletionState mode="reset" message={success} />;
  }
  if (mode === "reset" && (tokenMissing || isTokenErrorCode(errorCode))) {
    return (
      <TokenState
        mode="reset"
        code={errorCode as TokenErrorCode | undefined}
        missing={tokenMissing}
      />
    );
  }

  const title = mode === "resend" ? "Resend verification email" : content?.title;
  const intro =
    mode === "resend"
      ? "We will send a fresh link when the address needs verification."
      : content?.intro;
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const validationSummaryId = `${mode}-validation-summary`;
  const emailInputId = `${mode}-email`;
  const emailHelpId = `${mode}-email-help`;
  const emailErrorId = `${mode}-email-error`;
  const passwordInputId = `${mode}-password`;
  const passwordHelpId = `${mode}-password-help`;
  const passwordErrorId = `${mode}-password-error`;
  const confirmationInputId = `${mode}-confirmation`;
  const confirmationHelpId = `${mode}-confirmation-help`;
  const confirmationErrorId = `${mode}-confirmation-error`;
  const isPasswordForm = mode === "signup" || mode === "login" || mode === "reset";

  return (
    <section className="auth-card" aria-labelledby={`${mode}-title`} aria-busy={pending}>
      <p className="eyebrow">Taskfella account</p>
      <h1 id={`${mode}-title`}>{title}</h1>
      <p className="auth-intro">{intro}</p>
      {hasFieldErrors && (
        <div
          id={validationSummaryId}
          className="auth-validation-summary"
          role="alert"
          tabIndex={-1}
        >
          <strong>Check the highlighted fields.</strong>
          <p>Correct the information below and try again.</p>
        </div>
      )}
      <form
        className="auth-form"
        onSubmit={submit}
        noValidate
        aria-describedby={hasFieldErrors ? validationSummaryId : undefined}
      >
        {(mode === "signup" || mode === "login" || mode === "forgot" || mode === "resend") && (
          <div className="auth-field">
            <label className="field-label" htmlFor={emailInputId}>
              Email address
            </label>
            <input
              className="auth-input"
              id={emailInputId}
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete={mode === "login" ? "username" : "email"}
              maxLength={320}
              required
              aria-invalid={fieldErrors.email ? "true" : undefined}
              aria-describedby={[emailHelpId, fieldErrors.email ? emailErrorId : undefined]
                .filter(Boolean)
                .join(" ")}
              aria-errormessage={fieldErrors.email ? emailErrorId : undefined}
            />
            <small id={emailHelpId} className="field-help">
              Use the address associated with your account.
            </small>
            {fieldErrors.email && (
              <small id={emailErrorId} className="field-error">
                {fieldErrors.email}
              </small>
            )}
          </div>
        )}

        {isPasswordForm && (
          <div className="auth-field">
            <label className="field-label" htmlFor={passwordInputId}>
              {mode === "reset" ? "New password" : "Password"}
            </label>
            <input
              className="auth-input"
              id={passwordInputId}
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
              aria-invalid={fieldErrors.password ? "true" : undefined}
              aria-describedby={[passwordHelpId, fieldErrors.password ? passwordErrorId : undefined]
                .filter(Boolean)
                .join(" ")}
              aria-errormessage={fieldErrors.password ? passwordErrorId : undefined}
            />
            <small id={passwordHelpId} className="field-help">
              Use at least 12 characters. Spaces and passphrases are welcome.
            </small>
            {fieldErrors.password && (
              <small id={passwordErrorId} className="field-error">
                {fieldErrors.password}
              </small>
            )}
          </div>
        )}

        {mode === "reset" && (
          <div className="auth-field">
            <label className="field-label" htmlFor={confirmationInputId}>
              Repeat new password
            </label>
            <input
              className="auth-input"
              id={confirmationInputId}
              type="password"
              name="password-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={1024}
              required
              aria-invalid={fieldErrors.confirmation ? "true" : undefined}
              aria-describedby={[
                confirmationHelpId,
                fieldErrors.confirmation ? confirmationErrorId : undefined,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-errormessage={fieldErrors.confirmation ? confirmationErrorId : undefined}
            />
            <small id={confirmationHelpId} className="field-help">
              Repeat the new password exactly.
            </small>
            {fieldErrors.confirmation && (
              <small id={confirmationErrorId} className="field-error">
                {fieldErrors.confirmation}
              </small>
            )}
          </div>
        )}

        <button
          className="ui-button ui-button--primary auth-submit"
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
      <AuthFeedback pending={pending} success={success} error={error} />
      <div className="auth-links">
        {mode === "signup" && (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        )}
        {mode === "login" && (
          <>
            <Link href="/forgot-password">Forgot password?</Link> <span aria-hidden="true">·</span>{" "}
            <Link href="/signup">Create account</Link>
          </>
        )}
        {mode === "forgot" && (
          <>
            Need to verify an address? <Link href="/verify-email/resend">Resend verification</Link>
          </>
        )}
        {mode === "reset" && (
          <>
            Need another reset link? <Link href="/forgot-password">Request one</Link>{" "}
            <span aria-hidden="true">·</span> <Link href="/login">Return to sign in</Link>
          </>
        )}
        {mode === "resend" && <Link href="/login">Return to sign in</Link>}
      </div>
    </section>
  );
}
