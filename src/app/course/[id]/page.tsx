import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ArrowRight, CalendarDays } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Chip, type ChipVariant } from "@/components/ui/chip";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IngestionProgress } from "@/components/ingestion-progress";
import { computePlan, type PlanState, type RythmeStatut } from "@/lib/plan";
import { cn } from "@/lib/utils";

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

const RYTHME: Record<RythmeStatut, { label: string; cls: string }> = {
  termine: { label: "Terminé", cls: "bg-green-wash text-green-ink" },
  a_jour: { label: "À jour", cls: "bg-secondary text-foreground" },
  en_avance: { label: "En avance", cls: "bg-green-wash text-green-ink" },
  en_retard: { label: "En retard", cls: "bg-brick-wash text-destructive" },
};

const dateFmt = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long" });

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
    studyUnits: { include: { fiche: true; progress: true } };
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
      studyUnits: { orderBy: { ordre: "asc" }, include: { fiche: true, progress: true } },
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
  const plan = computePlan(
    course,
    course.studyUnits.map((u) => ({
      id: u.id,
      ordre: u.ordre,
      titre: u.titre,
      completeLe: u.progress?.completeLe ?? null,
    })),
  );

  return (
    <>
      <PlanHeader courseId={course.id} plan={plan} />
      <FichesParcours courseId={course.id} plan={plan} />
      <Reference course={course} />
    </>
  );
}

function PlanHeader({ courseId, plan }: { courseId: string; plan: PlanState }) {
  const pct = plan.total > 0 ? Math.round((plan.completes / plan.total) * 100) : 0;
  const rythme = RYTHME[plan.rythme];
  const rythmeLabel =
    plan.rythme === "en_retard"
      ? `En retard de ${plan.retard}`
      : plan.rythme === "en_avance"
        ? `En avance de ${plan.avance}`
        : rythme.label;

  return (
    <Card className="gap-3 py-5">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-[0.95rem] font-semibold">
            {plan.termine ? "Parcours terminé" : `Jour ${plan.jourCourant} / ${plan.delaiJours}`}
          </CardTitle>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[0.8125rem] font-medium",
              rythme.cls,
            )}
          >
            {rythmeLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{plan.completes}</span> / {plan.total}{" "}
              fiches
            </span>
            <span className="tabular-nums text-muted-foreground">{pct} %</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {!plan.termine && (
            <>
              <span>
                Aujourd&apos;hui :{" "}
                <span className="font-medium text-foreground">{plan.fichesDuJourIds.length}</span>{" "}
                fiche{plan.fichesDuJourIds.length > 1 ? "s" : ""}
              </span>
              <span aria-hidden>·</span>
            </>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden /> Échéance {dateFmt.format(plan.echeance)}
          </span>
        </p>

        {plan.termine ? (
          <p className="text-sm text-foreground">
            Toutes les fiches sont complétées. Tu peux relire n&apos;importe quelle fiche ci-dessous.
          </p>
        ) : (
          plan.prochaineFicheId && (
            <Link
              href={`/course/${courseId}/fiche/${plan.prochaineFicheId}`}
              className={buttonVariants({ size: "lg", className: "w-full" })}
            >
              Continuer l&apos;étude <ArrowRight />
            </Link>
          )
        )}
      </CardContent>
    </Card>
  );
}

function FichesParcours({ courseId, plan }: { courseId: string; plan: PlanState }) {
  const incompletes = plan.units.filter((u) => !u.estComplete);
  const completes = plan.units.filter((u) => u.estComplete);

  // Les unités incomplètes sont déjà triées par ordre, donc par jour effectif croissant.
  const groupes: { jour: number; units: typeof incompletes }[] = [];
  for (const u of incompletes) {
    const jour = u.jourEffectif ?? plan.jourCourant;
    const last = groupes[groupes.length - 1];
    if (last && last.jour === jour) last.units.push(u);
    else groupes.push({ jour, units: [u] });
  }

  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold">Fiches à étudier</h2>

      {groupes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Plus aucune fiche en attente — parcours terminé.
        </p>
      ) : (
        groupes.map((g) => {
          const estAujourdhui = g.jour === plan.jourCourant;
          return (
            <div key={g.jour} className="space-y-1.5">
              <p
                className={cn(
                  "text-[0.8125rem] font-medium",
                  estAujourdhui ? "text-primary" : "text-muted-foreground",
                )}
              >
                {estAujourdhui ? "Aujourd'hui" : `Jour ${g.jour}`}
              </p>
              {g.units.map((u) => (
                <Link
                  key={u.id}
                  href={`/course/${courseId}/fiche/${u.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--radius)] bg-card px-4 py-3 ring-1 transition-colors hover:bg-muted",
                    estAujourdhui ? "ring-primary/30" : "ring-foreground/10",
                  )}
                >
                  <span className="min-w-0 flex-1 text-[0.95rem] font-medium break-words">
                    {u.titre}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              ))}
            </div>
          );
        })
      )}

      {completes.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-primary" aria-hidden />
              {completes.length} fiche{completes.length > 1 ? "s" : ""} terminée
              {completes.length > 1 ? "s" : ""}
              <span className="text-muted-foreground/60 group-open:hidden"> — afficher</span>
            </span>
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {completes.map((u) => (
              <Link
                key={u.id}
                href={`/course/${courseId}/fiche/${u.id}`}
                className="flex items-center gap-3 rounded-[var(--radius)] bg-card/60 px-4 py-2.5 ring-1 ring-foreground/10 transition-colors hover:bg-muted"
              >
                <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1 text-sm text-muted-foreground break-words">
                  {u.titre}
                </span>
              </Link>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function Reference({ course }: { course: CourseWithRelations }) {
  const matiere = course.sections.filter((s) => s.type !== "meta");
  const essentielles = matiere.filter((s) => s.importance === "essentiel").length;
  const examenOfficiel = course.questions.filter((q) => q.type === "examen_officiel");
  const valides = course.questions.filter((q) => q.statutValidation === "valide").length;
  const sectionById = new Map(course.sections.map((s) => [s.id, s]));

  return (
    <section className="space-y-3 border-t border-border pt-5">
      <p className="text-[0.8125rem] text-muted-foreground">
        <span className="font-medium text-foreground">{matiere.length}</span> sections de matière (
        {essentielles} essentielles) ·{" "}
        <span className="font-medium text-foreground">{examenOfficiel.length}</span> questions
        d&apos;examen · <span className="font-medium text-foreground">{valides}</span> validées.
      </p>

      <details>
        <summary className="cursor-pointer list-none font-heading text-base font-semibold">
          Sections du cours <span className="text-sm font-normal text-muted-foreground">(réf.)</span>
        </summary>
        <div className="mt-2.5 space-y-2.5">
          {matiere.map((s) => (
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
          ))}
        </div>
      </details>

      {examenOfficiel.length > 0 && (
        <details>
          <summary className="cursor-pointer list-none font-heading text-base font-semibold">
            Questions d&apos;examen{" "}
            <span className="text-sm font-normal text-muted-foreground">(réf.)</span>
          </summary>
          <div className="mt-2.5 space-y-2.5">
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
                            {bonne && (
                              <CheckCircle2 className="ml-auto size-4 shrink-0" aria-hidden />
                            )}
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
                        {rejete && (
                          <span className="text-destructive">⚠ à vérifier (non validée)</span>
                        )}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </details>
      )}

      <div className="pt-1">
        <Link
          href="/import"
          className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}
        >
          Importer un autre cours
        </Link>
      </div>
    </section>
  );
}
