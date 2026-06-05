import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculerEcarts, type LettreReponse, type ReponseCorrigee } from "@/lib/corrige";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function estReponseCorrigee(value: unknown): value is ReponseCorrigee {
  const item = value as Partial<ReponseCorrigee>;
  return (
    !!item &&
    typeof item.numero === "number" &&
    Number.isInteger(item.numero) &&
    item.numero > 0 &&
    (item.reponse === "A" ||
      item.reponse === "B" ||
      item.reponse === "C" ||
      item.reponse === "D")
  );
}

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

  const raw = (body as { reponses?: unknown }).reponses;
  const reponses = Array.isArray(raw)
    ? raw
        .filter(estReponseCorrigee)
        .map((r) => ({ numero: r.numero, reponse: r.reponse as LettreReponse }))
        .sort((a, b) => a.numero - b.numero)
    : [];

  const course = await prisma.course.findUnique({
    where: { id },
    select: { id: true, statut: true },
  });
  if (!course || course.statut !== "pret") {
    return NextResponse.json({ error: "Cours introuvable ou pas encore prêt." }, { status: 404 });
  }

  const questions = await prisma.question.findMany({
    where: { courseId: id, type: "examen_officiel" },
    orderBy: { id: "asc" },
    select: { id: true, bonneReponse: true },
  });

  if (questions.length === 0) {
    return NextResponse.json({ error: "Aucune question officielle pour ce cours." }, { status: 404 });
  }
  if (reponses.length !== questions.length) {
    return NextResponse.json(
      { error: `${questions.length} réponses attendues, ${reponses.length} reçues.` },
      { status: 400 },
    );
  }

  const numeros = new Set(reponses.map((r) => r.numero));
  const suiteComplete = questions.every((_, index) => numeros.has(index + 1));
  if (!suiteComplete) {
    return NextResponse.json(
      { error: `Les numéros doivent couvrir 1 à ${questions.length}.` },
      { status: 400 },
    );
  }

  const comparaisons = calculerEcarts(reponses, questions);
  const ecarts = comparaisons.filter((item) => item.ecart);
  const now = new Date();

  await prisma.$transaction([
    prisma.officialKey.upsert({
      where: { courseId: id },
      update: {
        reponsesImportees: JSON.stringify(
          reponses.map((r) => ({ question: r.numero, reponse: r.reponse })),
        ),
        ecartsDetectes: JSON.stringify(ecarts),
        importeLe: now,
      },
      create: {
        courseId: id,
        reponsesImportees: JSON.stringify(
          reponses.map((r) => ({ question: r.numero, reponse: r.reponse })),
        ),
        ecartsDetectes: JSON.stringify(ecarts),
        importeLe: now,
      },
    }),
    ...comparaisons.map((item) =>
      prisma.question.update({
        where: { id: item.questionId },
        data: { bonneReponse: item.officiel, statutValidation: "valide" },
      }),
    ),
  ]);

  return NextResponse.json({
    ok: true,
    total: reponses.length,
    ecarts: ecarts.length,
    corriges: ecarts,
  });
}
