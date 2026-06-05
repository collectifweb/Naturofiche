import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  notion: "Notion",
  tableau: "Tableau",
  diathese: "Diathèse",
  meta: "Méta",
};

function excerpt(texte: string, max = 220): string {
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Accueil
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{course.title}</h1>
        <p className="text-sm text-muted-foreground">
          {course.code ? `Cours ${course.code} · ` : ""}Délai {course.delaiJours} jours ·
          Statut {course.statut}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Découpage provisoire</CardTitle>
          <CardDescription>
            {course._count.sections} sections ({matiere} de matière) ·{" "}
            {course._count.questions} questions d&apos;examen détectées. Découpage
            structurel brut — la hiérarchisation par IA arrive en M2.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="space-y-3">
        {course.sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune section extraite.</p>
        ) : (
          course.sections.map((s) => (
            <Card
              key={s.id}
              data-type={s.type}
              className={s.type === "meta" ? "opacity-60" : undefined}
              style={{ marginLeft: `${Math.min(s.niveau - 1, 3) * 12}px` }}
            >
              <CardHeader className="gap-1">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-sm font-medium leading-snug">
                    {s.titre}
                  </CardTitle>
                  <Badge variant={s.type === "tableau" ? "default" : "secondary"}>
                    {TYPE_LABEL[s.type] ?? s.type}
                  </Badge>
                </div>
              </CardHeader>
              {s.texte.trim().length > 0 && (
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {excerpt(s.texte)}
                </CardContent>
              )}
            </Card>
          ))
        )}
      </section>

      <div className="pt-2">
        <Link
          href="/import"
          className={buttonVariants({ variant: "outline", className: "w-full" })}
        >
          Importer un autre cours
        </Link>
      </div>
    </main>
  );
}
