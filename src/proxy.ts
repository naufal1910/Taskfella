import { NextResponse, type NextRequest } from "next/server";
import { applyRequestContext, getRequestContext } from "@/server/http/request-id";

export function proxy(request: NextRequest): NextResponse {
  const context = getRequestContext(request);
  const requestHeaders = new Headers(request.headers);
  applyRequestContext(requestHeaders, context);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applyRequestContext(response.headers, context);
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/api/account" ||
    pathname === "/account" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/logout" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/reset-password/" ||
    pathname.startsWith("/verify-email")
  ) {
    response.headers.set("cache-control", "no-store");
    response.headers.set("referrer-policy", "no-referrer");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
