import { NextResponse } from "next/server";
import type { QaMessage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { QaSource, WebSource } from "@/lib/qa";
import { rechercherSections, repondreQuestion, repondreQuestionAvecWeb } from "@/lib/qa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QaMode = "cours" | "cours_web";
type SectionSource = { id: string; titre: string };

function parseJsonArray<T>(json: string): T[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function toDto(message: QaMessage) {
  return {
    id: message.id,
    question: message.question,
    createdAt: message.createdAt.toISOString(),
    result: {
      reponse: message.reponse,
      source: message.source as QaSource,
      sections: parseJsonArray<SectionSource>(message.sectionsCitees),
      sourcesWeb: parseJsonArray<WebSource>(message.sourcesWeb),
      mode: message.mode as QaMode,
    },
  };
}

async function validateCourseAndStudyUnit(courseId: string, studyUnitId: string | null) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, statut: true },
  });
  if (!course || course.statut !== "pret") {
    return { error: "Cours introuvable ou pas encore prêt.", status: 404 as const };
  }

  if (studyUnitId) {
    const unit = await prisma.studyUnit.findFirst({
      where: { id: studyUnitId, courseId },
      select: { id: true },
    });
    if (!unit) {
      return { error: "Fiche introuvable pour ce cours.", status: 400 as const };
    }
  }

  return { course };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const studyUnitId = url.searchParams.get("studyUnitId")?.trim() || null;

  const validation = await validateCourseAndStudyUnit(id, studyUnitId);
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const messages = await prisma.qaMessage.findMany({
    where: { courseId: id, studyUnitId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ messages: messages.map(toDto) });
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

  const question =
    typeof (body as { question?: unknown }).question === "string"
      ? (body as { question: string }).question.trim()
      : "";
  if (question.length < 3) {
    return NextResponse.json({ error: "Question trop courte." }, { status: 400 });
  }
  const mode =
    (body as { mode?: unknown }).mode === "cours_web" ? "cours_web" : "cours";
  const studyUnitId =
    typeof (body as { studyUnitId?: unknown }).studyUnitId === "string"
      ? (body as { studyUnitId: string }).studyUnitId.trim() || null
      : null;

  const validation = await validateCourseAndStudyUnit(id, studyUnitId);
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const sections = await prisma.section.findMany({
    where: { courseId: id },
    orderBy: { ordre: "asc" },
  });
  const retrouvees = rechercherSections(question, sections);
  const reponse =
    mode === "cours_web"
      ? await repondreQuestionAvecWeb(id, question, retrouvees)
      : await repondreQuestion(id, question, retrouvees);

  const sectionsCitees: SectionSource[] = reponse.sectionsCitees
    .filter((index) => Number.isInteger(index) && index >= 0 && index < retrouvees.length)
    .map((index) => retrouvees[index])
    .filter((section, index, arr) => arr.findIndex((s) => s.id === section.id) === index)
    .map((section) => ({ id: section.id, titre: section.titre }));
  const sourcesWeb = "sourcesWeb" in reponse ? reponse.sourcesWeb : [];

  const message = await prisma.qaMessage.create({
    data: {
      courseId: id,
      studyUnitId,
      question,
      reponse: reponse.reponse,
      source: reponse.source,
      mode,
      sectionsCitees: JSON.stringify(sectionsCitees),
      sourcesWeb: JSON.stringify(sourcesWeb),
    },
  });

  const dto = toDto(message);
  return NextResponse.json({
    message: dto,
    ...dto.result,
  });
}
