import { afterAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { closeDatabase } from "@/server/db/client";

const integration = process.env.DATABASE_URL ? describe : describe.skip;

integration("database health integration", () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it("reports ready after the Phase 0 migration ledger is applied", async () => {
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
});
