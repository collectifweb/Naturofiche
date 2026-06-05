import Link from "next/link";
import { Leaf } from "lucide-react";
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
            <CardTitle className="text-lg leading-snug">{course.title}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {course.code && (
                <span className="font-mono text-foreground">F-{course.code}</span>
              )}
              <span>Délai {course.delaiJours} j</span>
              <span aria-hidden>·</span>
              <span>{course.statut}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{course._count.sections}</span> sections
            {" · "}
            <span className="font-medium text-foreground">{course._count.questions}</span> questions
            d&apos;examen
          </CardContent>
          <CardFooter className="flex flex-col gap-2.5">
            <Link
              href={`/course/${course.id}`}
              className={buttonVariants({ size: "lg", className: "w-full" })}
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
