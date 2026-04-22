import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const protectedPath = !req.nextUrl.pathname.startsWith("/api/auth") && req.nextUrl.pathname !== "/login";
  if (!protectedPath) return NextResponse.next();
  if (!req.cookies.get("app1_session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
