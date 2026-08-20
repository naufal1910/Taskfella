import { afterAll, describe, expect, it } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { GET as accountRoute } from "@/app/api/account/route";
import { closeDatabase, getDatabase } from "@/server/db/client";
import { parseEnvironment } from "@/server/config/env";
import { accounts, oauthIdentities, oauthTransactions } from "@/server/db/schema";
import { createAccount, setPasswordCredential } from "@/server/modules/auth/accounts";
import { handleGoogleCallback, startGoogleAuthorization } from "@/server/modules/auth/oauth-flow";
import { type GoogleIdentityProfile, type GoogleOAuthClient } from "@/server/modules/auth/google";
import { hashBearerToken } from "@/server/modules/auth/tokens";
import { createSession, lookupSession, revokeSession } from "@/server/modules/auth/sessions";

const integration = process.env.DATABASE_URL ? describe : describe.skip;
const db = process.env.DATABASE_URL ? getDatabase() : undefined;

const environment = parseEnvironment({
  NODE_ENV: "test",
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgresql://taskfella:taskfella@localhost:5433/taskfella",
  APP_URL: "http://localhost:3000",
  AUTH_TRUSTED_PROXY: "true",
  GOOGLE_CLIENT_ID: "local-placeholder.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "replace-with-google-client-secret",
});

const createdAccountIds: string[] = [];
const createdStateHashes: string[] = [];
let requestNumber = 0;

function uniqueEmail(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}@example.test`;
}

function cookieValue(response: Response, name: string): string | undefined {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${name}=([^;,]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function cookieHeader(values: Record<string, string | undefined>): string {
  return Object.entries(values)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

function callbackRequest(
  state: string,
  verifier: string,
  options: { session?: string; error?: string; wrongVerifier?: boolean } = {},
): Request {
  const callback = new URL("http://localhost:3000/api/auth/google/callback");
  callback.searchParams.set("state", state);
  if (options.error) {
    callback.searchParams.set("error", options.error);
  } else {
    callback.searchParams.set("code", crypto.randomUUID());
  }
  return new Request(callback, {
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-for": `198.51.100.${(requestNumber++ % 200) + 1}`,
      cookie: cookieHeader({
        taskfella_oauth_state: state,
        taskfella_oauth_verifier: options.wrongVerifier ? "wrong-pkce-verifier" : verifier,
        taskfella_session: options.session,
      }),
    },
  });
}

function startRequest(intent: "signin" | "link", session?: string): Request {
  const url = new URL("http://localhost:3000/api/auth/google");
  if (intent === "link") url.searchParams.set("intent", "link");
  const csrf = intent === "link" ? "csrf-test-token" : undefined;
  return new Request(url, {
    method: intent === "link" ? "POST" : "GET",
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-for": `198.51.100.${(requestNumber++ % 200) + 1}`,
      "x-csrf-token": csrf ?? "",
      cookie: cookieHeader({ taskfella_session: session, taskfella_csrf: csrf }),
    },
  });
}

function providerFor(
  profile: GoogleIdentityProfile,
  options: { calls?: number[] } = {},
): GoogleOAuthClient {
  return {
    getAuthorizationUrl({ state, codeChallenge }) {
      const url = new URL("https://accounts.google.test/authorize");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      return url.toString();
    },
    async fetchIdentity() {
      if (options.calls) options.calls[0] = (options.calls[0] ?? 0) + 1;
      return profile;
    },
  };
}

async function begin(
  intent: "signin" | "link",
  profile: GoogleIdentityProfile,
  session?: string,
  provider: GoogleOAuthClient = providerFor(profile),
): Promise<{ state: string; verifier: string; response: Response; provider: GoogleOAuthClient }> {
  if (!db) throw new Error("Database integration is unavailable.");
  const response = await startGoogleAuthorization(startRequest(intent, session), {
    db,
    environment,
    provider,
  });
  const location = response.headers.get("location");
  const state = cookieValue(response, "taskfella_oauth_state");
  const verifier = cookieValue(response, "taskfella_oauth_verifier");
  if (!location || !state || !verifier) throw new Error("OAuth ceremony did not start.");
  createdStateHashes.push(hashBearerToken(state));
  return { state, verifier, response, provider };
}

async function rememberAccountByEmail(email: string): Promise<string> {
  if (!db) throw new Error("Database integration is unavailable.");
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.normalizedEmail, email));
  if (!row) throw new Error("Account was not created.");
  createdAccountIds.push(row.id);
  return row.id;
}

async function accountWithPassword(
  email: string,
): Promise<{ id: string; session: string; email: string }> {
  if (!db) throw new Error("Database integration is unavailable.");
  const account = await createAccount(db, { email });
  createdAccountIds.push(account.id);
  await setPasswordCredential(db, account.id, "a sufficiently long local passphrase");
  await db.update(accounts).set({ emailVerifiedAt: new Date() }).where(eq(accounts.id, account.id));
  const session = await createSession(db, account.id);
  return { id: account.id, session: session.token, email: account.email };
}

async function cleanupState(stateHash: string): Promise<void> {
  if (!db) return;
  await db.delete(oauthTransactions).where(eq(oauthTransactions.stateHash, stateHash));
}

integration("Google OAuth and explicit identity linking", () => {
  afterAll(async () => {
    if (db) {
      for (const stateHash of createdStateHashes) {
        await cleanupState(stateHash);
      }
      for (const accountId of createdAccountIds) {
        await db.delete(accounts).where(eq(accounts.id, accountId));
      }
      await closeDatabase();
    }
  });

  it("creates a verified app-owned account and rotates to an opaque session", async () => {
    if (!db) return;
    const profile = {
      subject: `google-subject-${crypto.randomUUID()}`,
      email: uniqueEmail("google-new"),
    };
    const ceremony = await begin("signin", profile);
    expect(ceremony.response.status).toBe(302);
    expect(ceremony.response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(ceremony.response.headers.get("set-cookie")?.toLowerCase()).toContain("samesite=lax");
    const [storedCeremony] = await db
      .select({
        stateHash: oauthTransactions.stateHash,
        codeVerifierHash: oauthTransactions.codeVerifierHash,
      })
      .from(oauthTransactions)
      .where(eq(oauthTransactions.stateHash, hashBearerToken(ceremony.state)));
    expect(storedCeremony?.stateHash).not.toBe(ceremony.state);
    expect(storedCeremony?.codeVerifierHash).not.toBe(ceremony.verifier);

    const callback = await handleGoogleCallback(
      callbackRequest(ceremony.state, ceremony.verifier),
      { db, environment, provider: ceremony.provider },
    );

    expect(callback.status).toBe(303);
    expect(callback.headers.get("location")).toContain("/account?oauth=success");
    expect(callback.headers.get("cache-control")).toBe("no-store");
    expect(callback.headers.get("referrer-policy")).toBe("no-referrer");
    const session = cookieValue(callback, "taskfella_session");
    expect(session).toBeTruthy();
    expect(await lookupSession(db, session!)).toMatchObject({ accountId: expect.any(String) });

    const accountId = await rememberAccountByEmail(profile.email);
    const [identity] = await db
      .select({
        accountId: oauthIdentities.accountId,
        provider: oauthIdentities.provider,
        subject: oauthIdentities.providerSubject,
      })
      .from(oauthIdentities)
      .where(eq(oauthIdentities.accountId, accountId));
    expect(identity).toEqual({ accountId, provider: "google", subject: profile.subject });
    expect(callback.headers.get("set-cookie")).toContain("taskfella_oauth_state=");
    expect(callback.headers.get("set-cookie")).not.toContain("access_token");
  });

  it("does not silently link a same-email Google identity", async () => {
    if (!db) return;
    const email = uniqueEmail("same-email");
    const owner = await accountWithPassword(email);
    const profile = { subject: `google-subject-${crypto.randomUUID()}`, email };
    const ceremony = await begin("signin", profile);
    const callback = await handleGoogleCallback(
      callbackRequest(ceremony.state, ceremony.verifier),
      { db, environment, provider: ceremony.provider },
    );

    expect(callback.headers.get("location")).toContain("/login?oauth=provider-error");
    expect(cookieValue(callback, "taskfella_session")).toBeUndefined();
    expect(await lookupSession(db, owner.session)).toMatchObject({ accountId: owner.id });
    expect(
      await db
        .select()
        .from(oauthIdentities)
        .where(eq(oauthIdentities.providerSubject, profile.subject)),
    ).toHaveLength(0);
  });

  it("requires a same-origin CSRF-protected POST to start linking", async () => {
    if (!db) return;
    const owner = await accountWithPassword(uniqueEmail("csrf-link"));
    const url = new URL("http://localhost:3000/api/auth/google?intent=link");
    const provider = providerFor({
      subject: `google-subject-${crypto.randomUUID()}`,
      email: owner.email,
    });

    await expect(
      startGoogleAuthorization(
        new Request(url, {
          headers: {
            origin: "http://localhost:3000",
            cookie: cookieHeader({ taskfella_session: owner.session }),
          },
        }),
        { db, environment, provider },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      startGoogleAuthorization(
        new Request(url, {
          method: "POST",
          headers: {
            origin: "https://evil.example",
            "x-csrf-token": "csrf-test-token",
            cookie: cookieHeader({
              taskfella_session: owner.session,
              taskfella_csrf: "csrf-test-token",
            }),
          },
        }),
        { db, environment, provider },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      startGoogleAuthorization(
        new Request("http://localhost:3000/api/auth/google", {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
        }),
        { db, environment, provider },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("links explicitly, rotates the linking session, and keeps provider subjects private", async () => {
    if (!db) return;
    const email = uniqueEmail("explicit-link");
    const owner = await accountWithPassword(email);
    const profile = { subject: `google-subject-${crypto.randomUUID()}`, email };
    const ceremony = await begin("link", profile, owner.session);
    const callback = await handleGoogleCallback(
      callbackRequest(ceremony.state, ceremony.verifier, { session: owner.session }),
      { db, environment, provider: ceremony.provider },
    );

    expect(callback.headers.get("location")).toContain("/account?oauth=linked");
    expect(await lookupSession(db, owner.session)).toBeNull();
    const replacement = cookieValue(callback, "taskfella_session");
    expect(replacement).toBeTruthy();
    expect(await lookupSession(db, replacement!)).toMatchObject({ accountId: owner.id });

    const accountResponse = await accountRoute(
      new Request("http://localhost:3000/api/account", {
        headers: { cookie: cookieHeader({ taskfella_session: replacement }) },
      }),
    );
    const payload = (await accountResponse.json()) as { account: { identities: unknown[] } };
    expect(payload.account.identities).toEqual([
      { provider: "google", createdAt: expect.any(String) },
    ]);
    expect(JSON.stringify(payload)).not.toContain(profile.subject);
  });

  it("serializes reciprocal email-conflict links without deadlocking", async () => {
    if (!db) return;
    const first = await accountWithPassword(uniqueEmail("reciprocal-first"));
    const second = await accountWithPassword(uniqueEmail("reciprocal-second"));
    const firstProfile = {
      subject: `google-subject-${crypto.randomUUID()}`,
      email: second.email,
    };
    const secondProfile = {
      subject: `google-subject-${crypto.randomUUID()}`,
      email: first.email,
    };
    const firstCeremony = await begin("link", firstProfile, first.session);
    const secondCeremony = await begin("link", secondProfile, second.session);

    const [firstResponse, secondResponse] = await Promise.all([
      handleGoogleCallback(
        callbackRequest(firstCeremony.state, firstCeremony.verifier, { session: first.session }),
        { db, environment, provider: firstCeremony.provider },
      ),
      handleGoogleCallback(
        callbackRequest(secondCeremony.state, secondCeremony.verifier, {
          session: second.session,
        }),
        { db, environment, provider: secondCeremony.provider },
      ),
    ]);

    expect(firstResponse.headers.get("location")).toContain("/account?oauth=email-conflict");
    expect(secondResponse.headers.get("location")).toContain("/account?oauth=email-conflict");
    expect(await lookupSession(db, first.session)).toMatchObject({ accountId: first.id });
    expect(await lookupSession(db, second.session)).toMatchObject({ accountId: second.id });
  });

  it("rolls back a new identity when the bound linking session is no longer valid", async () => {
    if (!db) return;
    const email = uniqueEmail("expired-link");
    const owner = await accountWithPassword(email);
    const profile = { subject: `google-subject-${crypto.randomUUID()}`, email };
    const ceremony = await begin("link", profile, owner.session);
    expect(await revokeSession(db, owner.session, "test-revoked")).toBe(true);

    const callback = await handleGoogleCallback(
      callbackRequest(ceremony.state, ceremony.verifier, { session: owner.session }),
      { db, environment, provider: ceremony.provider },
    );

    expect(callback.headers.get("location")).toContain("/login?oauth=session-expired");
    expect(
      await db
        .select()
        .from(oauthIdentities)
        .where(eq(oauthIdentities.providerSubject, profile.subject)),
    ).toHaveLength(0);
  });

  it("reports already-linked identities without replacing them", async () => {
    if (!db) return;
    const email = uniqueEmail("already-linked");
    const owner = await accountWithPassword(email);
    const profile = { subject: `google-subject-${crypto.randomUUID()}`, email };
    const first = await begin("link", profile, owner.session);
    const linked = await handleGoogleCallback(
      callbackRequest(first.state, first.verifier, { session: owner.session }),
      { db, environment, provider: first.provider },
    );
    const current = cookieValue(linked, "taskfella_session");
    expect(current).toBeTruthy();

    const second = await begin("link", profile, current);
    const alreadyLinked = await handleGoogleCallback(
      callbackRequest(second.state, second.verifier, { session: current }),
      { db, environment, provider: second.provider },
    );
    expect(alreadyLinked.headers.get("location")).toContain("/account?oauth=already-linked");
    expect(await lookupSession(db, current!)).toBeNull();
    expect(await lookupSession(db, cookieValue(alreadyLinked, "taskfella_session")!)).toMatchObject(
      {
        accountId: owner.id,
      },
    );
    expect(
      await db
        .select({ count: count() })
        .from(oauthIdentities)
        .where(
          and(eq(oauthIdentities.accountId, owner.id), eq(oauthIdentities.provider, "google")),
        ),
    ).toEqual([{ count: 1 }]);
  });

  it("rejects identity and email conflicts without crossing account ownership", async () => {
    if (!db) return;
    const first = await accountWithPassword(uniqueEmail("identity-owner"));
    const profile = {
      subject: `google-subject-${crypto.randomUUID()}`,
      email: uniqueEmail("identity-email"),
    };
    const firstCeremony = await begin("link", profile, first.session);
    const firstLinked = await handleGoogleCallback(
      callbackRequest(firstCeremony.state, firstCeremony.verifier, { session: first.session }),
      { db, environment, provider: firstCeremony.provider },
    );
    const firstReplacement = cookieValue(firstLinked, "taskfella_session");
    expect(firstReplacement).toBeTruthy();

    const second = await accountWithPassword(uniqueEmail("identity-other"));
    const conflictCeremony = await begin("link", profile, second.session);
    const conflict = await handleGoogleCallback(
      callbackRequest(conflictCeremony.state, conflictCeremony.verifier, {
        session: second.session,
      }),
      { db, environment, provider: conflictCeremony.provider },
    );
    expect(conflict.headers.get("location")).toContain("/account?oauth=conflict");
    expect(await lookupSession(db, second.session)).toMatchObject({ accountId: second.id });
    expect(await lookupSession(db, firstReplacement!)).toMatchObject({ accountId: first.id });

    const emailConflictOwner = await accountWithPassword(uniqueEmail("email-owner"));
    const emailConflictProfile = {
      subject: `google-subject-${crypto.randomUUID()}`,
      email: emailConflictOwner.email,
    };
    const emailConflictCeremony = await begin("link", emailConflictProfile, second.session);
    const emailConflict = await handleGoogleCallback(
      callbackRequest(emailConflictCeremony.state, emailConflictCeremony.verifier, {
        session: second.session,
      }),
      { db, environment, provider: emailConflictCeremony.provider },
    );
    expect(emailConflict.headers.get("location")).toContain("/account?oauth=email-conflict");
  });

  it("consumes cancellation, provider failures, PKCE tampering, and replay safely", async () => {
    if (!db) return;
    const cancelledProfile = {
      subject: `google-subject-${crypto.randomUUID()}`,
      email: uniqueEmail("cancelled"),
    };
    const cancelled = await begin("signin", cancelledProfile);
    const cancelledResponse = await handleGoogleCallback(
      callbackRequest(cancelled.state, cancelled.verifier, { error: "access_denied" }),
      { db, environment, provider: cancelled.provider },
    );
    expect(cancelledResponse.headers.get("location")).toContain("/login?oauth=cancelled");
    expect(cancelledResponse.headers.get("set-cookie")).toContain("Max-Age=0");
    const cancelledReplay = await handleGoogleCallback(
      callbackRequest(cancelled.state, cancelled.verifier),
      { db, environment, provider: cancelled.provider },
    );
    expect(cancelledReplay.headers.get("location")).toContain("/login?oauth=state-invalid");

    const failedProfile = {
      subject: `google-subject-${crypto.randomUUID()}`,
      email: uniqueEmail("failed"),
    };
    const failingProvider: GoogleOAuthClient = {
      getAuthorizationUrl: providerFor(failedProfile).getAuthorizationUrl,
      async fetchIdentity() {
        throw new Error("provider failure");
      },
    };
    const failed = await begin("signin", failedProfile, undefined, failingProvider);
    const failedResponse = await handleGoogleCallback(
      callbackRequest(failed.state, failed.verifier),
      { db, environment, provider: failingProvider },
    );
    expect(failedResponse.headers.get("location")).toContain("/login?oauth=provider-error");

    const pkceProfile = {
      subject: `google-subject-${crypto.randomUUID()}`,
      email: uniqueEmail("pkce"),
    };
    const pkce = await begin("signin", pkceProfile);
    const tampered = await handleGoogleCallback(
      callbackRequest(pkce.state, pkce.verifier, { wrongVerifier: true }),
      { db, environment, provider: pkce.provider },
    );
    expect(tampered.headers.get("location")).toContain("/login?oauth=state-invalid");
    const validAfterTampering = await handleGoogleCallback(
      callbackRequest(pkce.state, pkce.verifier),
      { db, environment, provider: pkce.provider },
    );
    expect(validAfterTampering.headers.get("location")).toContain("/account?oauth=success");

    const replay = await handleGoogleCallback(callbackRequest(pkce.state, pkce.verifier), {
      db,
      environment,
      provider: pkce.provider,
    });
    expect(replay.headers.get("location")).toContain("/login?oauth=state-invalid");
    await rememberAccountByEmail(pkceProfile.email);
  });

  it("fails closed when the OAuth failure rate-limit boundary rejects the client", async () => {
    if (!db) return;
    await expect(
      handleGoogleCallback(new Request("http://localhost:3000/api/auth/google/callback"), {
        db,
        environment,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows only one concurrent callback to consume a ceremony", async () => {
    if (!db) return;
    const calls = [0];
    const profile = {
      subject: `google-subject-${crypto.randomUUID()}`,
      email: uniqueEmail("concurrent"),
    };
    const provider = providerFor(profile, { calls });
    const ceremony = await begin("signin", profile, undefined, provider);
    const requests = [
      callbackRequest(ceremony.state, ceremony.verifier),
      callbackRequest(ceremony.state, ceremony.verifier),
    ];
    const responses = await Promise.all(
      requests.map((request) => handleGoogleCallback(request, { db, environment, provider })),
    );

    expect(
      responses.filter((response) => response.headers.get("location")?.includes("oauth=success")),
    ).toHaveLength(1);
    expect(
      responses.filter((response) =>
        response.headers.get("location")?.includes("oauth=state-invalid"),
      ),
    ).toHaveLength(1);
    expect(calls[0]).toBe(1);
    await rememberAccountByEmail(profile.email);
  });
});
