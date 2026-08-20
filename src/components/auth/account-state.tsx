"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/primitives";
import {
  APPEARANCE_RESET_REVISION,
  cacheAppearancePreference,
  clearAppearancePreferenceCache,
  notifyAppearanceChange,
  type AppearancePreference,
} from "@/components/theme/theme";
import { PendingFeedback } from "./pending-feedback";

interface AccountIdentity {
  provider: string;
  createdAt: string;
}

interface AccountPayload {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  status: "verified" | "unverified";
  identities: AccountIdentity[];
  appearance?: AppearancePreference;
  appearanceRevision?: string;
}

function csrfCookie(): string | undefined {
  const prefix = "taskfella_csrf=";
  const part = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!part) return undefined;
  try {
    return decodeURIComponent(part.slice(prefix.length));
  } catch {
    return undefined;
  }
}

async function csrfToken(): Promise<string> {
  await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  const token = csrfCookie();
  if (!token) throw new Error("csrf");
  return token;
}

function LogoutControl() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  async function logout(): Promise<void> {
    setPending(true);
    setMessage(undefined);
    try {
      const token = await csrfToken();
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "x-csrf-token": token },
      });
      if (!response.ok) throw new Error("logout");
      setMessageTone("success");
      clearAppearancePreferenceCache();
      notifyAppearanceChange("system", APPEARANCE_RESET_REVISION, { reset: true });
      setMessage("You are signed out.");
      router.push("/login");
    } catch {
      setMessageTone("error");
      setMessage("We could not sign you out safely. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="account-action">
      <Link className="secondary-action" href="/settings">
        Account settings
      </Link>
      <button
        className="ui-button ui-button--secondary account-action__button"
        type="button"
        onClick={logout}
        disabled={pending}
        aria-busy={pending || undefined}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {pending && <PendingFeedback message="Signing out…" />}
      {message && (
        <div
          className={`account-action__feedback account-action__feedback--${messageTone}`}
          role={messageTone === "error" ? "alert" : "status"}
          aria-live={messageTone === "error" ? "assertive" : "polite"}
        >
          {message}
        </div>
      )}
    </div>
  );
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
    case "success":
      return "Google sign-in succeeded. Your session was renewed.";
    case "linked":
      return "Google is now linked to this Taskfella account. Your session was renewed.";
    case "already-linked":
      return "That Google identity is already linked to this account. Your session was renewed.";
    case "conflict":
      return "That Google identity is linked to another Taskfella account. Nothing was changed.";
    case "email-conflict":
      return "That Google email belongs to another Taskfella account. Nothing was changed.";
    case "session-expired":
      return "Your account session expired before linking completed. Sign in and try again.";
    case "provider-error":
      return "Google sign-in could not be completed. Try again without changing your account.";
    case "cancelled":
      return "Google sign-in was cancelled. No account changes were made.";
    case "rate-limited":
      return "Too many Google sign-in attempts. Wait a while and try again.";
    default:
      return undefined;
  }
}

export function AccountState() {
  const oauthStatus = useSyncExternalStore(
    subscribeToLocation,
    currentOAuthStatus,
    serverOAuthStatus,
  );
  const [account, setAccount] = useState<AccountPayload>();
  const [pending, setPending] = useState(true);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [error, setError] = useState(false);
  const [linkPending, setLinkPending] = useState(false);
  const [linkError, setLinkError] = useState<string>();

  async function linkGoogle(): Promise<void> {
    setLinkPending(true);
    setLinkError(undefined);
    try {
      const token = await csrfToken();
      const response = await fetch("/api/auth/google?intent=link", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json", "x-csrf-token": token },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        authorizationUrl?: string;
      };
      if (!response.ok || !payload.authorizationUrl) throw new Error("link");
      window.location.assign(payload.authorizationUrl);
    } catch {
      setLinkError("We could not start Google linking safely. Try again.");
    } finally {
      setLinkPending(false);
    }
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/account", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          clearAppearancePreferenceCache();
          notifyAppearanceChange("system", APPEARANCE_RESET_REVISION, { reset: true });
          setUnauthenticated(true);
          return;
        }
        if (!response.ok) throw new Error("account");
        const payload = (await response.json()) as { account?: AccountPayload };
        if (!payload.account) throw new Error("account");
        setAccount(payload.account);
        cacheAppearancePreference(
          payload.account.appearance ?? "system",
          payload.account.appearanceRevision,
          payload.account.id,
        );
        notifyAppearanceChange(
          payload.account.appearance ?? "system",
          payload.account.appearanceRevision,
          { authenticated: true, identity: payload.account.id },
        );
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (pending) {
    return (
      <section
        className="auth-card auth-card--state"
        role="status"
        aria-labelledby="account-loading-title"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="auth-state">
          <StatusBadge status="neutral">Loading</StatusBadge>
          <p className="eyebrow">Current account</p>
          <h1 id="account-loading-title">Loading your account</h1>
          <p className="auth-intro">Checking the session associated with this browser…</p>
          <div className="auth-loading-line" aria-hidden="true" />
        </div>
      </section>
    );
  }
  if (unauthenticated) {
    return (
      <section className="auth-card auth-card--state" aria-labelledby="account-title">
        <div className="auth-state">
          <StatusBadge status="neutral">Signed out</StatusBadge>
          <p className="eyebrow">Current account</p>
          <h1 id="account-title">You are signed out.</h1>
          <p className="auth-intro">Sign in to inspect the account associated with this browser.</p>
          <div className="auth-state__actions">
            <Link className="ui-button ui-button--primary" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    );
  }
  if (error || !account) {
    return (
      <section
        className="auth-card auth-card--state"
        role="alert"
        aria-labelledby="account-error-title"
      >
        <div className="auth-state">
          <StatusBadge status="danger">Unable to load</StatusBadge>
          <p className="eyebrow">Current account</p>
          <h1 id="account-error-title">We could not load your account.</h1>
          <p className="auth-intro">
            Try again. No private account details were retained in this page.
          </p>
          <div className="auth-state__actions">
            <button
              className="ui-button ui-button--primary"
              type="button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  }

  const googleIdentity = account.identities.find((identity) => identity.provider === "google");
  const statusMessage = oauthMessage(oauthStatus);
  const statusTone =
    oauthStatus === "success" || oauthStatus === "linked" || oauthStatus === "already-linked"
      ? "feedback-success"
      : "feedback-error";

  return (
    <section className="auth-card" aria-labelledby="account-title">
      <StatusBadge status="success">Account active</StatusBadge>
      <p className="eyebrow">Current account</p>
      <h1 id="account-title">Your Taskfella account</h1>
      {statusMessage && (
        <p className={`auth-feedback ${statusTone}`} role="status" aria-live="polite">
          {statusMessage}
        </p>
      )}
      <dl className="account-details">
        <div>
          <dt>Email address</dt>
          <dd>{account.email}</dd>
        </div>
        <div>
          <dt>Verification</dt>
          <dd>{account.status === "verified" ? "Verified" : "Email verification pending"}</dd>
        </div>
        <div>
          <dt>Account created</dt>
          <dd>
            <time dateTime={account.createdAt}>
              {new Date(account.createdAt).toLocaleDateString()}
            </time>
          </dd>
        </div>
      </dl>
      <div className="account-identity" aria-labelledby="identity-title">
        <h2 id="identity-title">Sign-in methods</h2>
        {googleIdentity ? (
          <p className="identity-state">Google is linked to this account.</p>
        ) : (
          <>
            <p className="identity-state">
              Google is not linked. Start from here to authenticate with Google and explicitly add
              it to this account.
            </p>
            <button
              className="secondary-action button-action"
              type="button"
              onClick={() => void linkGoogle()}
              disabled={linkPending}
            >
              {linkPending ? "Starting Google linking…" : "Link Google account"}
            </button>
            {linkError && (
              <p className="auth-feedback feedback-error" role="alert">
                {linkError}
              </p>
            )}
          </>
        )}
      </div>
      <LogoutControl />
    </section>
  );
}
