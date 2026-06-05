import type { Section } from "@prisma/client";
import { MODELS, runStructured } from "@/lib/anthropic";

type QaSection = Pick<Section, "id" | "titre" | "texte" | "type" | "ordre">;

export type QaSource = "cours" | "exterieur" | "mixte";

export interface QaResponse {
  reponse: string;
  source: QaSource;
  sectionsCitees: number[];
}

const STOPWORDS = new Set([
  "avec",
  "aux",
  "ces",
  "dans",
  "des",
  "donc",
  "elle",
  "elles",
  "est",
  "les",
  "leur",
  "leurs",
  "mais",
  "par",
  "pas",
  "plus",
  "pour",
  "que",
  "qui",
  "quoi",
  "sont",
  "sur",
  "une",
  "vos",
]);

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function tokens(texte: string): string[] {
  return normaliser(texte)
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function compter(tokensQuestion: Set<string>, texte: string): number {
  let score = 0;
  for (const token of tokens(texte)) {
    if (tokensQuestion.has(token)) score++;
  }
  return score;
}

/**
 * Retrieval lexical simple : score = recouvrement titre x3 + texte x1.
 * Suffisant pour la cible mono-utilisateur SQLite, sans embeddings.
 */
export function rechercherSections(
  question: string,
  sections: QaSection[],
  topN = 4,
): QaSection[] {
  const termes = new Set(tokens(question));
  if (termes.size === 0) return [];

  return sections
    .filter((s) => s.type !== "meta")
    .map((section) => ({
      section,
      score: compter(termes, section.titre) * 3 + compter(termes, section.texte),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.section.ordre - b.section.ordre)
    .slice(0, topN)
    .map((item) => item.section);
}

const QA_SCHEMA = {
  type: "object",
  properties: {
    reponse: { type: "string" },
    source: { type: "string", enum: ["cours", "exterieur", "mixte"] },
    sectionsCitees: {
      type: "array",
      items: { type: "integer", minimum: 0 },
    },
  },
  required: ["reponse", "source", "sectionsCitees"],
  additionalProperties: false,
} as const;

function extrait(texte: string, max = 1500): string {
  const clean = texte.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

export async function repondreQuestion(
  courseId: string,
  question: string,
  sections: QaSection[],
): Promise<QaResponse> {
  const contexte =
    sections.length > 0
      ? sections
          .map((s, index) => `#${index} — ${s.titre}\n${extrait(s.texte)}`)
          .join("\n\n---\n\n")
      : "Aucun extrait pertinent n'a ete retrouve dans le cours.";

  return runStructured<QaResponse>({
    phase: "qa",
    courseId,
    model: MODELS.qa,
    system:
      "Reponds a l'etudiant en t'appuyant D'ABORD sur les extraits du cours fournis. Si l'info n'y est pas, complete avec tes connaissances et marque la source en consequence. N'invente pas d'ancrage : source=cours seulement si la reponse vient des extraits. source=mixte si tu combines cours et connaissances externes. Reponds en francais, clairement et sans inventer de citation.",
    prompt: `Question de l'etudiant :\n${question}\n\nExtraits du cours :\n${contexte}`,
    toolName: "reponse_question_cours",
    toolDescription: "Reponse sourcee a une question d'etude.",
    schema: QA_SCHEMA,
    maxTokens: 1200,
  });
}
