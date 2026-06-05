import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { QuizRunner, type QuizQuestion } from "@/components/quiz-runner";
import { estEchu, prioriserRevision } from "@/lib/leitner";

export const dynamic = "force-dynamic";

const LOT = 10;

function parseJsonArray<T>(json: string): T[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default async function RevisionPage({
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

  // Notions déjà vues (ReviewItem) sur des quiz valides : on priorise les boîtes basses.
  const items = await prisma.reviewItem.findMany({
    where: { question: { courseId: id, type: "quiz_verif", statutValidation: "valide" } },
    include: { question: true },
  });

  const now = new Date();
  const echus = items.filter((it) => estEchu(it, now));
  // Échus d'abord ; sinon, révision en avance sur les notions les moins maîtrisées.
  const pool = echus.length > 0 ? echus : items;
  const lot = prioriserRevision(pool).slice(0, LOT);

  const questions: QuizQuestion[] = lot.map((it) => ({
    id: it.question.id,
    enonce: it.question.enonce,
    options: parseJsonArray<{ key: string; text: string }>(it.question.options),
    bonneReponse: it.question.bonneReponse ?? "",
    justification: it.question.justification,
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
          <RefreshCw className="size-5 text-primary" aria-hidden />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Révision</h1>
        </div>
        <p className="text-[0.9375rem] text-muted-foreground">
          {questions.length > 0
            ? `Repasse ${questions.length} notion${questions.length > 1 ? "s" : ""} pour ancrer ta mémoire avant l'examen.`
            : "Rien à réviser pour l'instant."}
        </p>
      </div>

      {questions.length > 0 ? (
        <QuizRunner courseId={id} questions={questions} mode="revision" />
      ) : (
        <div className="rounded-[var(--radius)] bg-card p-6 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">
            Tu n&apos;as pas encore de notion à réviser. Étudie des fiches et fais leurs mini-quiz :
            les notions vérifiées reviendront ici, espacées dans le temps.
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
