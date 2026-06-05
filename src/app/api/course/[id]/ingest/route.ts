import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { triggerIngestion } from "@/lib/ingest";

export const runtime = "nodejs";
// Borne la requête de DÉCLENCHEMENT seulement ; le pipeline tourne en tâche de fond.
export const maxDuration = 60;

const EN_COURS = new Set(["ingestion", "verification"]);

/** (Re)lance l'ingestion IA d'un cours. `?force=1` pour relancer même si déjà en cours. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  if (EN_COURS.has(course.statut) && !force) {
    return NextResponse.json({ error: "Ingestion déjà en cours." }, { status: 409 });
  }

  await triggerIngestion(id);
  return NextResponse.json({ ok: true });
}
