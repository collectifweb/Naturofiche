"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ExamQuestion {
  id: string;
  enonce: string;
  options: { key: string; text: string }[];
  bonneReponse: string;
  justification: string | null;
  sourceTitre: string | null;
}

const SEUIL = 80; // % de réussite (cahier §5.7)

// Examen blanc noté (cahier §5.7) : on répond à TOUTES les questions, puis on note
// d'un coup — score /100 et /20, réussite/échec au seuil 80 %, correction par question
// avec renvoi à la section source. Distinct du mini-quiz (correction immédiate).
export function ExamRunner({
  questions,
}: {
  questions: ExamQuestion[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const total = questions.length;
  const tousRepondu = questions.every((q) => answers[q.id]);
  const bons = useMemo(
    () => questions.filter((q) => answers[q.id] === q.bonneReponse).length,
    [answers, questions],
  );
  const score100 = total > 0 ? Math.round((bons / total) * 100) : 0;
  const score20 = total > 0 ? Math.round((bons / total) * 20) : 0;
  const reussi = score100 >= SEUIL;

  function recommencer() {
    setAnswers({});
    setSubmitted(false);
    router.refresh(); // nouveau tirage de 20 questions côté serveur
  }

  return (
    <div className="space-y-4">
      {submitted && (
        <div
          className={cn(
            "rounded-[var(--radius)] p-5 ring-1",
            reussi
              ? "bg-green-wash text-green-ink ring-green-ink/20"
              : "bg-brick-wash text-destructive ring-destructive/20",
          )}
        >
          <div className="flex items-center gap-2">
            {reussi ? (
              <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            ) : (
              <XCircle className="size-5 shrink-0" aria-hidden />
            )}
            <p className="text-[0.95rem] font-semibold">
              {reussi ? "Réussite" : "Échec"} — seuil {SEUIL} %
            </p>
          </div>
          <p className="mt-1.5 text-sm">
            <span className="font-semibold">{bons}</span> / {total} bonnes réponses ·{" "}
            <span className="font-semibold">{score100}</span> / 100 ·{" "}
            <span className="font-semibold">{score20}</span> / 20
          </p>
        </div>
      )}

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
                if (submitted) {
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
                      disabled={submitted}
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
            {submitted && (
              <div className="mt-3 space-y-1">
                {q.justification && (
                  <p className="font-serif text-[0.875rem] leading-relaxed text-muted-foreground">
                    {q.justification}
                  </p>
                )}
                {q.sourceTitre && (
                  <p className="text-xs text-muted-foreground">Source : {q.sourceTitre}</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!submitted ? (
        <Button
          onClick={() => setSubmitted(true)}
          size="lg"
          disabled={!tousRepondu}
          className="w-full"
        >
          {tousRepondu
            ? "Terminer l'examen"
            : `Réponds aux ${total} questions (${Object.keys(answers).length}/${total})`}
        </Button>
      ) : (
        <Button onClick={recommencer} variant="outline" size="lg" className="w-full">
          <RotateCcw /> Recommencer
        </Button>
      )}
    </div>
  );
}
