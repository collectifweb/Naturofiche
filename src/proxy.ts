import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, tokenFor } from "@/lib/auth";

// Convention Next 16 : "proxy" remplace "middleware".
export async function proxy(req: NextRequest) {
  const password = process.env.ACCESS_PASSWORD;
  // Gate désactivée si aucun mot de passe configuré.
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons/")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(ACCESS_COOKIE)?.value;
  const expected = await tokenFor(password);
  if (cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
