import { NextResponse, type NextRequest } from "next/server";
import { applyRequestContext, getRequestContext } from "@/server/http/request-id";

export function proxy(request: NextRequest): NextResponse {
  const context = getRequestContext(request);
  const requestHeaders = new Headers(request.headers);
  applyRequestContext(requestHeaders, context);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applyRequestContext(response.headers, context);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
