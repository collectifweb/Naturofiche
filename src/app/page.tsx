import Link from "next/link";
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

export const dynamic = "force-dynamic";

export default async function Home() {
  const course = await prisma.course.findFirst({
    where: { actif: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sections: true, questions: true } } },
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">NaturoFiche</h1>
        <p className="text-sm text-muted-foreground">
          Ton parcours d&apos;étude — l&apos;essentiel pour réussir l&apos;examen.
        </p>
      </header>

      {!course ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucun cours actif</CardTitle>
            <CardDescription>
              Importe un cours et son examen pour générer ton parcours d&apos;étude.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/import" className={buttonVariants({ className: "w-full" })}>
              Importer un cours
            </Link>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{course.title}</CardTitle>
            <CardDescription>
              {course.code ? `Cours ${course.code} · ` : ""}
              Délai : {course.delaiJours} jours · Statut : {course.statut}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {course._count.sections} sections · {course._count.questions} questions
            d&apos;examen
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Link
              href={`/course/${course.id}`}
              className={buttonVariants({ className: "w-full" })}
            >
              Voir le cours
            </Link>
            <Link
              href="/import"
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              Importer un autre cours
            </Link>
          </CardFooter>
        </Card>
      )}
    </main>
  );
}
