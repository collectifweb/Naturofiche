import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageCircleQuestion } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { QaPanel } from "@/components/qa-panel";

export const dynamic = "force-dynamic";

export default async function QaPage({
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
          <MessageCircleQuestion className="size-5 text-primary" aria-hidden />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Q&amp;A du cours</h1>
        </div>
        <p className="text-[0.9375rem] text-muted-foreground">
          Pose une question. La réponse indique toujours si elle vient du cours, d&apos;un
          complément extérieur, ou des deux.
        </p>
      </div>

      <QaPanel courseId={id} />
    </main>
  );
}
