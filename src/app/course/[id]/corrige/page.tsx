import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CorrigeImport, type CorrigeQuestionMini } from "@/components/corrige-import";
import { Chip } from "@/components/ui/chip";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("fr-CA", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function parseJsonArray<T>(json: string): T[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default async function CorrigePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      officialKey: true,
      questions: {
        where: { type: "examen_officiel" },
        orderBy: { id: "asc" },
        select: { id: true, enonce: true, bonneReponse: true },
      },
    },
  });
  if (!course || course.statut !== "pret") notFound();

  const questions: CorrigeQuestionMini[] = course.questions.map((q, index) => ({
    numero: index + 1,
    enonce: q.enonce,
    bonneReponseIA: q.bonneReponse,
  }));

  const ecarts = course.officialKey
    ? parseJsonArray<{ numero: number }>(course.officialKey.ecartsDetectes)
    : [];

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
          <ClipboardCheck className="size-5 text-primary" aria-hidden />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Corrigé officiel
          </h1>
        </div>
        <p className="text-[0.9375rem] text-muted-foreground">
          Import des 20 réponses officielles et correction des écarts avec les réponses déduites.
        </p>
      </div>

      {course.officialKey && (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] bg-card p-4 text-sm ring-1 ring-foreground/10">
          <Chip variant="essentiel">Corrigé appliqué</Chip>
          <span className="text-muted-foreground">
            {dateFmt.format(course.officialKey.importeLe)} · {ecarts.length} écart
            {ecarts.length > 1 ? "s" : ""} corrigé{ecarts.length > 1 ? "s" : ""}
          </span>
        </div>
      )}

      <CorrigeImport courseId={id} questions={questions} />
    </main>
  );
}
