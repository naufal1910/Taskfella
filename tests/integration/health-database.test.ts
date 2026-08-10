import { afterAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { closeDatabase, getSql, REQUIRED_MIGRATION_HASH } from "@/server/db/client";

const integration = process.env.DATABASE_URL ? describe : describe.skip;

integration("database health integration", () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it("reports ready after the latest required migration is applied", async () => {
    const response = await GET(
      new Request("http://localhost/api/health", {
        headers: { "x-request-id": "integration-request" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      application: "ok",
      database: "ready",
      requestId: "integration-request",
    });
    expect(body).not.toHaveProperty("connectionString");
    expect(body).not.toHaveProperty("error");
  });

  it("does not report ready when the latest required migration is missing", async () => {
    const sql = getSql();
    const [requiredMigration] = await sql<{ hash: string; created_at: number | null }[]>`
      SELECT hash, created_at
      FROM drizzle.__drizzle_migrations
      WHERE hash = ${REQUIRED_MIGRATION_HASH}
    `;

    expect(requiredMigration).toBeDefined();
    await sql`
      DELETE FROM drizzle.__drizzle_migrations
      WHERE hash = ${REQUIRED_MIGRATION_HASH}
    `;

    try {
      const response = await GET(new Request("http://localhost/api/health"));
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        status: "degraded",
        application: "ok",
        database: "unavailable",
      });
    } finally {
      if (requiredMigration) {
        await sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${requiredMigration.hash}, ${requiredMigration.created_at})
        `;
      }
    }
  });

  it("does not report ready when the existing migration ledger is empty", async () => {
    const sql = getSql();
    const appliedMigrations = await sql<{ hash: string; created_at: number | null }[]>`
      SELECT hash, created_at
      FROM drizzle.__drizzle_migrations
      ORDER BY created_at
    `;

    expect(appliedMigrations.length).toBeGreaterThan(0);
    await sql`TRUNCATE TABLE drizzle.__drizzle_migrations`;

    try {
      const response = await GET(
        new Request("http://localhost/api/health", {
          headers: { "x-request-id": "empty-ledger-request" },
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toMatchObject({
        status: "degraded",
        application: "ok",
        database: "unavailable",
        requestId: "empty-ledger-request",
      });
      expect(body).not.toHaveProperty("error");
    } finally {
      for (const migration of appliedMigrations) {
        await sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${migration.hash}, ${migration.created_at})
        `;
      }
    }
  });
});
