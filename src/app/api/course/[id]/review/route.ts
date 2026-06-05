import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prochaineBoite, dateEcheance } from "@/lib/leitner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Resultat {
  questionId: string;
  correct: boolean;
}

// Met à jour les boîtes de Leitner (cahier §5.5) à partir des réponses d'un quiz.
// Body : { resultats: {questionId, correct}[] }. Crée/àjour un ReviewItem par notion
// (quiz_verif) : boîte +1 si juste / retour boîte 1 si faux, prochaine échéance +
// historique. Renvoie le nombre de notions encore échues pour le cours.
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

  const raw = (body as { resultats?: unknown }).resultats;
  const resultats: Resultat[] = Array.isArray(raw)
    ? raw
        .filter(
          (r): r is Resultat =>
            !!r &&
            typeof (r as Resultat).questionId === "string" &&
            typeof (r as Resultat).correct === "boolean",
        )
        .map((r) => ({ questionId: r.questionId, correct: r.correct }))
    : [];

  if (resultats.length === 0) {
    return NextResponse.json({ error: "Aucun résultat exploitable." }, { status: 400 });
  }

  // Garde : ne garder que les quiz_verif de CE cours.
  const valides = await prisma.question.findMany({
    where: {
      id: { in: resultats.map((r) => r.questionId) },
      courseId: id,
      type: "quiz_verif",
    },
    select: { id: true },
  });
  const autorises = new Set(valides.map((q) => q.id));

  const now = new Date();
  for (const r of resultats) {
    if (!autorises.has(r.questionId)) continue;

    const existant = await prisma.reviewItem.findUnique({
      where: { questionId: r.questionId },
    });
    const boite = prochaineBoite(existant?.boite ?? 1, r.correct);
    const echeance = dateEcheance(boite, now);

    let historique: { date: string; correct: boolean }[] = [];
    if (existant) {
      try {
        const parsed = JSON.parse(existant.historique);
        if (Array.isArray(parsed)) historique = parsed;
      } catch {
        historique = [];
      }
    }
    historique.push({ date: now.toISOString(), correct: r.correct });

    await prisma.reviewItem.upsert({
      where: { questionId: r.questionId },
      update: { boite, prochaineEcheance: echeance, historique: JSON.stringify(historique) },
      create: {
        questionId: r.questionId,
        boite,
        prochaineEcheance: echeance,
        historique: JSON.stringify(historique),
      },
    });
  }

  // Notions encore échues (jamais revues ou échéance passée) pour le cours.
  const dus = await prisma.reviewItem.count({
    where: {
      question: { courseId: id, type: "quiz_verif" },
      OR: [{ prochaineEcheance: null }, { prochaineEcheance: { lte: now } }],
    },
  });

  return NextResponse.json({ ok: true, dus });
}
