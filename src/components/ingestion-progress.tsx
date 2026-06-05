"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Status {
  statut: string;
  etape: string | null;
  pct: number;
  erreurMessage: string | null;
}

const EN_COURS = ["nouveau", "extraction", "ingestion", "verification"];

export function IngestionProgress({
  courseId,
  initial,
}: {
  courseId: string;
  initial: Status;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initial);
  const [relancing, setRelancing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!EN_COURS.includes(status.statut)) return;

    async function poll() {
      try {
        const res = await fetch(`/api/course/${courseId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const next: Status = await res.json();
        setStatus(next);
        if (next.statut === "pret") {
          router.refresh(); // bascule vers le vrai contenu (rendu serveur)
        }
      } catch {
        // réseau capricieux : on réessaiera au prochain tick.
      }
    }

    timer.current = setInterval(poll, 2000);
    poll();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [courseId, status.statut, router]);

  async function relancer() {
    setRelancing(true);
    try {
      await fetch(`/api/course/${courseId}/ingest?force=1`, { method: "POST" });
      setStatus((s) => ({ ...s, statut: "ingestion", erreurMessage: null, pct: 2 }));
    } finally {
      setRelancing(false);
    }
  }

  if (status.statut === "erreur") {
    return (
      <div className="rounded-[var(--radius)] bg-card p-6 ring-1 ring-foreground/10">
        <div className="flex items-center gap-2 text-[0.95rem] font-medium">
          <AlertTriangle className="size-5 text-destructive" aria-hidden />
          L&apos;ingestion a échoué
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {status.erreurMessage ?? "Erreur inconnue pendant le traitement IA."}
        </p>
        <Button onClick={relancer} disabled={relancing} className="mt-4">
          {relancing ? "Relance…" : "Relancer l'ingestion"}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius)] bg-card p-6 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2">
        <Leaf className="size-5 animate-pulse text-primary" aria-hidden />
        <h2 className="font-heading text-lg font-semibold">Préparation du parcours…</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {status.etape ?? "Analyse du cours en cours."} L&apos;IA découpe, hiérarchise, déduit les
        réponses et vérifie. Cela prend quelques minutes — tu peux quitter et revenir.
      </p>

      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${Math.max(2, Math.min(status.pct, 100))}%` }}
        />
      </div>
      <p className="mt-2 text-right text-xs tabular-nums text-muted-foreground">{status.pct}%</p>
    </div>
  );
}
