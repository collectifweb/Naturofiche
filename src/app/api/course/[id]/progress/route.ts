import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Enregistre la complétion d'une fiche du jour (cahier §5.4 : « la complétion est
// enregistrée »). Body : { studyUnitId, scoreQuiz? }. Renvoie la prochaine fiche
// incomplète (par ordre) pour le bouton « Terminer & continuer ».
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const data = body as { studyUnitId?: unknown; scoreQuiz?: unknown };
  const studyUnitId = typeof data.studyUnitId === "string" ? data.studyUnitId : null;
  if (!studyUnitId) {
    return NextResponse.json({ error: "studyUnitId requis." }, { status: 400 });
  }
  const scoreQuiz =
    typeof data.scoreQuiz === "number" && Number.isFinite(data.scoreQuiz)
      ? Math.max(0, Math.min(100, Math.round(data.scoreQuiz)))
      : null;

  // Garde : l'unité doit appartenir à ce cours.
  const unit = await prisma.studyUnit.findFirst({
    where: { id: studyUnitId, courseId: id },
    select: { id: true },
  });
  if (!unit) {
    return NextResponse.json({ error: "Unité introuvable." }, { status: 404 });
  }

  await prisma.progress.upsert({
    where: { studyUnitId },
    update: { completeLe: new Date(), scoreQuiz },
    create: { studyUnitId, completeLe: new Date(), scoreQuiz },
  });

  // Prochaine fiche incomplète : progress absent OU completeLe nul.
  const next = await prisma.studyUnit.findFirst({
    where: {
      courseId: id,
      OR: [{ progress: { is: null } }, { progress: { is: { completeLe: null } } }],
    },
    orderBy: { ordre: "asc" },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, prochaineFicheId: next?.id ?? null });
}
