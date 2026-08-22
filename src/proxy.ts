import { NextResponse, type NextRequest } from "next/server";
import { getConfiguredAppUrl } from "@/server/config/env";
import { LOCAL_PROXY_MARKER } from "@/server/http/proxy-marker";
import { applyRequestContext, getRequestContext } from "@/server/http/request-id";

export function proxy(request: NextRequest): NextResponse {
  const context = getRequestContext(request);
  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;
  if (pathname === "/verify-email" || pathname === "/reset-password") {
    const token = request.nextUrl.searchParams.get("token");
    const appUrl = getConfiguredAppUrl();
    if (token !== null && appUrl) {
      const destination = new URL(pathname, appUrl);
      for (const [key, value] of request.nextUrl.searchParams) {
        if (key !== "token") destination.searchParams.append(key, value);
      }
      destination.hash =
        token.length > 0 && token.length <= 512 ? new URLSearchParams({ token }).toString() : "";
      const redirect = new NextResponse(null, {
        status: 303,
        headers: { location: destination.toString() },
      });
      redirect.headers.set("cache-control", "no-store");
      redirect.headers.set("referrer-policy", "no-referrer");
      applyRequestContext(redirect.headers, context);
      return redirect;
    }
  }
  if (process.env.NODE_ENV !== "production" && process.env.AUTH_TRUSTED_PROXY !== "true") {
    requestHeaders.set(LOCAL_PROXY_MARKER, "1");
  }
  applyRequestContext(requestHeaders, context);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applyRequestContext(response.headers, context);
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/api/account" ||
    pathname.startsWith("/api/account/") ||
    pathname === "/account" ||
    pathname === "/account/" ||
    pathname === "/settings" ||
    pathname === "/settings/" ||
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
