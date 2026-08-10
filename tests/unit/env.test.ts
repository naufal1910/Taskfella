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
      EMAIL_DELIVERY_MODE: "local",
      EMAIL_LOCAL_CAPTURE_DIR: ".local/mail",
      EMAIL_SMTP_HOST: undefined,
      EMAIL_SMTP_PORT: 587,
      EMAIL_SMTP_SECURE: false,
      EMAIL_SMTP_USER: undefined,
      EMAIL_SMTP_PASSWORD: undefined,
      EMAIL_FROM: undefined,
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

  it("requires explicit SMTP delivery settings in production", () => {
    expect(() =>
      parseEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://taskfella:taskfella@localhost:5432/taskfella",
        APP_URL: "https://taskfella.example",
      }),
    ).toThrow(/EMAIL_DELIVERY_MODE|EMAIL_SMTP_HOST|EMAIL_FROM/);

    expect(
      parseEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://taskfella:taskfella@localhost:5432/taskfella",
        APP_URL: "https://taskfella.example",
        EMAIL_DELIVERY_MODE: "smtp",
        EMAIL_SMTP_HOST: "smtp.example",
        EMAIL_FROM: "Taskfella <no-reply@example>",
        EMAIL_SMTP_SECURE: "true",
      }),
    ).toMatchObject({
      EMAIL_DELIVERY_MODE: "smtp",
      EMAIL_SMTP_HOST: "smtp.example",
      EMAIL_SMTP_SECURE: true,
    });
  });
});
