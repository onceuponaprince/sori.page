import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = [
  "/write",
  "/discover",
  "/generate",
  "/characters",
  "/account",
  "/contribute",
  "/gaps",
  "/admin",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient(req, res);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isProtectedPath(req.nextUrl.pathname)) {
    return res;
  }

  if (!user) {
    const loginUrl = new URL("/login", req.url);
    const nextPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    if (nextPath && nextPath !== "/") {
      loginUrl.searchParams.set("next", nextPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
