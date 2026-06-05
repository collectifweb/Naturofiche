import type { Section } from "@prisma/client";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, logUsage, MODELS, runStructured } from "@/lib/anthropic";

type QaSection = Pick<Section, "id" | "titre" | "texte" | "type" | "ordre">;

export type QaSource = "cours" | "exterieur" | "mixte";

export interface QaResponse {
  reponse: string;
  source: QaSource;
  sectionsCitees: number[];
}

export interface WebSource {
  title: string | null;
  url: string;
}

export interface QaWebResponse extends QaResponse {
  sourcesWeb: WebSource[];
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

function contexteSections(sections: QaSection[]): string {
  return sections.length > 0
    ? sections
        .map((s, index) => `#${index} — ${s.titre}\n${extrait(s.texte)}`)
        .join("\n\n---\n\n")
    : "Aucun extrait pertinent n'a ete retrouve dans le cours.";
}

function texteEtSources(
  content: Anthropic.Messages.ContentBlock[],
): { texte: string; sourcesWeb: WebSource[] } {
  const textes: string[] = [];
  const textesApresRecherche: string[] = [];
  const sources = new Map<string, WebSource>();
  let aVuRecherche = false;

  for (const block of content) {
    if (block.type === "web_search_tool_result") {
      aVuRecherche = true;
      continue;
    }
    if (block.type === "text") {
      textes.push(block.text);
      if (aVuRecherche) textesApresRecherche.push(block.text);
      for (const citation of block.citations ?? []) {
        if (citation.type === "web_search_result_location") {
          sources.set(citation.url, {
            title: citation.title,
            url: citation.url,
          });
        }
      }
    }
  }

  return {
    texte: (textesApresRecherche.length > 0 ? textesApresRecherche : textes).join("\n\n").trim(),
    sourcesWeb: Array.from(sources.values()),
  };
}

function sectionsCiteesDepuisTexte(texte: string, sections: QaSection[]): number[] {
  const citees = new Set<number>();
  for (let i = 0; i < sections.length; i++) {
    if (texte.includes(`#${i}`) || texte.includes(sections[i].titre)) {
      citees.add(i);
    }
  }
  return Array.from(citees.values());
}

async function createWebSearchMessage({
  model,
  system,
  prompt,
  maxTokens,
  messages,
}: {
  model: string;
  system: string;
  prompt: string;
  maxTokens: number;
  messages?: Anthropic.Messages.MessageParam[];
}) {
  const anthropic = getAnthropic();
  return anthropic.messages.create(
    {
      model,
      max_tokens: maxTokens,
      system,
      messages: messages ?? [{ role: "user", content: prompt }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 1,
          allowed_domains: [
            "ods.od.nih.gov",
            "medlineplus.gov",
            "nih.gov",
            "who.int",
            "canada.ca",
            "inspq.qc.ca",
            "has-sante.fr",
            "efsa.europa.eu",
            "msdmanuals.com",
            "mayoclinic.org",
          ],
        },
      ],
    },
    { timeout: 30_000 },
  );
}

export async function repondreQuestionAvecWeb(
  courseId: string,
  question: string,
  sections: QaSection[],
): Promise<QaWebResponse> {
  const model = MODELS.qa;
  const prompt = `Question de l'etudiant :\n${question}\n\nExtraits du cours retrouves :\n${contexteSections(
    sections,
  )}\n\nConsigne : utilise d'abord les extraits du cours. Utilise la recherche web seulement pour verifier ou completer ce qui n'est pas suffisamment couvert par le cours. Dans ta reponse, indique explicitement si l'information vient du cours, du web, ou des deux. Quand tu utilises un extrait du cours, mentionne son index (#0, #1, etc.).`;
  const system =
    "Tu es un tuteur d'etude. Reponds en francais de facon concise et utile. Priorite au cours fourni : ne contredis pas le cours pour la preparation d'examen sans le signaler. Avec la recherche web, cite uniquement des informations supportees par les resultats web. N'invente pas de source. Si la reponse combine cours et web, rends cette distinction explicite.";

  let res = await createWebSearchMessage({
    model,
    system,
    prompt,
    maxTokens: 1600,
  });

  if (res.stop_reason === "pause_turn") {
    res = await createWebSearchMessage({
      model,
      system,
      prompt,
      maxTokens: 1600,
      messages: [
        { role: "user", content: prompt },
        { role: "assistant", content: res.content },
      ],
    });
  }

  await logUsage(courseId, "qa", model, res.usage);

  const { texte, sourcesWeb } = texteEtSources(res.content);
  const sectionsCitees = sectionsCiteesDepuisTexte(texte, sections);
  const source: QaSource =
    sectionsCitees.length > 0 && sourcesWeb.length > 0
      ? "mixte"
      : sourcesWeb.length > 0
        ? "exterieur"
        : "cours";

  return {
    reponse: texte || "Je n'ai pas pu produire de réponse exploitable.",
    source,
    sectionsCitees,
    sourcesWeb,
  };
}
