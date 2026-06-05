import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, tokenFor } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const password = process.env.ACCESS_PASSWORD;
  if (!password) return NextResponse.json({ ok: true });

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (body.password !== password) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, await tokenFor(password), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 60, // 60 jours
  });
  return res;
}
