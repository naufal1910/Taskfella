import { NextResponse } from "next/server";
import { authRoute, databaseFor, noStoreResponse, requireAuthCsrf } from "@/server/http/auth-route";
import {
  clearAppearanceCookie,
  clearSessionCookie,
  getSessionToken,
} from "@/server/modules/auth/cookies";
import { revokeSession } from "@/server/modules/auth/sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Logout is idempotent, but a presented live session is always revoked first. */
export async function POST(request: Request): Promise<NextResponse> {
  return authRoute(request, async (context) => {
    requireAuthCsrf(request, context);
    const token = getSessionToken(request);
    if (token) {
      await revokeSession(databaseFor(context), token, "logout");
    }

    const response = noStoreResponse({ ok: true, status: "logged-out" }, 200, context);
    clearSessionCookie(response, context.environment);
    clearAppearanceCookie(response, context.environment);
    return response;
  });
}
