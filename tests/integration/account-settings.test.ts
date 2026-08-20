import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { GET as readAccount, PATCH as updateAccount } from "@/app/api/account/route";
import { closeDatabase, getDatabase } from "@/server/db/client";
import { accounts } from "@/server/db/schema";
import { createAccount } from "@/server/modules/auth/accounts";
import { createSession } from "@/server/modules/auth/sessions";
import { type AccountSettings } from "@/server/modules/account/settings";

const integration = process.env.DATABASE_URL ? describe : describe.skip;
const db = process.env.DATABASE_URL ? getDatabase() : undefined;
const createdAccountIds: string[] = [];

async function makeAccount(prefix: string, settings: Partial<AccountSettings> = {}) {
  if (!db) throw new Error("Database integration is unavailable.");
  const account = await createAccount(db, {
    email: `${prefix}-${crypto.randomUUID()}@example.test`,
    ...settings,
  });
  createdAccountIds.push(account.id);
  return account;
}

function authenticatedRequest(
  pathname: string,
  session: string,
  options: { method?: string; body?: unknown; csrf?: string } = {},
): Request {
  const csrf = options.csrf ?? `csrf-${crypto.randomUUID()}`;
  const headers = new Headers({
    origin: "http://localhost:3000",
    cookie: `taskfella_session=${encodeURIComponent(session)}; taskfella_csrf=${encodeURIComponent(csrf)}`,
    "x-csrf-token": csrf,
  });
  if (options.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`http://localhost:3000${pathname}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function json(response: Response): Promise<Record<string, any>> {
  return (await response.json()) as Record<string, any>;
}

integration("Phase 1D account settings routes", () => {
  afterAll(async () => {
    if (db) {
      for (const accountId of createdAccountIds) {
        await db.delete(accounts).where(eq(accounts.id, accountId));
      }
      await closeDatabase();
    }
  });

  it("reads defaults, updates every setting, and persists the account-owned result", async () => {
    if (!db) return;
    const owner = await makeAccount("settings-owner");
    const session = await createSession(db, owner.id);

    const initial = await readAccount(
      new Request("http://localhost:3000/api/account", {
        headers: { cookie: `taskfella_session=${session.token}` },
      }),
    );
    expect(initial.status).toBe(200);
    expect(initial.headers.get("cache-control")).toBe("no-store");
    expect(initial.headers.get("set-cookie")).toContain("taskfella_appearance=system");
    expect(await json(initial)).toMatchObject({
      account: {
        email: owner.email,
        displayName: "",
        timezone: "UTC",
        appearance: "system",
        notificationsEnabled: true,
        soundEnabled: true,
        focusDurationMinutes: 25,
        shortBreakDurationMinutes: 5,
        longBreakDurationMinutes: 15,
        longBreakInterval: 4,
      },
    });

    const updated = await updateAccount(
      authenticatedRequest("/api/account", session.token, {
        method: "PATCH",
        body: {
          displayName: "  Focused owner ",
          timezone: "Asia/Tokyo",
          appearance: "dark",
          notificationsEnabled: false,
          soundEnabled: false,
          focusDurationMinutes: 50,
          shortBreakDurationMinutes: 10,
          longBreakDurationMinutes: 30,
          longBreakInterval: 3,
        },
      }),
    );
    expect(updated.status).toBe(200);
    expect(updated.headers.get("cache-control")).toBe("no-store");
    expect(updated.headers.get("set-cookie")).toBeNull();
    expect(await json(updated)).toMatchObject({
      account: {
        displayName: "Focused owner",
        timezone: "Asia/Tokyo",
        appearance: "dark",
        notificationsEnabled: false,
        soundEnabled: false,
        pomodoro: {
          focusDurationMinutes: 50,
          shortBreakDurationMinutes: 10,
          longBreakDurationMinutes: 30,
          longBreakInterval: 3,
        },
      },
    });

    const [stored] = await db.select().from(accounts).where(eq(accounts.id, owner.id));
    expect(stored).toMatchObject({
      displayName: "Focused owner",
      timezone: "Asia/Tokyo",
      appearance: "dark",
      notificationsEnabled: false,
      soundEnabled: false,
      focusDurationMinutes: 50,
      shortBreakDurationMinutes: 10,
      longBreakDurationMinutes: 30,
      longBreakInterval: 3,
    });
  });

  it("rejects unauthenticated, cross-site, malformed, and invalid mutations safely", async () => {
    if (!db) return;
    const owner = await makeAccount("settings-validation");
    const other = await makeAccount("settings-other");
    const ownerSession = await createSession(db, owner.id);

    const unauthenticatedRead = await readAccount(new Request("http://localhost:3000/api/account"));
    expect(unauthenticatedRead.status).toBe(401);
    expect(await json(unauthenticatedRead)).toMatchObject({ error: { code: "UNAUTHORIZED" } });

    const unauthenticatedUpdate = await updateAccount(
      new Request("http://localhost:3000/api/account", {
        method: "PATCH",
        body: JSON.stringify({ displayName: "Nope" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(unauthenticatedUpdate.status).toBe(401);

    const csrfFailure = await updateAccount(
      new Request("http://localhost:3000/api/account", {
        method: "PATCH",
        headers: {
          origin: "http://localhost:3000",
          cookie: `taskfella_session=${ownerSession.token}; taskfella_csrf=cookie-token`,
          "x-csrf-token": "different-header",
          "content-type": "application/json",
        },
        body: JSON.stringify({ displayName: "Nope" }),
      }),
    );
    expect(csrfFailure.status).toBe(403);

    const crossSite = await updateAccount(
      new Request("http://localhost:3000/api/account", {
        method: "PATCH",
        headers: {
          origin: "https://evil.example",
          cookie: `taskfella_session=${ownerSession.token}; taskfella_csrf=csrf`,
          "x-csrf-token": "csrf",
          "content-type": "application/json",
        },
        body: JSON.stringify({ displayName: "Nope" }),
      }),
    );
    expect(crossSite.status).toBe(403);

    const invalidValues = [
      { timezone: "Not/AZone" },
      { timezone: "" },
      { timezone: "+05:30" },
      { focusDurationMinutes: 0 },
      { focusDurationMinutes: 121 },
      { shortBreakDurationMinutes: 0 },
      { shortBreakDurationMinutes: 61 },
      { longBreakDurationMinutes: 0 },
      { longBreakDurationMinutes: 121 },
      { longBreakInterval: 0 },
      { longBreakInterval: 13 },
      { focusDurationMinutes: "25" },
      { appearance: "sepia" },
      { notificationsEnabled: "true" },
      { accountId: other.id, displayName: "foreign" },
    ];
    for (const body of invalidValues) {
      const response = await updateAccount(
        authenticatedRequest("/api/account", ownerSession.token, {
          method: "PATCH",
          body,
        }),
      );
      expect(response.status).toBe(400);
      const payload = await json(response);
      expect(payload).toMatchObject({ error: { code: "INVALID_REQUEST" } });
      expect(JSON.stringify(payload)).not.toContain(other.email);
    }

    const [ownerAfterInvalid, otherAfterInvalid] = await Promise.all(
      [owner.id, other.id].map((id) => db.select().from(accounts).where(eq(accounts.id, id))),
    );
    expect(ownerAfterInvalid[0]).toMatchObject({ displayName: "" });
    expect(otherAfterInvalid[0]).toMatchObject({ displayName: "" });
  });

  it("keeps separate concurrent field updates account-scoped", async () => {
    if (!db) return;
    const owner = await makeAccount("settings-concurrent");
    const session = await createSession(db, owner.id);

    const [nameResponse, timezoneResponse] = await Promise.all([
      updateAccount(
        authenticatedRequest("/api/account", session.token, {
          method: "PATCH",
          body: { displayName: "Concurrent owner" },
        }),
      ),
      updateAccount(
        authenticatedRequest("/api/account", session.token, {
          method: "PATCH",
          body: { timezone: "Europe/Berlin" },
        }),
      ),
    ]);
    expect(nameResponse.status).toBe(200);
    expect(timezoneResponse.status).toBe(200);
    expect(nameResponse.headers.get("set-cookie")).toBeNull();
    expect(timezoneResponse.headers.get("set-cookie")).toBeNull();

    const [stored] = await db.select().from(accounts).where(eq(accounts.id, owner.id));
    expect(stored).toMatchObject({ displayName: "Concurrent owner", timezone: "Europe/Berlin" });
  });

  it("stores a browser-provided initial timezone without changing later authority", async () => {
    if (!db) return;
    const owner = await makeAccount("settings-browser", { timezone: "Australia/Sydney" });
    const session = await createSession(db, owner.id);
    const read = await readAccount(
      new Request("http://localhost:3000/api/account", {
        headers: { cookie: `taskfella_session=${session.token}` },
      }),
    );
    expect(await json(read)).toMatchObject({ account: { timezone: "Australia/Sydney" } });
  });
});
