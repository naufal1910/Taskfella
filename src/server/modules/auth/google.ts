import { createHash } from "node:crypto";
import { AppError } from "@/server/http/errors";
import {
  getEnvironment,
  isGoogleOAuthPlaceholder,
  isSafeProductionGoogleOAuthConfiguration,
  type AppEnv,
} from "@/server/config/env";
import { validateEmail } from "./accounts";

export const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

const GOOGLE_PROVIDER_TIMEOUT_MS = 8_000;

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleIdentityProfile {
  subject: string;
  email: string;
}

export interface GoogleOAuthClient {
  getAuthorizationUrl(input: { state: string; codeChallenge: string }): string;
  fetchIdentity(code: string, codeVerifier: string): Promise<GoogleIdentityProfile>;
}

export class GoogleOAuthProviderError extends Error {
  constructor() {
    super("Google OAuth provider request failed.");
    this.name = "GoogleOAuthProviderError";
  }
}

function validGoogleClientId(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(value));
}

function validGoogleClientSecret(value: string | undefined): value is string {
  return Boolean(value && value.length <= 512 && !/[\s\u0000-\u001f\u007f]/.test(value));
}

/**
 * Local development may intentionally omit Google credentials, but a partial
 * or malformed pair is never treated as disabled configuration.
 */
export function getGoogleOAuthConfig(
  environment: AppEnv = getEnvironment(),
): GoogleOAuthConfig | null {
  const hasClientId = Boolean(environment.GOOGLE_CLIENT_ID);
  const hasClientSecret = Boolean(environment.GOOGLE_CLIENT_SECRET);
  if (!hasClientId && !hasClientSecret) {
    return null;
  }
  if (
    !validGoogleClientId(environment.GOOGLE_CLIENT_ID) ||
    !validGoogleClientSecret(environment.GOOGLE_CLIENT_SECRET) ||
    (environment.NODE_ENV === "production" &&
      (!isSafeProductionGoogleOAuthConfiguration(
        environment.GOOGLE_CLIENT_ID,
        environment.GOOGLE_CLIENT_SECRET,
      ) ||
        isGoogleOAuthPlaceholder(environment.GOOGLE_CLIENT_ID) ||
        isGoogleOAuthPlaceholder(environment.GOOGLE_CLIENT_SECRET)))
  ) {
    throw new AppError("OAUTH_NOT_CONFIGURED");
  }

  const redirectUri = new URL("/api/auth/google/callback", environment.APP_URL).toString();
  return {
    clientId: environment.GOOGLE_CLIENT_ID,
    clientSecret: environment.GOOGLE_CLIENT_SECRET,
    redirectUri,
  };
}

function codeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier, "utf8").digest("base64url");
}

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(GOOGLE_PROVIDER_TIMEOUT_MS)
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return asRecord(await response.json());
  } catch {
    return null;
  }
}

function requireString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength ? value : null;
}

export function createGoogleOAuthClient(
  config: GoogleOAuthConfig,
  fetchImplementation: typeof fetch = fetch,
): GoogleOAuthClient {
  return {
    getAuthorizationUrl(input) {
      const authorization = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
      authorization.searchParams.set("client_id", config.clientId);
      authorization.searchParams.set("redirect_uri", config.redirectUri);
      authorization.searchParams.set("response_type", "code");
      authorization.searchParams.set("scope", "openid email");
      authorization.searchParams.set("state", input.state);
      authorization.searchParams.set("code_challenge", input.codeChallenge);
      authorization.searchParams.set("code_challenge_method", "S256");
      authorization.searchParams.set("prompt", "select_account");
      return authorization.toString();
    },

    async fetchIdentity(code, codeVerifier) {
      if (
        typeof code !== "string" ||
        code.length === 0 ||
        code.length > 2048 ||
        typeof codeVerifier !== "string" ||
        codeVerifier.length < 43 ||
        codeVerifier.length > 128
      ) {
        throw new GoogleOAuthProviderError();
      }

      let tokenResponse: Record<string, unknown> | null;
      try {
        const response = await fetchImplementation(GOOGLE_TOKEN_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: config.redirectUri,
          }),
          signal: timeoutSignal(),
        });
        tokenResponse = await readJson(response);
        if (!response.ok) {
          throw new GoogleOAuthProviderError();
        }
      } catch (error) {
        if (error instanceof GoogleOAuthProviderError) throw error;
        throw new GoogleOAuthProviderError();
      }

      const accessToken = requireString(tokenResponse?.access_token, 4096);
      if (!accessToken) {
        throw new GoogleOAuthProviderError();
      }

      let profile: Record<string, unknown> | null;
      try {
        const response = await fetchImplementation(GOOGLE_USERINFO_ENDPOINT, {
          headers: { authorization: `Bearer ${accessToken}` },
          signal: timeoutSignal(),
        });
        profile = await readJson(response);
        if (!response.ok) {
          throw new GoogleOAuthProviderError();
        }
      } catch (error) {
        if (error instanceof GoogleOAuthProviderError) throw error;
        throw new GoogleOAuthProviderError();
      }

      const subject = requireString(profile?.sub, 256);
      const email = requireString(profile?.email, 320);
      if (!subject || !email || profile?.email_verified !== true) {
        throw new GoogleOAuthProviderError();
      }

      try {
        validateEmail(email);
      } catch {
        throw new GoogleOAuthProviderError();
      }

      return { subject, email: email.trim() };
    },
  };
}

/** RFC 7636 S256 challenge for the verifier kept in the HttpOnly ceremony cookie. */
export function createGoogleCodeChallenge(codeVerifier: string): string {
  if (typeof codeVerifier !== "string" || codeVerifier.length < 43 || codeVerifier.length > 128) {
    throw new Error("PKCE verifier is invalid.");
  }
  return codeChallenge(codeVerifier);
}
