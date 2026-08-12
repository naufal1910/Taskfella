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
import { parseToken } from "@/server/modules/auth/input";
import { verifyEmailAddress } from "@/server/modules/auth/lifecycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  return authRoute(request, async (context) => {
    requireAuthCsrf(request, context);
    const db = databaseFor(context);
    await enforceAuthRateLimits(request, db, "emailVerification");
    const token = parseToken((await parseJsonObject(request)).token);
    const outcome = await verifyEmailAddress(db, token);

    if (outcome.state === "verified" || outcome.state === "already-verified") {
      return noStoreResponse(
        {
          ok: true,
          status: "success",
          message:
            outcome.state === "verified"
              ? "Your email is verified. You can now sign in."
              : "Your email was already verified. You can now sign in.",
        },
        200,
        context,
      );
    }

    tokenStateError(outcome.state);
  });
}
