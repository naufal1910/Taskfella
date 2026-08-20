import { NextResponse } from "next/server";
import {
  authRoute,
  databaseFor,
  enforceAuthRateLimits,
  noStoreResponse,
  parseJsonObject,
  requireAuthCsrf,
  tokenStateError,
} from "@/server/http/auth-route";
import { clearSessionCookie } from "@/server/modules/auth/cookies";
import { parsePasswordReset } from "@/server/modules/auth/input";
import { resetPasswordWithToken } from "@/server/modules/auth/lifecycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  return authRoute(request, async (context) => {
    requireAuthCsrf(request, context);
    const db = databaseFor(context);
    await enforceAuthRateLimits(request, db, "passwordReset");
    const input = parsePasswordReset(await parseJsonObject(request));
    const result = await resetPasswordWithToken(db, input.token, input.password);

    if ("accountId" in result) {
      const response = noStoreResponse(
        {
          ok: true,
          status: "success",
          message: "Your password was reset. Sign in with the new password.",
        },
        200,
        context,
      );
      clearSessionCookie(response, context.environment);
      return response;
    }

    tokenStateError(result.state);
  });
}
