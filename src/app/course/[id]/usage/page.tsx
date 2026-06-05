import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const fmt = new Intl.NumberFormat("fr-CA");

const PHASE_LABEL: Record<string, string> = {
  ingestion: "Ingestion",
  verification: "Vérification",
  qa: "Q&A",
};

export default async function UsagePage({
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

  const rows = await prisma.apiUsageLog.groupBy({
    by: ["phase", "model"],
    where: { courseId: id },
    _sum: { inputTokens: true, outputTokens: true },
    _count: true,
    orderBy: [{ phase: "asc" }, { model: "asc" }],
  });

  const total = rows.reduce(
    (acc, row) => ({
      appels: acc.appels + row._count,
      inputTokens: acc.inputTokens + (row._sum.inputTokens ?? 0),
      outputTokens: acc.outputTokens + (row._sum.outputTokens ?? 0),
    }),
    { appels: 0, inputTokens: 0, outputTokens: 0 },
  );

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
          <Activity className="size-5 text-primary" aria-hidden />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Usage API</h1>
        </div>
        <p className="text-[0.9375rem] text-muted-foreground">
          Appels Anthropic journalisés pour ce cours, par phase et modèle.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[var(--radius)] bg-card p-5 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">Aucun appel API journalisé pour ce cours.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius)] bg-card ring-1 ring-foreground/10">
          <div className="grid grid-cols-[1fr_1.2fr_4rem_5.5rem_5.5rem] gap-2 border-b border-border px-3 py-2 text-[0.75rem] font-medium text-muted-foreground">
            <span>Phase</span>
            <span>Modèle</span>
            <span className="text-right">Appels</span>
            <span className="text-right">In</span>
            <span className="text-right">Out</span>
          </div>
          {rows.map((row) => (
            <div
              key={`${row.phase}-${row.model}`}
              className="grid grid-cols-[1fr_1.2fr_4rem_5.5rem_5.5rem] gap-2 border-b border-border/70 px-3 py-2 text-sm last:border-b-0"
            >
              <span>{PHASE_LABEL[row.phase] ?? row.phase}</span>
              <span className="min-w-0 truncate font-mono text-[0.8125rem] text-muted-foreground">
                {row.model}
              </span>
              <span className="text-right font-mono">{fmt.format(row._count)}</span>
              <span className="text-right font-mono">
                {fmt.format(row._sum.inputTokens ?? 0)}
              </span>
              <span className="text-right font-mono">
                {fmt.format(row._sum.outputTokens ?? 0)}
              </span>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_1.2fr_4rem_5.5rem_5.5rem] gap-2 bg-muted/60 px-3 py-2 text-sm font-medium">
            <span>Total</span>
            <span />
            <span className="text-right font-mono">{fmt.format(total.appels)}</span>
            <span className="text-right font-mono">{fmt.format(total.inputTokens)}</span>
            <span className="text-right font-mono">{fmt.format(total.outputTokens)}</span>
          </div>
        </div>
      )}
    </main>
  );
}
