import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** État d'avancement de l'ingestion d'un cours (pour le polling de la barre de progression). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      _count: { select: { sections: true, questions: true, studyUnits: true } },
    },
  });
  if (!course) {
    return NextResponse.json({ error: "Cours introuvable." }, { status: 404 });
  }

  return NextResponse.json({
    statut: course.statut,
    etape: course.etapeIngestion,
    pct: course.progressPct,
    erreurMessage: course.erreurMessage,
    counts: {
      sections: course._count.sections,
      questions: course._count.questions,
      unites: course._count.studyUnits,
    },
  });
}
