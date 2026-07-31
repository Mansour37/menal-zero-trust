import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isTokenExpired } from "@/lib/tokenExpiry";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const isLoginPage = request.nextUrl.pathname === "/login";
  const authenticated = !!token && !isTokenExpired(token);

  if (!authenticated && !isLoginPage) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (token) response.cookies.delete("token");
    return response;
  }
  if (authenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
