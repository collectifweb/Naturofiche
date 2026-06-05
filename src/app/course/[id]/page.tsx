import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Chip, type ChipVariant } from "@/components/ui/chip";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IngestionProgress } from "@/components/ingestion-progress";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  notion: "Notion",
  tableau: "Tableau",
  diathese: "Diathèse",
  meta: "Méta",
};

const IMPORTANCE_LABEL: Record<string, string> = {
  essentiel: "Essentiel",
  utile: "Utile",
  secondaire: "Secondaire",
};

function importanceVariant(importance: string | null): ChipVariant {
  return importance === "essentiel" || importance === "utile" ? importance : "secondaire";
}

function excerpt(texte: string, max = 220): string {
  const clean = texte.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

interface Option {
  key: string;
  text: string;
}

function parseOptions(json: string): Option[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

type CourseWithRelations = Prisma.CourseGetPayload<{
  include: {
    sections: true;
    studyUnits: { include: { fiche: true } };
    questions: true;
  };
}>;

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      sections: { orderBy: { ordre: "asc" } },
      studyUnits: { orderBy: { ordre: "asc" }, include: { fiche: true } },
      questions: { orderBy: { id: "asc" } },
    },
  });

  if (!course) notFound();

  const enCours = course.statut !== "pret";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-9">
      <div className="space-y-1.5">
        <Link
          href="/"
          className="inline-flex text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Accueil
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight break-words">
          {course.title}
        </h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.9375rem] text-muted-foreground">
          {course.code && <span className="font-mono text-foreground">F-{course.code}</span>}
          <span>Délai {course.delaiJours} j</span>
          <span aria-hidden>·</span>
          <span>{course.statut}</span>
        </p>
      </div>

      {enCours ? (
        <IngestionProgress
          courseId={course.id}
          initial={{
            statut: course.statut,
            etape: course.etapeIngestion,
            pct: course.progressPct,
            erreurMessage: course.erreurMessage,
          }}
        />
      ) : (
        <CourseContent course={course} />
      )}
    </main>
  );
}

function CourseContent({ course }: { course: CourseWithRelations }) {
  const matiere = course.sections.filter((s) => s.type !== "meta");
  const essentielles = matiere.filter((s) => s.importance === "essentiel").length;
  const examenOfficiel = course.questions.filter((q) => q.type === "examen_officiel");
  const valides = course.questions.filter((q) => q.statutValidation === "valide").length;
  const sectionById = new Map(course.sections.map((s) => [s.id, s]));

  return (
    <>
      <Card className="gap-2 py-4">
        <CardHeader>
          <CardTitle className="text-[0.8125rem] font-medium tracking-[0.01em] text-muted-foreground uppercase">
            Parcours généré
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{matiere.length}</span> sections de matière
          ({essentielles} essentielles) ·{" "}
          <span className="font-medium text-foreground">{course.studyUnits.length}</span> fiches ·{" "}
          <span className="font-medium text-foreground">{examenOfficiel.length}</span> questions
          d&apos;examen · <span className="font-medium text-foreground">{valides}</span> validées.
        </CardContent>
      </Card>

      {/* Sections hiérarchisées */}
      <section className="space-y-2.5">
        <h2 className="font-heading text-lg font-semibold">Sections</h2>
        {matiere.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune section de matière.</p>
        ) : (
          matiere.map((s) => (
            <Card
              key={s.id}
              data-importance={s.importance ?? "secondaire"}
              className="gap-2 py-4"
              style={{ marginLeft: `${Math.min(s.niveau - 1, 3) * 14}px` }}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="min-w-0 text-[0.95rem] leading-snug font-medium break-words">
                    {s.titre}
                  </CardTitle>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[0.75rem] text-muted-foreground">
                      {TYPE_LABEL[s.type] ?? s.type}
                    </span>
                    <Chip variant={importanceVariant(s.importance)}>
                      {IMPORTANCE_LABEL[s.importance ?? "secondaire"]}
                    </Chip>
                  </div>
                </div>
              </CardHeader>
              {s.texte.trim().length > 0 && (
                <CardContent>
                  <p className="font-serif text-[0.9375rem] leading-relaxed text-foreground/80">
                    {excerpt(s.texte)}
                  </p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </section>

      {/* Fiches du parcours */}
      {course.studyUnits.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="font-heading text-lg font-semibold">Fiches</h2>
          {course.studyUnits.map((u) => (
            <Card key={u.id} className="gap-2 py-4">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="min-w-0 text-[0.95rem] leading-snug font-medium break-words">
                    {u.titre}
                  </CardTitle>
                  <span className="shrink-0 text-[0.75rem] text-muted-foreground">
                    Jour {u.jourCible}
                  </span>
                </div>
              </CardHeader>
              {u.fiche && (
                <CardContent>
                  <p className="font-serif text-[0.9375rem] leading-relaxed text-foreground/80">
                    {excerpt(u.fiche.contenuMarkdown, 200)}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </section>
      )}

      {/* Questions d'examen : réponse déduite + justification + source */}
      {examenOfficiel.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="font-heading text-lg font-semibold">Questions d&apos;examen</h2>
          {examenOfficiel.map((q, i) => {
            const options = parseOptions(q.options);
            const source = q.sectionSourceId ? sectionById.get(q.sectionSourceId) : null;
            const rejete = q.statutValidation === "rejete";
            return (
              <Card key={q.id} className="gap-2 py-4">
                <CardHeader>
                  <CardTitle className="text-[0.95rem] leading-snug font-medium break-words">
                    <span className="font-mono text-muted-foreground">{i + 1}.</span> {q.enonce}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <ul className="space-y-1 text-sm">
                    {options.map((o) => {
                      const bonne = o.key === q.bonneReponse;
                      return (
                        <li
                          key={o.key}
                          className={
                            bonne
                              ? "flex items-center gap-2 rounded-md bg-green-wash px-2 py-1 text-green-ink"
                              : "flex items-center gap-2 px-2 py-1 text-foreground/80"
                          }
                        >
                          <span className="font-mono text-[0.8125rem]">{o.key}</span>
                          <span className="min-w-0 break-words">{o.text}</span>
                          {bonne && <CheckCircle2 className="ml-auto size-4 shrink-0" aria-hidden />}
                        </li>
                      );
                    })}
                  </ul>
                  {q.justification && (
                    <p className="font-serif text-[0.875rem] leading-relaxed text-muted-foreground">
                      {q.justification}
                    </p>
                  )}
                  {(source || rejete) && (
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {source && <span>Source : {source.titre}</span>}
                      {rejete && <span className="text-destructive">⚠ à vérifier (non validée)</span>}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <div className="pt-1">
        <Link
          href="/import"
          className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}
        >
          Importer un autre cours
        </Link>
      </div>
    </>
  );
}
