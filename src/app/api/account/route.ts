import { NextResponse } from "next/server";
import { getDatabase } from "@/server/db/client";
import { protectedRoute } from "@/server/http/authentication";
import { listAccountOAuthIdentities } from "@/server/modules/auth/identities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  return protectedRoute(request, async ({ account }) => {
    const identities = await listAccountOAuthIdentities(getDatabase(), account.id);
    return NextResponse.json(
      {
        ok: true,
        account: {
          id: account.id,
          email: account.email,
          emailVerifiedAt: account.emailVerifiedAt,
          createdAt: account.createdAt,
          status: account.emailVerifiedAt ? "verified" : "unverified",
          identities,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  });
}
