"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QuizQuestion {
  id: string;
  enonce: string;
  options: { key: string; text: string }[];
  bonneReponse: string;
  justification: string | null;
}

// Mini-quiz QCM (cahier §5.4) : sélection puis correction immédiate avec explication
// renvoyant à la fiche. Deux modes :
// - "fiche"   : valide la fiche du jour → enregistre complétion + score (progress) et
//   alimente les boîtes de Leitner (review), puis enchaîne la fiche suivante.
// - "revision": pratique espacée (§5.5) → met seulement à jour les boîtes de Leitner.
export function QuizRunner({
  courseId,
  studyUnitId,
  questions,
  mode = "fiche",
}: {
  courseId: string;
  studyUnitId?: string;
  questions: QuizQuestion[];
  mode?: "fiche" | "revision";
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prochaineFicheId, setProchaineFicheId] = useState<string | null>(null);
  const [dusRestants, setDusRestants] = useState<number | null>(null);

  const tousRepondu = questions.every((q) => answers[q.id]);
  const score = useMemo(() => {
    if (questions.length === 0) return null;
    const bons = questions.filter((q) => answers[q.id] === q.bonneReponse).length;
    return Math.round((bons / questions.length) * 100);
  }, [answers, questions]);
  const bons = questions.filter((q) => answers[q.id] === q.bonneReponse).length;

  // Alimente les boîtes de Leitner (les deux modes).
  async function enregistrerReview(): Promise<void> {
    const resultats = questions.map((q) => ({
      questionId: q.id,
      correct: answers[q.id] === q.bonneReponse,
    }));
    try {
      const res = await fetch(`/api/course/${courseId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultats }),
      });
      const json = await res.json();
      if (res.ok) setDusRestants(typeof json.dus === "number" ? json.dus : null);
    } catch {
      // best effort : la révision n'est pas bloquante.
    }
  }

  // Enregistre la complétion de la fiche (mode fiche uniquement).
  async function enregistrerProgress(scoreQuiz: number | null): Promise<boolean> {
    try {
      const res = await fetch(`/api/course/${courseId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studyUnitId, scoreQuiz }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Échec de l'enregistrement.");
      setProchaineFicheId(json.prochaineFicheId ?? null);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'enregistrement.");
      return false;
    }
  }

  async function valider() {
    setRevealed(true);
    setSaving(true);
    try {
      await enregistrerReview();
      if (mode === "fiche") {
        const ok = await enregistrerProgress(score);
        if (ok) toast.success("Fiche terminée. Progression enregistrée.");
      } else {
        toast.success("Révision enregistrée.");
      }
    } finally {
      setSaving(false);
    }
  }

  function continuer() {
    if (mode === "revision") {
      router.push(`/course/${courseId}`);
      return;
    }
    if (prochaineFicheId) {
      router.push(`/course/${courseId}/fiche/${prochaineFicheId}`);
    } else {
      toast.success("Parcours terminé — bravo !");
      router.push(`/course/${courseId}`);
    }
  }

  // Unité sans quiz exploitable (mode fiche) : simple marquage de complétion.
  if (questions.length === 0) {
    return (
      <div className="rounded-[var(--radius)] bg-card p-5 ring-1 ring-foreground/10">
        <p className="text-sm text-muted-foreground">
          Pas de mini-quiz pour cette fiche. Marque-la comme terminée quand tu l&apos;as lue.
        </p>
        {revealed ? (
          <Button onClick={continuer} size="lg" disabled={saving} className="mt-4 w-full">
            {prochaineFicheId ? (
              <>
                Fiche suivante <ArrowRight />
              </>
            ) : (
              "Voir mon parcours"
            )}
          </Button>
        ) : (
          <Button
            onClick={async () => {
              setRevealed(true);
              setSaving(true);
              const ok = await enregistrerProgress(null);
              setSaving(false);
              if (ok) toast.success("Fiche terminée.");
            }}
            size="lg"
            disabled={saving}
            className="mt-4 w-full"
          >
            {saving ? "Enregistrement…" : "Marquer comme terminé"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q, i) => {
        const choisi = answers[q.id];
        return (
          <div
            key={q.id}
            className="rounded-[var(--radius)] bg-card p-5 ring-1 ring-foreground/10"
          >
            <p className="text-[0.95rem] leading-snug font-medium break-words">
              <span className="font-mono text-muted-foreground">{i + 1}.</span> {q.enonce}
            </p>
            <ul className="mt-3 space-y-1.5">
              {q.options.map((o) => {
                const estChoisi = choisi === o.key;
                const estBon = o.key === q.bonneReponse;
                let cls = "ring-1 ring-border hover:bg-muted";
                let icon = null;
                if (revealed) {
                  if (estBon) {
                    cls = "bg-green-wash text-green-ink ring-1 ring-green-ink/20";
                    icon = <CheckCircle2 className="ml-auto size-4 shrink-0" aria-hidden />;
                  } else if (estChoisi) {
                    cls = "bg-brick-wash text-destructive ring-1 ring-destructive/20";
                    icon = <XCircle className="ml-auto size-4 shrink-0" aria-hidden />;
                  } else {
                    cls = "ring-1 ring-border opacity-70";
                  }
                } else if (estChoisi) {
                  cls = "bg-secondary ring-1 ring-ring";
                }
                return (
                  <li key={o.key}>
                    <button
                      type="button"
                      disabled={revealed || saving}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "disabled:cursor-default",
                        cls,
                      )}
                    >
                      <span className="font-mono text-[0.8125rem]">{o.key}</span>
                      <span className="min-w-0 break-words">{o.text}</span>
                      {icon}
                    </button>
                  </li>
                );
              })}
            </ul>
            {revealed && q.justification && (
              <p className="mt-3 font-serif text-[0.875rem] leading-relaxed text-muted-foreground">
                {q.justification}
              </p>
            )}
          </div>
        );
      })}

      {!revealed ? (
        <Button onClick={valider} size="lg" disabled={!tousRepondu || saving} className="w-full">
          {saving ? "Enregistrement…" : "Valider mes réponses"}
        </Button>
      ) : (
        <div className="rounded-[var(--radius)] bg-card p-5 ring-1 ring-foreground/10">
          <p className="text-[0.95rem]">
            Score :{" "}
            <span className="font-semibold text-foreground">
              {bons} / {questions.length}
            </span>{" "}
            <span className="text-muted-foreground">({score} %)</span>
          </p>
          {mode === "revision" && dusRestants !== null && dusRestants > 0 && (
            <Button
              onClick={() => router.refresh()}
              variant="outline"
              size="lg"
              disabled={saving}
              className="mt-4 w-full"
            >
              <RotateCcw /> Réviser d&apos;autres notions ({dusRestants})
            </Button>
          )}
          <Button onClick={continuer} size="lg" disabled={saving} className="mt-3 w-full">
            {mode === "revision" ? (
              "Terminer la révision"
            ) : prochaineFicheId ? (
              <>
                Fiche suivante <ArrowRight />
              </>
            ) : (
              "Voir mon parcours"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
