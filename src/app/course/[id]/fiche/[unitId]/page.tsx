import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, CheckCircle2, MessageCircleQuestion } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Chip } from "@/components/ui/chip";
import { buttonVariants } from "@/components/ui/button";
import { FicheMarkdown } from "@/components/fiche-markdown";
import { QaPanel } from "@/components/qa-panel";
import { QuizRunner, type QuizQuestion } from "@/components/quiz-runner";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function parseJsonArray<T>(json: string): T[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default async function FichePage({
  params,
}: {
  params: Promise<{ id: string; unitId: string }>;
}) {
  const { id, unitId } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    select: { id: true, title: true, statut: true },
  });
  if (!course || course.statut !== "pret") notFound();

  const unit = await prisma.studyUnit.findFirst({
    where: { id: unitId, courseId: id },
    include: { fiche: true, progress: true },
  });
  if (!unit) notFound();

  // Voisins (par ordre) pour la navigation préc./suiv.
  const tous = await prisma.studyUnit.findMany({
    where: { courseId: id },
    orderBy: { ordre: "asc" },
    select: { id: true, ordre: true },
  });
  const idx = tous.findIndex((u) => u.id === unit.id);
  const prev = idx > 0 ? tous[idx - 1] : null;
  const next = idx >= 0 && idx < tous.length - 1 ? tous[idx + 1] : null;

  // Mini-quiz de la fiche : quiz_verif rattachés, non rejetés par le vérificateur.
  const rows = await prisma.question.findMany({
    where: {
      courseId: id,
      studyUnitId: unit.id,
      type: "quiz_verif",
      statutValidation: { not: "rejete" },
    },
    orderBy: { id: "asc" },
  });
  const questions: QuizQuestion[] = rows.map((q) => ({
    id: q.id,
    enonce: q.enonce,
    options: parseJsonArray<{ key: string; text: string }>(q.options),
    bonneReponse: q.bonneReponse ?? "",
    justification: q.justification,
  }));

  const notions = parseJsonArray<string>(unit.fiche?.notionsCles ?? "[]");
  const dejaFait = !!unit.progress?.completeLe;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-9">
      <div className="space-y-1.5">
        <Link
          href={`/course/${id}`}
          className="inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden /> {course.title}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight break-words">
            {unit.titre}
          </h1>
          {dejaFait && (
            <Chip variant="essentiel" className="mt-1 gap-1">
              <CheckCircle2 className="size-3.5" aria-hidden /> Terminée
            </Chip>
          )}
        </div>
        <p className="text-[0.8125rem] text-muted-foreground">
          Fiche {idx + 1} / {tous.length}
        </p>
      </div>

      {/* La fiche de synthèse */}
      <article>
        {unit.fiche ? (
          <FicheMarkdown>{unit.fiche.contenuMarkdown}</FicheMarkdown>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune fiche pour cette unité.</p>
        )}
      </article>

      {notions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {notions.map((n) => (
            <Chip key={n} variant="utile">
              {n}
            </Chip>
          ))}
        </div>
      )}

      {/* Q&A contextuel : posé ici, quand la question apparaît pendant la lecture. */}
      <section className="space-y-3 border-t border-border pt-5">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="size-4 text-primary" aria-hidden />
          <h2 className="font-heading text-lg font-semibold">Question sur cette fiche</h2>
        </div>
        <QaPanel
          courseId={id}
          studyUnitId={unit.id}
          compact
          placeholder={`Question sur ${unit.titre}`}
          emptyText="Les réponses seront conservées avec cette fiche, avec leurs sources."
        />
      </section>

      {/* Mini-quiz de vérification */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Mini-quiz</h2>
        <QuizRunner courseId={id} studyUnitId={unit.id} questions={questions} />
      </section>

      {/* Navigation séquentielle (parcourir tout le contenu librement, §5.3) */}
      <nav className="flex items-center justify-between gap-3 pt-1">
        {prev ? (
          <Link
            href={`/course/${id}/fiche/${prev.id}`}
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            <ChevronLeft /> Précédente
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/course/${id}/fiche/${next.id}`}
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "ml-auto")}
          >
            Suivante <ChevronRight />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
