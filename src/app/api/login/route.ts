import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { ACCESS_COOKIE, tokenFor } from "@/lib/auth";

export const runtime = "nodejs";

// Limite de tentatives, en mémoire (un seul process Node permanent) : 5 échecs par adresse
// et 20 au total sur 15 minutes glissantes, puis 429. Les échecs ne sont plus enregistrés une
// fois bloqué, donc la liste ne dépasse jamais MAX_TOTAL.
const FENETRE_MS = 15 * 60 * 1000;
const MAX_PAR_ADRESSE = 5;
const MAX_TOTAL = 20;
const echecs: { ip: string; t: number }[] = [];

function bloque(ip: string): boolean {
  const limite = Date.now() - FENETRE_MS;
  while (echecs.length && echecs[0].t < limite) echecs.shift();
  return (
    echecs.length >= MAX_TOTAL ||
    echecs.filter((e) => e.ip === ip).length >= MAX_PAR_ADRESSE
  );
}

function memeMotDePasse(saisi: string, attendu: string): boolean {
  const a = createHash("sha256").update(saisi).digest();
  const b = createHash("sha256").update(attendu).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const password = process.env.ACCESS_PASSWORD;
  if (!password) return NextResponse.json({ ok: true });

  // X-Real-IP est posé par nginx en production (il écrase la valeur envoyée par le client).
  const ip = req.headers.get("x-real-ip") ?? "inconnue";
  if (bloque(ip)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans 15 minutes." },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  if (typeof body.password !== "string" || !memeMotDePasse(body.password, password)) {
    echecs.push({ ip, t: Date.now() });
    await new Promise((r) => setTimeout(r, 250));
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
