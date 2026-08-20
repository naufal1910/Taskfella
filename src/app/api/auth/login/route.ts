import { NextResponse } from "next/server";
import {
  authRoute,
  databaseFor,
  enforceAuthRateLimits,
  noStoreResponse,
  parseJsonObject,
  requireAuthCsrf,
} from "@/server/http/auth-route";
import { parseEmailPassword } from "@/server/modules/auth/input";
import { getAccountVersion } from "@/server/modules/auth/accounts";
import {
  getSessionToken,
  setAppearanceCookie,
  setSessionCookie,
} from "@/server/modules/auth/cookies";
import { authenticateAndIssueSession } from "@/server/modules/auth/lifecycle";
import { AppError } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  return authRoute(request, async (context) => {
    requireAuthCsrf(request, context);
    const input = parseEmailPassword(await parseJsonObject(request));
    const db = databaseFor(context);

    await enforceAuthRateLimits(request, db, "login", input.email);

    const result = await authenticateAndIssueSession(db, {
      ...input,
      presentedToken: getSessionToken(request),
    });
    if (result.state === "invalid-credentials") {
      throw new AppError("INVALID_CREDENTIALS");
    }
    if (result.state === "unverified") {
      throw new AppError("EMAIL_NOT_VERIFIED");
    }
    let appearanceRevision = result.account.updatedAt.toISOString();
    try {
      appearanceRevision = (await getAccountVersion(db, result.account.id)) ?? appearanceRevision;
    } catch {
      appearanceRevision = result.account.updatedAt.toISOString();
    }

    const response = noStoreResponse(
      {
        ok: true,
        account: {
          id: result.account.id,
          email: result.account.email,
          emailVerifiedAt: result.account.emailVerifiedAt,
          appearance: result.account.appearance,
          appearanceRevision,
        },
      },
      200,
      context,
    );
    setSessionCookie(response, result.token, result.expiresAt, context.environment);
    setAppearanceCookie(
      response,
      result.account.appearance as "system" | "light" | "dark",
      context.environment,
      appearanceRevision,
    );
    return response;
  });
}
