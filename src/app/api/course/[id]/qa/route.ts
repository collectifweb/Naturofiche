import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rechercherSections, repondreQuestion } from "@/lib/qa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const question =
    typeof (body as { question?: unknown }).question === "string"
      ? (body as { question: string }).question.trim()
      : "";
  if (question.length < 3) {
    return NextResponse.json({ error: "Question trop courte." }, { status: 400 });
  }

  const course = await prisma.course.findUnique({
    where: { id },
    select: { id: true, statut: true },
  });
  if (!course || course.statut !== "pret") {
    return NextResponse.json({ error: "Cours introuvable ou pas encore prêt." }, { status: 404 });
  }

  const sections = await prisma.section.findMany({
    where: { courseId: id },
    orderBy: { ordre: "asc" },
  });
  const retrouvees = rechercherSections(question, sections);
  const reponse = await repondreQuestion(id, question, retrouvees);

  const sectionsCitees = reponse.sectionsCitees
    .filter((index) => Number.isInteger(index) && index >= 0 && index < retrouvees.length)
    .map((index) => retrouvees[index])
    .filter((section, index, arr) => arr.findIndex((s) => s.id === section.id) === index)
    .map((section) => ({ id: section.id, titre: section.titre }));

  return NextResponse.json({
    reponse: reponse.reponse,
    source: reponse.source,
    sections: sectionsCitees,
  });
}
