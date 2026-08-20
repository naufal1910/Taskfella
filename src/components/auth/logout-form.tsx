"use client";

import Link from "next/link";
import { useState } from "react";

function readCsrfCookie(): string | undefined {
  const prefix = "taskfella_csrf=";
  const part = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : undefined;
}

export function LogoutForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(): Promise<void> {
    setPending(true);
    setMessage(undefined);
    try {
      await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
      const token = readCsrfCookie();
      if (!token) throw new Error("csrf");
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "x-csrf-token": token },
      });
      if (!response.ok) throw new Error("logout");
      setMessage("You are signed out. The session cookie was cleared.");
    } catch {
      setMessage("We could not complete logout. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="logout-title">
      <p className="eyebrow">Session</p>
      <h1 id="logout-title">Sign out of Taskfella</h1>
      <p className="auth-intro">
        Your presented session will be revoked and its browser cookie cleared.
      </p>
      <button
        className="primary-action button-action"
        type="button"
        onClick={submit}
        disabled={pending}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      <p className="auth-feedback" aria-live="polite">
        {message}
      </p>
      <p className="auth-links">
        <Link href="/">Return home</Link>
      </p>
    </section>
  );
}
