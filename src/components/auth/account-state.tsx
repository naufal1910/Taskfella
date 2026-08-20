"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/primitives";
import { PendingFeedback } from "./pending-feedback";

interface AccountPayload {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  status: "verified" | "unverified";
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

export function AccountState() {
  const [account, setAccount] = useState<AccountPayload>();
  const [pending, setPending] = useState(true);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/account", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          setUnauthenticated(true);
          return;
        }
        if (!response.ok) throw new Error("account");
        const payload = (await response.json()) as { account?: AccountPayload };
        if (!payload.account) throw new Error("account");
        setAccount(payload.account);
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
        aria-labelledby="account-loading-title"
        aria-busy="true"
        aria-live="polite"
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

  return (
    <section className="auth-card" aria-labelledby="account-title">
      <StatusBadge status="success">Account active</StatusBadge>
      <p className="eyebrow">Current account</p>
      <h1 id="account-title">Your Taskfella account</h1>
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
      <LogoutControl />
    </section>
  );
}
