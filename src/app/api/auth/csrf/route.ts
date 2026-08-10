import { NextResponse } from "next/server";
import { ensureCsrfCookie } from "@/server/modules/auth/cookies";
import { applyRequestContext, getRequestContext } from "@/server/http/request-id";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Issue the readable double-submit cookie; the token is not included in JSON. */
export async function GET(request: Request): Promise<NextResponse> {
  const context = getRequestContext(request);
  const response = NextResponse.json(
    { ok: true, requestId: context.requestId },
    { headers: { "cache-control": "no-store" } },
  );
  ensureCsrfCookie(request, response);
  applyRequestContext(response.headers, context);
  return response;
}
