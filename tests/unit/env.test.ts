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
      AUTH_TRUSTED_PROXY: false,
      EMAIL_DELIVERY_MODE: "local",
      EMAIL_LOCAL_CAPTURE_DIR: ".local/mail",
      EMAIL_SMTP_HOST: undefined,
      EMAIL_SMTP_PORT: 587,
      EMAIL_SMTP_SECURE: false,
      EMAIL_SMTP_USER: undefined,
      EMAIL_SMTP_PASSWORD: undefined,
      EMAIL_FROM: undefined,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
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

  it("rejects credential-bearing and insecure production application URLs", () => {
    expect(() =>
      parseEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://taskfella:taskfella@localhost:5432/taskfella",
        APP_URL: "http://user:secret@taskfella.example",
        AUTH_TRUSTED_PROXY: "true",
        EMAIL_DELIVERY_MODE: "smtp",
        EMAIL_SMTP_HOST: "smtp.example",
        EMAIL_FROM: "Taskfella <no-reply@example>",
      }),
    ).toThrow(/APP_URL/);
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
        AUTH_TRUSTED_PROXY: "true",
        EMAIL_DELIVERY_MODE: "smtp",
        EMAIL_SMTP_HOST: "smtp.example",
        EMAIL_FROM: "Taskfella <no-reply@example>",
        EMAIL_SMTP_SECURE: "true",
        GOOGLE_CLIENT_ID: "1234567890-abcXYZ.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "GOCSPX-9aB7cD2eF4gH6jK8mN0pQ",
      }),
    ).toMatchObject({
      EMAIL_DELIVERY_MODE: "smtp",
      EMAIL_SMTP_HOST: "smtp.example",
      EMAIL_SMTP_SECURE: true,
      AUTH_TRUSTED_PROXY: true,
      GOOGLE_CLIENT_ID: "1234567890-abcXYZ.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "GOCSPX-9aB7cD2eF4gH6jK8mN0pQ",
    });
  });

  it("rejects obvious Google placeholders in production but accepts them locally", () => {
    const base = {
      DATABASE_URL: "postgresql://taskfella:taskfella@localhost:5432/taskfella",
      APP_URL: "https://taskfella.example",
      AUTH_TRUSTED_PROXY: "true",
      EMAIL_DELIVERY_MODE: "smtp" as const,
      EMAIL_SMTP_HOST: "smtp.example",
      EMAIL_FROM: "Taskfella <no-reply@example>",
      GOOGLE_CLIENT_ID: "local-placeholder.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "local-google-placeholder-secret",
    };

    expect(() => parseEnvironment({ ...base, NODE_ENV: "production" })).toThrow(/GOOGLE/);
    expect(() =>
      parseEnvironment({ ...base, NODE_ENV: "development", APP_URL: "http://localhost:3000" }),
    ).not.toThrow();
  });

  it("rejects partial or malformed Google configuration", () => {
    const base = {
      NODE_ENV: "test" as const,
      DATABASE_URL: "postgresql://taskfella:taskfella@localhost:5432/taskfella",
      APP_URL: "http://localhost:3000",
    };

    expect(() =>
      parseEnvironment({ ...base, GOOGLE_CLIENT_ID: "only-one-value.apps.googleusercontent.com" }),
    ).toThrow(/GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET/);
    expect(() =>
      parseEnvironment({
        ...base,
        GOOGLE_CLIENT_ID: "not-a-google-client-id",
        GOOGLE_CLIENT_SECRET: "replace-with-google-client-secret",
      }),
    ).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it("requires Google configuration in production", () => {
    expect(() =>
      parseEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://taskfella:taskfella@localhost:5432/taskfella",
        APP_URL: "https://taskfella.example",
        AUTH_TRUSTED_PROXY: "true",
        EMAIL_DELIVERY_MODE: "smtp",
        EMAIL_SMTP_HOST: "smtp.example",
        EMAIL_FROM: "Taskfella <no-reply@example>",
      }),
    ).toThrow(/GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET/);
  });
});
