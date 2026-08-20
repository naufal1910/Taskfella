"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/primitives";
import { notifyAppearanceChange } from "@/components/theme/theme";
import { PendingFeedback } from "./pending-feedback";

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
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

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
      setMessageTone("success");
      notifyAppearanceChange();
      setMessage("You are signed out. The session cookie was cleared.");
    } catch {
      setMessageTone("error");
      setMessage("We could not complete logout safely. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="logout-title">
      <StatusBadge
        status={
          pending ? "neutral" : messageTone === "error" ? "danger" : message ? "success" : "neutral"
        }
      >
        {pending
          ? "In progress"
          : messageTone === "error"
            ? "Needs attention"
            : message
              ? "Complete"
              : "Session"}
      </StatusBadge>
      <p className="eyebrow">Session</p>
      <h1 id="logout-title">Sign out of Taskfella</h1>
      <p className="auth-intro">
        Your presented session will be revoked and its browser cookie cleared.
      </p>
      <button
        className="ui-button ui-button--primary auth-submit"
        type="button"
        onClick={submit}
        disabled={pending}
        aria-busy={pending || undefined}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {pending && <PendingFeedback message="Signing out…" />}
      {message && (
        <div
          className={`auth-feedback auth-feedback--${messageTone}`}
          role={messageTone === "error" ? "alert" : "status"}
          aria-live={messageTone === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          <strong>{messageTone === "error" ? "Unable to continue" : "Complete"}</strong>
          <p>{message}</p>
        </div>
      )}
      <div className="auth-links">
        <Link href="/">Return home</Link>
      </div>
    </section>
  );
}
