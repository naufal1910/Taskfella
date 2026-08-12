import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { eq, count } from "drizzle-orm";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as verify } from "@/app/api/auth/verify-email/route";
import { POST as resend } from "@/app/api/auth/resend-verification/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { GET as account } from "@/app/api/account/route";
import { closeDatabase, getDatabase } from "@/server/db/client";
import { accounts, passwordResetTokens } from "@/server/db/schema";
import { createAccount, setPasswordCredential } from "@/server/modules/auth/accounts";
import { createSession, lookupSession } from "@/server/modules/auth/sessions";
import {
  authenticateAndIssueSession,
  createAccountWithPasswordAndVerification,
  issuePasswordResetToken,
  resetPasswordWithToken,
} from "@/server/modules/auth/lifecycle";
import { hashBearerToken } from "@/server/modules/auth/tokens";
import { resetEnvironmentForTests } from "@/server/config/env";
import { AppError } from "@/server/http/errors";
import { enforceAuthRateLimits } from "@/server/http/auth-route";

const integration = process.env.DATABASE_URL ? describe : describe.skip;
const db = process.env.DATABASE_URL ? getDatabase() : undefined;
const mailDirectory = path.join(process.cwd(), ".local", "mail-phase1b-test");
const createdAccountIds: string[] = [];
let requestNumber = 0;

function uniqueEmail(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}@example.test`;
}

function uniquePassword(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}-passphrase`;
}

function cookieValue(response: Response, name: string): string | undefined {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function request(
  pathname: string,
  options: {
    method?: string;
    body?: unknown;
    session?: string;
    csrf?: string;
    forwardedFor?: string;
  } = {},
): Request {
  const csrf = options.csrf ?? `csrf-${crypto.randomUUID()}`;
  const cookies = [`taskfella_csrf=${encodeURIComponent(csrf)}`];
  if (options.session) cookies.push(`taskfella_session=${encodeURIComponent(options.session)}`);
  const headers = new Headers({
    origin: "http://localhost:3000",
    cookie: cookies.join("; "),
    "x-csrf-token": csrf,
    "x-forwarded-for": options.forwardedFor ?? `2001:db8::${requestNumber++}`,
  });
  if (options.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`http://localhost:3000${pathname}`, {
    method: options.method ?? "POST",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function capturedMessages(): Promise<
  Array<{ kind: string; link: string; text: string; html: string }>
> {
  const files = (await readdir(mailDirectory)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(
    files.map(async (file) => JSON.parse(await readFile(path.join(mailDirectory, file), "utf8"))),
  );
}

async function rememberAccount(email: string): Promise<void> {
  if (!db) return;
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.normalizedEmail, email));
  if (row) createdAccountIds.push(row.id);
}

function resetPasswordRequest(token: string, password: string): Promise<Response> {
  return reset(request("/api/auth/reset-password", { body: { token, password } }));
}

integration("Phase 1B email/password route behavior", () => {
  beforeAll(async () => {
    process.env.EMAIL_DELIVERY_MODE = "local";
    process.env.EMAIL_LOCAL_CAPTURE_DIR = mailDirectory;
    process.env.AUTH_TRUSTED_PROXY = "true";
    resetEnvironmentForTests();
    await rm(mailDirectory, { recursive: true, force: true });
  });

  afterAll(async () => {
    if (db) {
      for (const accountId of createdAccountIds) {
        await db.delete(accounts).where(eq(accounts.id, accountId));
      }
      await closeDatabase();
    }
    await rm(mailDirectory, { recursive: true, force: true });
  });

  it("signup, verifies, logs in, reads current account, logs out, resets, and invalidates sessions", async () => {
    if (!db) return;
    const email = uniqueEmail("lifecycle");
    const password = uniquePassword("first");
    const replacement = uniquePassword("replacement");

    const signupResponse = await signup(request("/api/auth/signup", { body: { email, password } }));
    expect(signupResponse.status).toBe(202);
    expect(await signupResponse.json()).toMatchObject({ ok: true, status: "pending" });

    const signupMessages = await capturedMessages();
    expect(signupMessages).toHaveLength(1);
    expect(signupMessages[0]).toMatchObject({ kind: "verification" });
    expect(signupMessages[0]?.text).toContain("expires");
    expect(signupMessages[0]?.html).toContain("Verify email address");
    const verificationToken = new URL(signupMessages[0]!.link).searchParams.get("token");
    expect(verificationToken).toBeTruthy();
    await rememberAccount(email);

    const verifiedResponse = await verify(
      request("/api/auth/verify-email", { body: { token: verificationToken } }),
    );
    expect(verifiedResponse.status).toBe(200);
    expect(await verifiedResponse.json()).toMatchObject({ ok: true, status: "success" });

    const replay = await verify(
      request("/api/auth/verify-email", { body: { token: verificationToken } }),
    );
    expect(replay.status).toBe(409);
    expect(await replay.json()).toMatchObject({ error: { code: "TOKEN_ALREADY_USED" } });

    const loginResponse = await login(request("/api/auth/login", { body: { email, password } }));
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers.get("cache-control")).toBe("no-store");
    const session = cookieValue(loginResponse, "taskfella_session");
    expect(session).toBeTruthy();
    expect(loginResponse.headers.get("set-cookie")).toContain("HttpOnly");
    expect(loginResponse.headers.get("set-cookie")?.toLowerCase()).toContain("samesite=lax");

    const current = await account(
      new Request("http://localhost:3000/api/account", {
        headers: { cookie: `taskfella_session=${encodeURIComponent(session!)}` },
      }),
    );
    expect(current.status).toBe(200);
    expect(await current.json()).toMatchObject({ account: { email, status: "verified" } });

    const logoutResponse = await logout(request("/api/auth/logout", { session }));
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get("set-cookie")).toContain("Max-Age=0");
    const afterLogout = await account(
      new Request("http://localhost:3000/api/account", {
        headers: { cookie: `taskfella_session=${encodeURIComponent(session!)}` },
      }),
    );
    expect(afterLogout.status).toBe(401);

    const secondLogin = await login(request("/api/auth/login", { body: { email, password } }));
    const priorSession = cookieValue(secondLogin, "taskfella_session");
    expect(priorSession).toBeTruthy();

    const forgotResponse = await forgot(request("/api/auth/forgot-password", { body: { email } }));
    expect(forgotResponse.status).toBe(202);
    const resetMessages = await capturedMessages();
    expect(resetMessages).toHaveLength(2);
    const resetToken = new URL(resetMessages[1]!.link).searchParams.get("token");
    expect(resetToken).toBeTruthy();

    const resetResponse = await reset(
      request("/api/auth/reset-password", {
        session: priorSession,
        body: { token: resetToken, password: replacement },
      }),
    );
    expect(resetResponse.status).toBe(200);
    expect(resetResponse.headers.get("set-cookie")).toContain("Max-Age=0");

    const invalidated = await account(
      new Request("http://localhost:3000/api/account", {
        headers: { cookie: `taskfella_session=${encodeURIComponent(priorSession!)}` },
      }),
    );
    expect(invalidated.status).toBe(401);

    const oldPassword = await login(request("/api/auth/login", { body: { email, password } }));
    expect(oldPassword.status).toBe(401);
    expect(await oldPassword.json()).toMatchObject({ error: { code: "INVALID_CREDENTIALS" } });
    const newPassword = await login(
      request("/api/auth/login", { body: { email, password: replacement } }),
    );
    expect(newPassword.status).toBe(200);
  });

  it("keeps verification and reset responses generic, rotates superseded links, and handles duplicates", async () => {
    if (!db) return;
    const email = uniqueEmail("superseded");
    const password = uniquePassword("signup");
    const duplicateRequests = await Promise.all(
      Array.from({ length: 2 }, () =>
        signup(request("/api/auth/signup", { body: { email, password } })),
      ),
    );
    expect(duplicateRequests.map((response) => response.status)).toEqual([202, 202]);
    const [accountCount] = await db
      .select({ count: count() })
      .from(accounts)
      .where(eq(accounts.normalizedEmail, email));
    expect(accountCount?.count).toBe(1);
    await rememberAccount(email);

    const initialMessages = await capturedMessages();
    const firstVerification = new URL(initialMessages.at(-1)!.link).searchParams.get("token");
    const resendResponse = await resend(
      request("/api/auth/resend-verification", { body: { email } }),
    );
    expect(resendResponse.status).toBe(202);
    const rotatedMessages = await capturedMessages();
    const secondVerification = new URL(rotatedMessages.at(-1)!.link).searchParams.get("token");
    expect(secondVerification).not.toBe(firstVerification);

    const superseded = await verify(
      request("/api/auth/verify-email", { body: { token: firstVerification } }),
    );
    expect(superseded.status).toBe(410);
    expect(await superseded.json()).toMatchObject({ error: { code: "TOKEN_SUPERSEDED" } });
    const verified = await verify(
      request("/api/auth/verify-email", { body: { token: secondVerification } }),
    );
    expect(verified.status).toBe(200);

    const unknownEmail = uniqueEmail("unknown");
    const unknownForgot = await forgot(
      request("/api/auth/forgot-password", { body: { email: unknownEmail } }),
    );
    const knownForgot = await forgot(request("/api/auth/forgot-password", { body: { email } }));
    expect(unknownForgot.status).toBe(202);
    expect(knownForgot.status).toBe(202);
    expect(await unknownForgot.json()).toEqual(await knownForgot.json());

    const allMessages = await capturedMessages();
    const latestReset = new URL(allMessages.at(-1)!.link).searchParams.get("token");
    const secondResetRequest = await forgot(
      request("/api/auth/forgot-password", { body: { email } }),
    );
    expect(secondResetRequest.status).toBe(202);
    const afterSecondReset = await capturedMessages();
    const newerReset = new URL(afterSecondReset.at(-1)!.link).searchParams.get("token");
    const oldReset = await reset(
      request("/api/auth/reset-password", {
        body: { token: latestReset, password: uniquePassword("old-reset") },
      }),
    );
    expect(oldReset.status).toBe(410);
    expect(await oldReset.json()).toMatchObject({ error: { code: "TOKEN_SUPERSEDED" } });
    expect(newerReset).not.toBe(latestReset);

    const expiredCreatedAt = new Date(Date.now() - 2_000);
    await db
      .update(passwordResetTokens)
      .set({ createdAt: expiredCreatedAt, expiresAt: new Date(expiredCreatedAt.getTime() + 1_000) })
      .where(eq(passwordResetTokens.tokenHash, hashBearerToken(newerReset!)));
    const expiredReset = await reset(
      request("/api/auth/reset-password", {
        body: { token: newerReset, password: uniquePassword("expired-reset") },
      }),
    );
    expect(expiredReset.status).toBe(410);
    expect(await expiredReset.json()).toMatchObject({ error: { code: "TOKEN_EXPIRED" } });
  });

  it("lets only one concurrent verifier or resetter consume a one-time token", async () => {
    if (!db) return;
    const email = uniqueEmail("concurrent");
    const password = uniquePassword("concurrent");
    const created = await createAccountWithPasswordAndVerification(db, { email, password });
    createdAccountIds.push(created.account.id);

    const verificationResults = await Promise.all(
      [0, 1].map(() =>
        verify(request("/api/auth/verify-email", { body: { token: created.verification.token } })),
      ),
    );
    expect(verificationResults.filter((response) => response.status === 200)).toHaveLength(1);
    expect(verificationResults.filter((response) => response.status === 409)).toHaveLength(1);

    const reset = await issuePasswordResetToken(db, created.account.id);
    expect(reset).not.toBeNull();
    const firstSession = await createSession(db, created.account.id);
    const secondSession = await createSession(db, created.account.id);
    const resetResults = await Promise.all(
      [0, 1].map(() =>
        resetPasswordRequest(reset!.reset.token, uniquePassword("concurrent-reset")),
      ),
    );
    expect(resetResults.filter((response) => response.status === 200)).toHaveLength(1);
    expect(resetResults.filter((response) => response.status === 409)).toHaveLength(1);
    expect(await lookupSession(db, firstSession.token)).toBeNull();
    expect(await lookupSession(db, secondSession.token)).toBeNull();
  });

  it("serializes login session issuance with a concurrent password reset", async () => {
    if (!db) return;
    const email = uniqueEmail("login-reset-race");
    const password = uniquePassword("login-reset-race");
    const replacement = uniquePassword("login-reset-replacement");
    const created = await createAccount(db, { email });
    await setPasswordCredential(db, created.id, password);
    await db
      .update(accounts)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(accounts.id, created.id));
    const issued = await issuePasswordResetToken(db, created.id);
    expect(issued).not.toBeNull();

    const [loginResult, resetResult] = await Promise.all([
      authenticateAndIssueSession(db, { email, password }),
      resetPasswordWithToken(db, issued!.reset.token, replacement),
    ]);

    expect(resetResult).toEqual({ accountId: created.id });
    if (loginResult.state === "authenticated") {
      expect(await lookupSession(db, loginResult.token)).toBeNull();
    } else {
      expect(loginResult).toEqual({ state: "invalid-credentials" });
    }

    createdAccountIds.push(created.id);
  });

  it("does not reuse a foreign browser session when logging into another account", async () => {
    if (!db) return;
    const targetEmail = uniqueEmail("target");
    const foreignEmail = uniqueEmail("foreign");
    const targetPassword = uniquePassword("target");
    const now = new Date();
    const target = await createAccount(db, { email: targetEmail, now });
    const foreign = await createAccount(db, { email: foreignEmail, now });
    await setPasswordCredential(db, target.id, targetPassword, now);
    await setPasswordCredential(db, foreign.id, uniquePassword("foreign"), now);
    await db.update(accounts).set({ emailVerifiedAt: now }).where(eq(accounts.id, target.id));
    const foreignSession = await createSession(db, foreign.id, { now });

    const response = await login(
      request("/api/auth/login", {
        session: foreignSession.token,
        body: { email: targetEmail, password: targetPassword },
      }),
    );
    expect(response.status).toBe(200);
    const replacement = cookieValue(response, "taskfella_session");
    expect(replacement).toBeTruthy();
    expect(await lookupSession(db, foreignSession.token)).toBeNull();
    expect(await lookupSession(db, replacement!)).toMatchObject({ accountId: target.id });

    createdAccountIds.push(target.id, foreign.id);
  });

  it("rejects malformed and cross-site mutations, blocks unverified login, and rate-limits attempts", async () => {
    if (!db) return;
    const email = uniqueEmail("unverified");
    const password = uniquePassword("unverified");
    const created = await signup(request("/api/auth/signup", { body: { email, password } }));
    expect(created.status).toBe(202);
    await rememberAccount(email);

    const unverifiedLogin = await login(request("/api/auth/login", { body: { email, password } }));
    expect(unverifiedLogin.status).toBe(403);
    expect(await unverifiedLogin.json()).toMatchObject({ error: { code: "EMAIL_NOT_VERIFIED" } });

    const malformed = await signup(
      request("/api/auth/signup", { body: { email: "not-an-email", password: "short" } }),
    );
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });

    const csrfFailure = await login(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "https://evil.example", "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      }),
    );
    expect(csrfFailure.status).toBe(403);

    const limitedEmail = uniqueEmail("limited");
    const attempts = await Promise.all(
      Array.from({ length: 11 }, () =>
        login(request("/api/auth/login", { body: { email: limitedEmail, password } })),
      ),
    );
    expect(attempts.filter((response) => response.status === 429)).not.toHaveLength(0);

    const verificationAttempts = await Promise.all(
      Array.from({ length: 6 }, () =>
        verify(
          request("/api/auth/verify-email", {
            body: { token: crypto.randomUUID() },
            forwardedFor: "198.51.100.40",
          }),
        ),
      ),
    );
    expect(verificationAttempts.filter((response) => response.status === 429)).not.toHaveLength(0);
  });

  it("rejects forwarding addresses when the proxy trust contract is disabled", async () => {
    if (!db) return;
    const original = process.env.AUTH_TRUSTED_PROXY;
    process.env.AUTH_TRUSTED_PROXY = "false";
    resetEnvironmentForTests();
    try {
      const result = await enforceAuthRateLimits(
        request("/api/auth/login", { forwardedFor: "203.0.113.10" }),
        db,
        "oauthFailure",
        `unique-identity-${crypto.randomUUID()}`,
      ).catch((error: unknown) => error);

      expect(result).toMatchObject({ code: "FORBIDDEN" });
      expect(result).toBeInstanceOf(AppError);
    } finally {
      process.env.AUTH_TRUSTED_PROXY = original;
      resetEnvironmentForTests();
    }
  });
});
