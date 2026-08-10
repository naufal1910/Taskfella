import { NextResponse } from "next/server";
import {
  authRoute,
  databaseFor,
  enforceAuthRateLimits,
  noStoreResponse,
  parseJsonObject,
  requireAuthCsrf,
} from "@/server/http/auth-route";
import { getAccountByNormalizedEmail, verifyAccountPassword } from "@/server/modules/auth/accounts";
import { parseEmailPassword } from "@/server/modules/auth/input";
import { getSessionToken, setSessionCookie } from "@/server/modules/auth/cookies";
import {
  createSession,
  lookupSession,
  rotateSession,
  revokeSession,
} from "@/server/modules/auth/sessions";
import { AppError } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  return authRoute(request, async (context) => {
    requireAuthCsrf(request, context);
    const input = parseEmailPassword(await parseJsonObject(request));
    const db = databaseFor(context);

    await enforceAuthRateLimits(request, db, "login", input.email);

    const account = await getAccountByNormalizedEmail(db, input.email);
    const validPassword = account
      ? await verifyAccountPassword(db, account.id, input.password)
      : false;
    if (!account || !validPassword) {
      throw new AppError("INVALID_CREDENTIALS");
    }
    if (!account.emailVerifiedAt) {
      throw new AppError("EMAIL_NOT_VERIFIED");
    }

    const presentedToken = getSessionToken(request);
    let issued = null;
    if (presentedToken) {
      const existing = await lookupSession(db, presentedToken);
      if (existing?.accountId === account.id) {
        issued = await rotateSession(db, presentedToken);
      } else {
        await revokeSession(db, presentedToken, "login-replaced");
      }
    }
    issued ??= await createSession(db, account.id);

    const response = noStoreResponse(
      {
        ok: true,
        account: {
          id: account.id,
          email: account.email,
          emailVerifiedAt: account.emailVerifiedAt,
        },
      },
      200,
      context,
    );
    setSessionCookie(response, issued.token, issued.session.expiresAt, context.environment);
    return response;
  });
}
