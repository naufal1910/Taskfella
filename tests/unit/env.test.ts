import { describe, expect, it } from "vitest";
import { parseEnvironment } from "@/server/config/env";

describe("environment validation", () => {
  it("parses the supported foundation configuration", () => {
    expect(
      parseEnvironment({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://taskfella:taskfella@localhost:5432/taskfella",
        APP_URL: "http://localhost:3000",
        LOG_LEVEL: "warn",
        DB_POOL_MAX: "4",
      }),
    ).toEqual({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://taskfella:taskfella@localhost:5432/taskfella",
      APP_URL: "http://localhost:3000",
      LOG_LEVEL: "warn",
      DB_POOL_MAX: 4,
    });
  });

  it("rejects missing required values without echoing credentials", () => {
    expect(() => parseEnvironment({ DATABASE_URL: "not-a-database" })).toThrow(
      "Invalid environment configuration: DATABASE_URL, APP_URL",
    );
    expect(() => parseEnvironment({ DATABASE_URL: "postgresql://secret-value" })).toThrow(
      /Invalid environment configuration/,
    );
    expect(() => parseEnvironment({ DATABASE_URL: "postgresql://secret-value" })).not.toThrow(
      "secret-value",
    );
  });

  it("rejects unsupported database schemes and invalid pool sizes", () => {
    expect(() =>
      parseEnvironment({
        DATABASE_URL: "https://database.example.invalid",
        APP_URL: "http://localhost:3000",
        DB_POOL_MAX: "0",
      }),
    ).toThrow(/DATABASE_URL|DB_POOL_MAX/);
  });
});
