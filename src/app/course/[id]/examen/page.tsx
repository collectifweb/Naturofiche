import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, GraduationCap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { ExamRunner, type ExamQuestion } from "@/components/exam-runner";

export const dynamic = "force-dynamic";

const NB_QUESTIONS = 20;

function parseJsonArray<T>(json: string): T[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Mélange (Fisher-Yates) — tirage varié à chaque passage. */
function melange<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function ExamenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    select: { id: true, title: true, statut: true },
  });
  if (!course || course.statut !== "pret") notFound();

  const rows = await prisma.question.findMany({
    where: { courseId: id, type: "examen_blanc", statutValidation: "valide" },
    include: { sectionSource: true },
  });

  const questions: ExamQuestion[] = melange(rows)
    .slice(0, NB_QUESTIONS)
    .map((q) => ({
      id: q.id,
      enonce: q.enonce,
      options: parseJsonArray<{ key: string; text: string }>(q.options),
      bonneReponse: q.bonneReponse ?? "",
      justification: q.justification,
      sourceTitre: q.sectionSource?.titre ?? null,
    }));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-9">
      <div className="space-y-1.5">
        <Link
          href={`/course/${id}`}
          className="inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden /> {course.title}
        </Link>
        <div className="flex items-center gap-2">
          <GraduationCap className="size-5 text-primary" aria-hidden />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Examen blanc</h1>
        </div>
        <p className="text-[0.9375rem] text-muted-foreground">
          {questions.length} QCM dans le style de l&apos;examen. Réussite au seuil 80 %.
        </p>
      </div>

      {questions.length > 0 ? (
        <ExamRunner questions={questions} />
      ) : (
        <div className="rounded-[var(--radius)] bg-card p-6 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">
            Aucune question d&apos;examen blanc disponible pour ce cours.
          </p>
          <Link
            href={`/course/${id}`}
            className={buttonVariants({ size: "lg", className: "mt-4 w-full" })}
          >
            Retour au parcours
          </Link>
        </div>
      )}
    </main>
  );
}
