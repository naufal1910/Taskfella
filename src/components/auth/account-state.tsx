"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
      setMessage("You are signed out.");
      router.push("/login");
    } catch {
      setMessage("We could not sign you out safely. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="account-action">
      <button
        className="secondary-action button-action"
        type="button"
        onClick={logout}
        disabled={pending}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      <span aria-live="polite">{message}</span>
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
      <p className="account-status" aria-busy="true" aria-live="polite">
        Loading your account…
      </p>
    );
  }
  if (unauthenticated) {
    return (
      <section className="auth-card" aria-labelledby="account-title">
        <p className="eyebrow">Current account</p>
        <h1 id="account-title">You are signed out.</h1>
        <p className="auth-intro">Sign in to inspect the account associated with this browser.</p>
        <Link className="primary-action" href="/login">
          Sign in
        </Link>
      </section>
    );
  }
  if (error || !account) {
    return (
      <section className="auth-card" role="alert" aria-labelledby="account-error-title">
        <p className="eyebrow">Current account</p>
        <h1 id="account-error-title">We could not load your account.</h1>
        <p className="auth-intro">
          Try again. No private account details were retained in this page.
        </p>
        <button
          className="primary-action button-action"
          type="button"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="auth-card" aria-labelledby="account-title">
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
