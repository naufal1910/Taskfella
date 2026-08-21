import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/login",
}));

import { AccountState } from "@/components/auth/account-state";
import VerifyEmailPage from "@/app/verify-email/page";
import ResetPasswordPage from "@/app/reset-password/page";
import {
  AuthForm,
  AuthFeedback,
  authErrorMessage,
  classifyAuthErrorCode,
  CompletionState,
  TokenState,
} from "@/components/auth/auth-form";
import { AuthPage } from "@/components/auth/auth-page";
import { LogoutForm } from "@/components/auth/logout-form";
import { PendingFeedback } from "@/components/auth/pending-feedback";

function markup(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

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
    const verification = markup(createElement(AuthForm, { mode: "verify", token: "" }));
    const reset = markup(createElement(AuthForm, { mode: "reset", token: "" }));

    expect(verification).toContain("This verification link is incomplete.");
    expect(verification).toContain("Request a fresh verification link");
    expect(verification).not.toContain("password");
    expect(reset).toContain("This reset link is incomplete.");
    expect(reset).toContain("Request a new reset link");
    expect(reset).not.toContain('name="password"');
  });

  it("does not serialize one-time bearer values through verification or reset page HTML", async () => {
    const token = "one-time-page-token";
    const props = { searchParams: Promise.resolve({ token }) };
    const verificationPage = VerifyEmailPage as unknown as (
      input: typeof props,
    ) => React.ReactElement | Promise<React.ReactElement>;
    const resetPage = ResetPasswordPage as unknown as (
      input: typeof props,
    ) => React.ReactElement | Promise<React.ReactElement>;
    const verification = markup(await verificationPage(props));
    const reset = markup(await resetPage(props));

    expect(verification).not.toContain(token);
    expect(reset).not.toContain(token);
    expect(verification).not.toContain('name="token"');
    expect(reset).not.toContain('name="token"');
  });

  it("preserves an explicit pending verification state and keeps the bearer value out of markup", () => {
    const html = markup(createElement(AuthForm, { mode: "verify", token: "secret-token" }));

    expect(html).toContain("Confirm your email address");
    expect(html).toContain("Checking your verification link");
    expect(html).toContain('class="auth-feedback auth-feedback--pending"');
    expect(html).toContain('role="status"');
    expect(html).not.toContain("secret-token");
  });

  it("keeps accepted email requests explicitly pending and generic", () => {
    const html = markup(
      createElement(AuthFeedback, {
        pending: false,
        accepted: "If this address can be registered, we sent a verification link.",
      }),
    );

    expect(html).toContain("Request received");
    expect(html).toContain("If this address can be registered");
    expect(html).toContain('class="auth-feedback auth-feedback--pending"');
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Complete");
  });

  it("maps security-sensitive and recoverable failures to safe UI copy", () => {
    expect(authErrorMessage("INVALID_CREDENTIALS")).toBe("The email or password is incorrect.");
    expect(authErrorMessage("EMAIL_NOT_VERIFIED")).toContain("Verify your email address");
    expect(authErrorMessage("RATE_LIMITED")).toContain("Wait a while");
    expect(authErrorMessage("TOKEN_EXPIRED")).toContain("expired");
    expect(authErrorMessage("TOKEN_ALREADY_USED")).toContain("already been used");
    expect(authErrorMessage("INTERNAL_ERROR")).toContain("safely");
  });

  it("classifies malformed token requests without hiding reset field errors", () => {
    expect(classifyAuthErrorCode("verify", "INVALID_REQUEST", {})).toBe("TOKEN_INVALID");
    expect(classifyAuthErrorCode("reset", "INVALID_REQUEST", {})).toBe("TOKEN_INVALID");
    expect(
      classifyAuthErrorCode("reset", "INVALID_REQUEST", {
        password: "Use at least 12 characters.",
      }),
    ).toBe("INVALID_REQUEST");
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
    expect(account).toContain('role="status"');
    expect(account).toContain('aria-live="polite"');
    expect(account).not.toContain('aria-busy="true"');
    expect(logout).toContain("Sign out of Taskfella");
    expect(logout).toContain('class="ui-button ui-button--primary auth-submit"');
    expect(page).toContain('class="auth-identity"');
    expect(page).toContain('class="auth-main" tabindex="-1"');
    expect(page).toContain("Private, focused personal work");
  });

  it("renders outcome focus targets and announcements for async auth states", () => {
    const expired = markup(createElement(TokenState, { mode: "verify", code: "TOKEN_EXPIRED" }));
    const success = markup(
      createElement(CompletionState, { mode: "reset", message: "Password reset complete." }),
    );
    const pending = markup(createElement(PendingFeedback, { message: "Signing out…" }));

    expect(expired).toContain('role="alert"');
    expect(expired).toContain('aria-live="assertive"');
    expect(expired).toContain('tabindex="-1"');
    expect(success).toContain('role="status"');
    expect(success).toContain('aria-live="polite"');
    expect(success).toContain('tabindex="-1"');
    expect(pending).toContain('role="status"');
    expect(pending).toContain('aria-live="polite"');
    expect(pending).not.toContain('aria-busy="true"');
  });
});
