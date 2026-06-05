"use client";

import { FormEvent, useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, type ChipVariant } from "@/components/ui/chip";

type Source = "cours" | "exterieur" | "mixte";
type QaMode = "cours" | "cours_web";

interface QaResult {
  reponse: string;
  source: Source;
  sections: { id: string; titre: string }[];
  sourcesWeb: { title: string | null; url: string }[];
  mode: QaMode;
}

interface Message {
  id: string;
  question: string;
  result: QaResult;
}

interface QaPanelProps {
  courseId: string;
  compact?: boolean;
  placeholder?: string;
  emptyText?: string;
}

const SOURCE_LABEL: Record<Source, string> = {
  cours: "cours",
  exterieur: "complément extérieur",
  mixte: "cours + extérieur",
};

const SOURCE_VARIANT: Record<Source, ChipVariant> = {
  cours: "essentiel",
  exterieur: "secondaire",
  mixte: "utile",
};

export function QaPanel({
  courseId,
  compact = false,
  placeholder = "Quels sont les signes de carence en zinc ?",
  emptyText = "Les réponses citeront leur origine : cours, extérieur, ou un mélange des deux.",
}: QaPanelProps) {
  const questionId = useId();
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<QaMode>("cours");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = question.trim();
    if (clean.length < 3) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/course/${courseId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: clean, mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Échec de la question.");
      setMessages((current) => [
        {
          id: crypto.randomUUID(),
          question: clean,
          result: json as QaResult,
        },
        ...current,
      ]);
      setQuestion("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la question.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <form
        onSubmit={submit}
        className={
          compact
            ? "space-y-3 rounded-[var(--radius)] bg-card p-3 ring-1 ring-foreground/10"
            : "space-y-3 rounded-[var(--radius)] bg-card p-4 ring-1 ring-foreground/10"
        }
      >
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(
            [
              ["cours", "Cours seulement"],
              ["cours_web", "Cours + web"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={
                mode === value
                  ? "rounded-md bg-background px-2 py-1.5 text-[0.8125rem] font-medium text-foreground ring-1 ring-border"
                  : "rounded-md px-2 py-1.5 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {label}
            </button>
          ))}
        </div>
        <label htmlFor={questionId} className="text-[0.8125rem] font-medium text-muted-foreground">
          Question
        </label>
        <textarea
          id={questionId}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={compact ? 3 : 4}
          placeholder={placeholder}
          className={
            compact
              ? "min-h-24 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-base leading-relaxed outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30"
              : "min-h-28 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-base leading-relaxed outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30"
          }
        />
        <Button type="submit" size="lg" disabled={loading || question.trim().length < 3} className="w-full">
          {loading ? "Question en cours…" : "Demander"} <Send />
        </Button>
        {mode === "cours_web" && (
          <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
            Le mode web cherche en ligne et peut coûter plus cher. Utilise-le pour vérifier ou
            compléter le cours, pas pour remplacer la réponse attendue à l&apos;examen.
          </p>
        )}
      </form>

      {messages.length === 0 ? (
        <div
          className={
            compact
              ? "rounded-[var(--radius)] bg-card/70 p-3 ring-1 ring-foreground/10"
              : "rounded-[var(--radius)] bg-card/70 p-5 ring-1 ring-foreground/10"
          }
        >
          <p className="text-sm text-muted-foreground">
            {emptyText}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <article key={message.id} className="space-y-3 rounded-[var(--radius)] bg-card p-4 ring-1 ring-foreground/10">
              <div className="space-y-1">
                <p className="text-[0.8125rem] text-muted-foreground">Question</p>
                <p className="text-[0.95rem] font-medium break-words">{message.question}</p>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip variant={SOURCE_VARIANT[message.result.source]}>
                    Source : {SOURCE_LABEL[message.result.source]}
                  </Chip>
                  {message.result.sections.length > 0 && (
                    <span className="text-[0.8125rem] text-muted-foreground">
                      {message.result.sections.length} section
                      {message.result.sections.length > 1 ? "s" : ""} citée
                      {message.result.sections.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="fiche-prose max-w-none text-[0.98rem]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.result.reponse}</ReactMarkdown>
                </div>
                {message.result.sections.length > 0 && (
                  <ul className="space-y-1 text-[0.8125rem] text-muted-foreground">
                    {message.result.sections.map((section) => (
                      <li key={section.id}>Source cours : {section.titre}</li>
                    ))}
                  </ul>
                )}
                {message.result.sourcesWeb.length > 0 && (
                  <ul className="space-y-1 text-[0.8125rem] text-muted-foreground">
                    {message.result.sourcesWeb.map((source) => (
                      <li key={source.url}>
                        Source web :{" "}
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {source.title ?? source.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
