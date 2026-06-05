import Link from "next/link";
import { Leaf, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { computePlan, type RythmeStatut } from "@/lib/plan";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RYTHME: Record<RythmeStatut, { label: string; cls: string }> = {
  termine: { label: "Terminé", cls: "bg-green-wash text-green-ink" },
  a_jour: { label: "À jour", cls: "bg-secondary text-foreground" },
  en_avance: { label: "En avance", cls: "bg-green-wash text-green-ink" },
  en_retard: { label: "En retard", cls: "bg-brick-wash text-destructive" },
};

export default async function Home() {
  const course = await prisma.course.findFirst({
    where: { actif: true },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { sections: true, questions: true } },
      studyUnits: {
        orderBy: { ordre: "asc" },
        select: { id: true, ordre: true, titre: true, progress: { select: { completeLe: true } } },
      },
    },
  });

  const plan =
    course && course.statut === "pret" && course.studyUnits.length > 0
      ? computePlan(
          course,
          course.studyUnits.map((u) => ({
            id: u.id,
            ordre: u.ordre,
            titre: u.titre,
            completeLe: u.progress?.completeLe ?? null,
          })),
        )
      : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-5 py-9">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Leaf className="size-6 text-primary" aria-hidden />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">NaturoFiche</h1>
        </div>
        <p className="text-[0.9375rem] text-muted-foreground">
          Ton parcours d&apos;étude — l&apos;essentiel pour réussir l&apos;examen.
        </p>
      </header>

      {!course ? (
        <Card className="py-5">
          <CardHeader>
            <CardTitle className="text-lg">Aucun cours actif</CardTitle>
            <CardDescription>
              Importe un cours et son examen pour générer ton parcours d&apos;étude.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/import" className={buttonVariants({ size: "lg", className: "w-full" })}>
              Importer un cours
            </Link>
          </CardFooter>
        </Card>
      ) : (
        <Card className="py-5">
          <CardHeader>
            <CardTitle className="text-lg leading-snug break-words">{course.title}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {course.code && <span className="font-mono text-foreground">F-{course.code}</span>}
              <span>Délai {course.delaiJours} j</span>
              <span aria-hidden>·</span>
              <span>{course.statut}</span>
            </CardDescription>
          </CardHeader>

          {plan ? (
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {plan.termine ? (
                    <span className="font-medium text-foreground">Parcours terminé</span>
                  ) : (
                    <>
                      Jour <span className="font-medium text-foreground">{plan.jourCourant}</span> /{" "}
                      {plan.delaiJours} ·{" "}
                      <span className="font-medium text-foreground">{plan.restantes}</span> restante
                      {plan.restantes > 1 ? "s" : ""}
                    </>
                  )}
                </span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    RYTHME[plan.rythme].cls,
                  )}
                >
                  {RYTHME[plan.rythme].label}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{
                    width: `${plan.total > 0 ? Math.round((plan.completes / plan.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </CardContent>
          ) : (
            <CardContent className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{course._count.sections}</span> sections
              {" · "}
              <span className="font-medium text-foreground">{course._count.questions}</span>{" "}
              questions d&apos;examen
            </CardContent>
          )}

          <CardFooter className="flex flex-col gap-2.5">
            {plan && !plan.termine && plan.prochaineFicheId ? (
              <Link
                href={`/course/${course.id}/fiche/${plan.prochaineFicheId}`}
                className={buttonVariants({ size: "lg", className: "w-full" })}
              >
                Continuer l&apos;étude <ArrowRight />
              </Link>
            ) : null}
            <Link
              href={`/course/${course.id}`}
              className={buttonVariants({
                variant: plan && !plan.termine ? "ghost" : "default",
                size: "lg",
                className: "w-full",
              })}
            >
              Voir le cours
            </Link>
            <Link
              href="/import"
              className={buttonVariants({ variant: "ghost", size: "lg", className: "w-full" })}
            >
              Importer un autre cours
            </Link>
          </CardFooter>
        </Card>
      )}
    </main>
  );
}
