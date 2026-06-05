import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Chip, type ChipVariant } from "@/components/ui/chip";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  notion: "Notion",
  tableau: "Tableau",
  diathese: "Diathèse",
  meta: "Méta",
};

function chipVariant(type: string): ChipVariant {
  return type === "meta" ? "secondaire" : "utile";
}

function excerpt(texte: string, max = 240): string {
  const clean = texte.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

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
      _count: { select: { questions: true, sections: true } },
    },
  });

  if (!course) notFound();

  const matiere = course.sections.filter((s) => s.type !== "meta").length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-9">
      <div className="space-y-1.5">
        <Link
          href="/"
          className="inline-flex text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Accueil
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{course.title}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.9375rem] text-muted-foreground">
          {course.code && <span className="font-mono text-foreground">F-{course.code}</span>}
          <span>Délai {course.delaiJours} j</span>
          <span aria-hidden>·</span>
          <span>{course.statut}</span>
        </p>
      </div>

      <Card className="gap-2 py-4">
        <CardHeader>
          <CardTitle className="text-[0.8125rem] font-medium tracking-[0.01em] text-muted-foreground uppercase">
            Découpage provisoire
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{course._count.sections}</span> sections (
          {matiere} de matière) ·{" "}
          <span className="font-medium text-foreground">{course._count.questions}</span> questions
          d&apos;examen détectées. Découpage structurel brut — la hiérarchisation par IA arrive
          en M2.
        </CardContent>
      </Card>

      <section className="space-y-2.5">
        {course.sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune section extraite.</p>
        ) : (
          course.sections.map((s) => (
            <Card
              key={s.id}
              data-type={s.type}
              className={s.type === "meta" ? "gap-2 py-4 opacity-55" : "gap-2 py-4"}
              style={{ marginLeft: `${Math.min(s.niveau - 1, 3) * 14}px` }}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-[0.95rem] leading-snug font-medium">
                    {s.titre}
                  </CardTitle>
                  <Chip variant={chipVariant(s.type)}>{TYPE_LABEL[s.type] ?? s.type}</Chip>
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

      <div className="pt-1">
        <Link
          href="/import"
          className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}
        >
          Importer un autre cours
        </Link>
      </div>
    </main>
  );
}
