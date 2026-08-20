import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { AccountState } from "@/components/auth/account-state";
import {
  AuthForm,
  authErrorMessage,
  CompletionState,
  TokenState,
} from "@/components/auth/auth-form";
import { AuthPage } from "@/components/auth/auth-page";
import { LogoutForm } from "@/components/auth/logout-form";

function markup(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

const authStyles = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

describe("authentication lifecycle UI", () => {
  it("keeps account forms labeled, touch-sized, and associated with help text", () => {
    const html = markup(createElement(AuthForm, { mode: "signup" }));

    expect(html).toContain('class="auth-card"');
    expect(html).toContain('for="signup-email"');
    expect(html).toContain('id="signup-email"');
    expect(html).toContain('aria-describedby="signup-email-help"');
    expect(html).toContain("Use at least 12 characters");
    expect(html).toContain('class="ui-button ui-button--primary auth-submit"');
    expect(html).toContain("Create account");
  });

  it("makes missing one-time links an explicit recoverable state without rendering a token", () => {
    const verification = markup(createElement(AuthForm, { mode: "verify" }));
    const reset = markup(createElement(AuthForm, { mode: "reset" }));

    expect(verification).toContain("This verification link is incomplete.");
    expect(verification).toContain("Request a fresh verification link");
    expect(verification).not.toContain("password");
    expect(reset).toContain("This reset link is incomplete.");
    expect(reset).toContain("Request a new reset link");
    expect(reset).not.toContain('name="password"');
  });

  it("preserves an explicit pending verification state and keeps the bearer value out of markup", () => {
    const html = markup(createElement(AuthForm, { mode: "verify", token: "secret-token" }));

    expect(html).toContain("Confirm your email address");
    expect(html).toContain("Checking your verification link");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("secret-token");
  });

  it("maps security-sensitive and recoverable failures to safe UI copy", () => {
    expect(authErrorMessage("INVALID_CREDENTIALS")).toBe("The email or password is incorrect.");
    expect(authErrorMessage("EMAIL_NOT_VERIFIED")).toContain("Verify your email address");
    expect(authErrorMessage("RATE_LIMITED")).toContain("Wait a while");
    expect(authErrorMessage("TOKEN_EXPIRED")).toContain("expired");
    expect(authErrorMessage("TOKEN_ALREADY_USED")).toContain("already been used");
    expect(authErrorMessage("INTERNAL_ERROR")).toContain("safely");
  });

  it("renders distinct expired, already-used, and successful one-time-link states", () => {
    const expired = markup(createElement(TokenState, { mode: "verify", code: "TOKEN_EXPIRED" }));
    const used = markup(createElement(TokenState, { mode: "reset", code: "TOKEN_ALREADY_USED" }));
    const success = markup(
      createElement(CompletionState, {
        mode: "reset",
        message: "Your password was reset. Sign in with the new password.",
      }),
    );

    expect(expired).toContain("This link has expired.");
    expect(expired).toContain("Request a fresh verification link");
    expect(used).toContain("This link has already been used.");
    expect(used).toContain("Request a new reset link");
    expect(success).toContain("Password reset");
    expect(success).toContain("Your password was reset");
  });

  it("keeps loading and session actions inside the same calm card frame", () => {
    const account = markup(createElement(AccountState));
    const logout = markup(createElement(LogoutForm));
    const page = markup(createElement(AuthPage, null, createElement("p", null, "Content")));

    expect(account).toContain("Loading your account");
    expect(account).toContain('aria-busy="true"');
    expect(logout).toContain("Sign out of Taskfella");
    expect(logout).toContain('class="ui-button ui-button--primary auth-submit"');
    expect(page).toContain('class="auth-identity"');
    expect(page).toContain("Private, focused personal work");
  });

  it("keeps authentication layouts responsive and removes nonessential motion", () => {
    expect(authStyles).toContain("@media (max-width: 560px)");
    expect(authStyles).toContain(".auth-header nav .nav-link");
    expect(authStyles).toContain(".auth-state__actions");
    expect(authStyles).toContain("min-height: var(--size-touch-target)");
    expect(authStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(authStyles).toContain(".auth-loading-line");
  });
});
