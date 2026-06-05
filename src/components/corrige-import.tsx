"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseCorrige, type ReponseCorrigee } from "@/lib/corrige";
import { cn } from "@/lib/utils";

export interface CorrigeQuestionMini {
  numero: number;
  enonce: string;
  bonneReponseIA: string | null;
}

export function CorrigeImport({
  courseId,
  questions,
}: {
  courseId: string;
  questions: CorrigeQuestionMini[];
}) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [reponses, setReponses] = useState<ReponseCorrigee[]>([]);
  const [parsed, setParsed] = useState(false);
  const [saving, setSaving] = useState(false);

  const byNumero = useMemo(() => new Map(reponses.map((r) => [r.numero, r])), [reponses]);
  const ecarts = questions.filter((q) => {
    const officielle = byNumero.get(q.numero);
    return officielle && officielle.reponse !== q.bonneReponseIA;
  });
  const complet =
    questions.length > 0 &&
    reponses.length === questions.length &&
    questions.every((q) => byNumero.has(q.numero));

  function analyser() {
    const parsedReponses = parseCorrige(texte);
    setReponses(parsedReponses);
    setParsed(true);
    if (parsedReponses.length === 0) {
      toast.error("Aucune réponse A-D reconnue.");
    } else if (parsedReponses.length !== questions.length) {
      toast.warning(`${questions.length} réponses attendues, ${parsedReponses.length} reconnues.`);
    } else {
      toast.success(`${parsedReponses.length} réponses reconnues.`);
    }
  }

  async function appliquer() {
    if (!complet) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/course/${courseId}/corrige`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reponses }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Échec de l'import du corrigé.");
      toast.success(`${json.total} réponses importées, ${json.ecarts} écart(s) corrigé(s).`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'import du corrigé.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-[var(--radius)] bg-card p-4 ring-1 ring-foreground/10">
        <label htmlFor="corrige" className="text-[0.8125rem] font-medium text-muted-foreground">
          Corrigé officiel
        </label>
        <textarea
          id="corrige"
          value={texte}
          onChange={(event) => setTexte(event.target.value)}
          rows={8}
          placeholder={"1. A\n2. C\n3. D\n...\n20. B"}
          className="min-h-48 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-base leading-relaxed outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30"
        />
        <Button type="button" variant="outline" size="lg" onClick={analyser} className="w-full">
          <ClipboardCheck /> Analyser
        </Button>
      </div>

      {parsed && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.8125rem] text-muted-foreground">
              {reponses.length} / {questions.length} réponses reconnues · {ecarts.length} écart
              {ecarts.length > 1 ? "s" : ""}
            </p>
            <Button type="button" size="sm" onClick={appliquer} disabled={!complet || saving}>
              {saving ? "Application…" : "Appliquer le corrigé"}
            </Button>
          </div>

          <div className="overflow-hidden rounded-[var(--radius)] bg-card ring-1 ring-foreground/10">
            <div className="grid grid-cols-[3rem_1fr_4.5rem_5rem] gap-2 border-b border-border px-3 py-2 text-[0.75rem] font-medium text-muted-foreground">
              <span>No</span>
              <span>Question</span>
              <span>IA</span>
              <span>Officiel</span>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              {questions.map((q) => {
                const officielle = byNumero.get(q.numero);
                const ecart = officielle && officielle.reponse !== q.bonneReponseIA;
                return (
                  <div
                    key={q.numero}
                    className={cn(
                      "grid grid-cols-[3rem_1fr_4.5rem_5rem] gap-2 border-b border-border/70 px-3 py-2 text-sm last:border-b-0",
                      ecart ? "bg-brick-wash/55" : "bg-card",
                    )}
                  >
                    <span className="font-mono text-muted-foreground">{q.numero}</span>
                    <span className="min-w-0 truncate">{q.enonce}</span>
                    <span className="font-mono">{q.bonneReponseIA ?? "?"}</span>
                    <span className="font-mono">{officielle?.reponse ?? "?"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
