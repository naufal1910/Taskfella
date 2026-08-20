import { NextResponse } from "next/server";
import { protectedRoute } from "@/server/http/authentication";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  return protectedRoute(request, async ({ account }) =>
    NextResponse.json(
      {
        ok: true,
        account: {
          id: account.id,
          email: account.email,
          emailVerifiedAt: account.emailVerifiedAt,
          createdAt: account.createdAt,
          status: account.emailVerifiedAt ? "verified" : "unverified",
        },
      },
      { headers: { "cache-control": "no-store" } },
    ),
  );
}
