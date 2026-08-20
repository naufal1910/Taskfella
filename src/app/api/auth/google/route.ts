import { NextResponse } from "next/server";
import { authRoute, databaseFor } from "@/server/http/auth-route";
import { startGoogleAuthorization } from "@/server/modules/auth/oauth-flow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  return authRoute(request, (context) =>
    startGoogleAuthorization(request, {
      db: databaseFor(context),
      environment: context.environment,
    }),
  );
}
