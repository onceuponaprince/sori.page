import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail, isAdminUser } from "@/lib/admin-auth";
import { getDevSessionEmailFromRequest } from "@/lib/dev-session";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = [
  "/write",
  "/story",
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
  let user = null;

  try {
    const supabase = createMiddlewareClient(req, res);
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();
    user = supabaseUser;
  } catch {
    user = null;
  }

  if (!isProtectedPath(req.nextUrl.pathname)) {
    return res;
  }

  const devSessionEmail = await getDevSessionEmailFromRequest(req);

  if (!user && !devSessionEmail) {
    const loginUrl = new URL("/login", req.url);
    const nextPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    if (nextPath && nextPath !== "/") {
      loginUrl.searchParams.set("next", nextPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (
    req.nextUrl.pathname === "/admin" ||
    req.nextUrl.pathname.startsWith("/admin/")
  ) {
    const hasAdminAccess =
      (user && isAdminUser(user)) ||
      (devSessionEmail && isAdminEmail(devSessionEmail));

    if (!hasAdminAccess) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", req.nextUrl.pathname);
      loginUrl.searchParams.set("error", "admin_required");
      return NextResponse.redirect(loginUrl);
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
