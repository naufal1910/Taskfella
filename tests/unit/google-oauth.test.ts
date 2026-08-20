import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/http/errors";
import {
  createGoogleCodeChallenge,
  createGoogleOAuthClient,
  getGoogleOAuthConfig,
} from "@/server/modules/auth/google";
import { parseEnvironment } from "@/server/config/env";
import { generateOpaqueToken } from "@/server/modules/auth/tokens";

const environment = parseEnvironment({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://taskfella:taskfella@localhost:5432/taskfella",
  APP_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "local-placeholder.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "replace-with-google-client-secret",
});

describe("Google OAuth boundary", () => {
  it("clearly reports absent local configuration without returning provider material", () => {
    const unconfigured = {
      ...environment,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
    };
    expect(getGoogleOAuthConfig(unconfigured)).toBeNull();
  });

  it("derives the exact callback URI and keeps the client secret out of authorization URLs", () => {
    const config = getGoogleOAuthConfig(environment);
    expect(config).toMatchObject({
      clientId: "local-placeholder.apps.googleusercontent.com",
      redirectUri: "http://localhost:3000/api/auth/google/callback",
    });
    expect(config?.clientSecret).toBe("replace-with-google-client-secret");

    const client = createGoogleOAuthClient(config!);
    const authorization = new URL(
      client.getAuthorizationUrl({
        state: "state-placeholder",
        codeChallenge: "challenge-placeholder",
      }),
    );
    expect(authorization.origin).toBe("https://accounts.google.com");
    expect(authorization.pathname).toBe("/o/oauth2/v2/auth");
    expect(authorization.searchParams.get("redirect_uri")).toBe(config?.redirectUri);
    expect(authorization.searchParams.get("scope")).toBe("openid email");
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorization.searchParams.get("client_secret")).toBeNull();
    expect(authorization.toString()).not.toContain(config?.clientSecret ?? "");
  });

  it("returns only the verified subject and email from the provider boundary", async () => {
    const accessToken = generateOpaqueToken();
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: accessToken }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: `provider-subject-${crypto.randomUUID()}`,
            email: "person@example.test",
            email_verified: true,
            name: "Unstored display name",
            picture: "https://profile.example.invalid/image",
          }),
          { status: 200 },
        ),
      );
    const client = createGoogleOAuthClient(getGoogleOAuthConfig(environment)!, fetchImplementation);

    await expect(client.fetchIdentity(crypto.randomUUID(), "a".repeat(43))).resolves.toEqual({
      subject: expect.any(String),
      email: "person@example.test",
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("calculates RFC 7636 S256 challenges and rejects invalid verifier bounds", () => {
    expect(createGoogleCodeChallenge("a".repeat(43))).toBe(
      "ZtNPunH49FD35FWYhT5Tv8I7vRKQJ8uxMaL0_9eHjNA",
    );
    expect(() => createGoogleCodeChallenge("short")).toThrow("PKCE verifier is invalid");
  });

  it("fails closed for a partial direct configuration", () => {
    expect(() =>
      getGoogleOAuthConfig({ ...environment, GOOGLE_CLIENT_SECRET: undefined }),
    ).toThrowError(expect.objectContaining({ code: new AppError("OAUTH_NOT_CONFIGURED").code }));
  });

  it("rejects documented placeholders in production at the provider boundary", () => {
    expect(() =>
      getGoogleOAuthConfig({
        ...environment,
        NODE_ENV: "production",
        GOOGLE_CLIENT_ID: "your-client-id.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "supply-at-runtime",
      }),
    ).toThrowError(expect.objectContaining({ code: new AppError("OAUTH_NOT_CONFIGURED").code }));
  });
});
