"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/primitives";
import {
  APPEARANCE_RESET_REVISION,
  cacheAppearancePreference,
  clearAppearancePreferenceCache,
  currentAppearanceAuthEpoch,
  detectBrowserTimezone,
  isCurrentAppearanceAuthEpoch,
  notifyAppearanceChange,
  setAppearanceAuthEpoch,
  type AppearancePreference,
} from "@/components/theme/theme";
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

function readLocationToken(): string | undefined {
  const queryToken = new URLSearchParams(window.location.search).get("token");
  const hashToken = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
  const token = queryToken ?? hashToken;
  return token && token.length <= 512 ? token : undefined;
}

function subscribeToTokenLocation(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

function currentTokenLocation(): string {
  return typeof window === "undefined" ? "" : (readLocationToken() ?? "");
}

function serverTokenLocation(): string {
  return "";
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

function subscribeToLocation(): () => void {
  return () => undefined;
}

function currentOAuthStatus(): string | null {
  return new URLSearchParams(window.location.search).get("oauth");
}

function serverOAuthStatus(): null {
  return null;
}

function oauthMessage(status: string | null): string | undefined {
  switch (status) {
    case "provider-error":
      return "Google sign-in could not be completed. Try again or sign in with your existing method, then use the explicit Link Google action from your account.";
    case "cancelled":
      return "Google sign-in was cancelled. No account was created or changed.";
    case "state-invalid":
      return "That Google sign-in request expired or was already used. Start again.";
    case "not-configured":
      return "Google sign-in is not configured here. Use email and password instead.";
    case "rate-limited":
      return "Too many Google sign-in attempts. Wait a while and try again.";
    case "session-expired":
      return "Your account session expired before the Google action completed. Sign in and try again.";
    default:
      return undefined;
  }
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

export function classifyAuthErrorCode(
  mode: AuthFormMode,
  code: string | undefined,
  fieldErrors: AuthFieldErrors,
): string | undefined {
  if (
    code === "INVALID_REQUEST" &&
    (mode === "verify" || mode === "reset") &&
    Object.keys(fieldErrors).length === 0
  ) {
    return "TOKEN_INVALID";
  }

  return code;
}

export function AuthFeedback({
  pending,
  accepted,
  success,
  error,
  pendingMessage = "Working…",
}: {
  pending: boolean;
  accepted?: string;
  success?: string;
  error?: string;
  pendingMessage?: string;
}) {
  if (!pending && !accepted && !success && !error) return null;

  const hasPendingOutcome = pending || Boolean(accepted);
  const hasError = Boolean(error && !hasPendingOutcome);
  const tone = hasPendingOutcome ? "pending" : hasError ? "error" : "success";
  const label = pending
    ? "In progress"
    : accepted
      ? "Request received"
      : hasError
        ? "Unable to continue"
        : "Complete";
  const message = pending ? pendingMessage : (accepted ?? success ?? error);

  return (
    <div
      className={`auth-feedback auth-feedback--${tone}`}
      role={hasError ? "alert" : "status"}
      aria-live={hasError ? "assertive" : "polite"}
      aria-atomic="true"
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

function useOutcomeHeadingFocus() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return headingRef;
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
  const headingRef = useOutcomeHeadingFocus();

  return (
    <section
      className="auth-card auth-card--state"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      aria-labelledby={titleId}
    >
      <div className="auth-state">
        <StatusBadge status={state.status}>{state.badge}</StatusBadge>
        <p className="eyebrow">{mode === "verify" ? "Email verification" : "Password reset"}</p>
        <h1 ref={headingRef} id={titleId} tabIndex={-1}>
          {state.title}
        </h1>
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
  const headingRef = useOutcomeHeadingFocus();

  return (
    <section
      className="auth-card auth-card--state"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-labelledby={titleId}
    >
      <div className="auth-state">
        <StatusBadge status="success">Complete</StatusBadge>
        <p className="eyebrow">{mode === "verify" ? "Email verification" : "Password reset"}</p>
        <h1 ref={headingRef} id={titleId} tabIndex={-1}>
          {mode === "verify" ? "Email verified" : "Password reset"}
        </h1>
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
  const isVerify = mode === "verify";
  const isTokenMode = mode === "verify" || mode === "reset";
  const locationToken = useSyncExternalStore(
    subscribeToTokenLocation,
    currentTokenLocation,
    serverTokenLocation,
  );
  const effectiveToken = token ?? (locationToken || undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const oauthStatus = useSyncExternalStore(
    subscribeToLocation,
    currentOAuthStatus,
    serverOAuthStatus,
  );
  const router = useRouter();
  const [pending, setPending] = useState(mode === "verify" && Boolean(effectiveToken));
  const [accepted, setAccepted] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [error, setError] = useState<string>();
  const verificationStarted = useRef(false);
  const content =
    isTokenMode && mode !== "reset" ? undefined : mode === "resend" ? undefined : copy[mode];

  const submit = useCallback(
    async (event?: FormEvent<HTMLFormElement>): Promise<void> => {
      event?.preventDefault();
      if ((mode === "verify" || mode === "reset") && !effectiveToken) return;

      setPending(true);
      setAccepted(undefined);
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
      const requestGeneration = currentAppearanceAuthEpoch();
      let lifecycleGeneration: string | undefined;

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

      const browserTimezone = mode === "signup" ? detectBrowserTimezone() : undefined;
      const body =
        mode === "verify"
          ? { token: effectiveToken }
          : mode === "reset"
            ? { token: effectiveToken, password }
            : mode === "signup"
              ? { email, password, ...(browserTimezone ? { timezone: browserTimezone } : {}) }
              : mode === "login"
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
          status?: "pending" | "success";
          appearanceEpoch?: string;
          account?: {
            id?: string;
            appearance?: AppearancePreference;
            appearanceRevision?: string;
            appearanceEpoch?: string;
          };
        };

        if (
          (mode === "login" || mode === "reset") &&
          !isCurrentAppearanceAuthEpoch(requestGeneration)
        ) {
          return;
        }

        if (!response.ok) {
          const apiFieldErrors =
            payload.error?.code === "INVALID_REQUEST"
              ? validateAuthFields(mode, { email, password, confirmation })
              : {};
          const responseErrorCode = classifyAuthErrorCode(
            mode,
            payload.error?.code,
            apiFieldErrors,
          );
          setFieldErrors(apiFieldErrors);
          setErrorCode(
            Object.keys(apiFieldErrors).length > 0
              ? undefined
              : (responseErrorCode ?? "UNKNOWN_ERROR"),
          );
          setError(
            Object.keys(apiFieldErrors).length > 0
              ? undefined
              : authErrorMessage(responseErrorCode),
          );
          return;
        }

        const message = payload.message ?? "Request complete.";
        const requestAccepted = response.status === 202 && payload.status === "pending";
        setErrorCode(undefined);
        setAccepted(requestAccepted ? message : undefined);
        setSuccess(requestAccepted ? undefined : message);
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
        if (mode === "login" || mode === "reset") {
          lifecycleGeneration =
            mode === "login" ? payload.account?.appearanceEpoch : payload.appearanceEpoch;
          if (mode === "reset") {
            clearAppearancePreferenceCache();
            if (lifecycleGeneration) setAppearanceAuthEpoch(lifecycleGeneration, true);
          } else if (payload.account?.appearance) {
            cacheAppearancePreference(
              payload.account.appearance,
              payload.account.appearanceRevision,
              payload.account.id,
              lifecycleGeneration,
              requestGeneration,
            );
          }
          notifyAppearanceChange(
            mode === "login" ? (payload.account?.appearance ?? "system") : "system",
            mode === "login" ? payload.account?.appearanceRevision : APPEARANCE_RESET_REVISION,
            mode === "login"
              ? {
                  authenticated: true,
                  generation: lifecycleGeneration,
                  identity: payload.account?.id,
                }
              : { generation: lifecycleGeneration, reset: true },
          );
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
    [confirmation, effectiveToken, email, mode, password, router],
  );

  useEffect(() => {
    const firstInvalidField = (["email", "password", "confirmation"] as const).find(
      (field) => fieldErrors[field],
    );
    if (!firstInvalidField) return;
    document.getElementById(`${mode}-${firstInvalidField}`)?.focus();
  }, [fieldErrors, mode]);

  useEffect(() => {
    if (!isVerify || !effectiveToken || verificationStarted.current) return;
    verificationStarted.current = true;
    void submit();
  }, [effectiveToken, isVerify, submit]);

  const tokenMissing = isTokenMode && !effectiveToken;
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
      <section className="auth-card auth-card--state" aria-labelledby="verify-title">
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
    <section className="auth-card" aria-labelledby={`${mode}-title`}>
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
        aria-busy={pending || undefined}
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
      {(mode === "login" || mode === "signup") && (
        <div className="oauth-choice">
          <span>or</span>
          <a className="secondary-action" href="/api/auth/google">
            Continue with Google
          </a>
        </div>
      )}
      <AuthFeedback
        pending={pending}
        accepted={accepted}
        success={success}
        error={oauthMessage(oauthStatus) ?? error}
      />
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
