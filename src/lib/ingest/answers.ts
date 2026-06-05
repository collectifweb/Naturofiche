import { MODELS, runStructured } from "@/lib/anthropic";

// Étape 2 du pipeline — DÉDUCTION DES BONNES RÉPONSES (cahier §5.1).
// Pour chaque question d'examen, l'IA déduit l'unique bonne réponse et la JUSTIFIE
// en s'ancrant dans une section précise du cours (le corrigé n'existe pas avant la
// remise → traçabilité systématique). On indexe sections et questions pour remapper
// proprement vers les ids DB sans matching textuel fragile.

export interface SectionRef {
  id: string;
  titre: string;
  texte: string;
  type: string;
}

export interface QuestionRef {
  id: string;
  enonce: string;
  options: { key: string; text: string }[];
}

export interface ReponseDeduite {
  questionId: string;
  bonneReponse: "A" | "B" | "C" | "D" | null;
  justification: string;
  sectionId: string | null;
}

interface RawReponse {
  index: number;
  bonneReponse: "A" | "B" | "C" | "D";
  justification: string;
  sectionIndex: number; // -1 si non ancrable
}

const SYSTEM = `Tu es un correcteur rigoureux. On te donne les SECTIONS d'un cours (indexées) et les QUESTIONS de son examen (QCM A/B/C/D, indexées).

Pour CHAQUE question :
- Détermine l'UNIQUE bonne réponse, défendable à partir du cours.
- Justifie en une à trois phrases ANCRÉES dans le contenu du cours (cite l'idée, pas une invention).
- Indique l'index de la section qui justifie le mieux la réponse (sectionIndex), ou -1 si vraiment aucune.

N'invente jamais une réponse hors du cours. Si le cours ne tranche pas clairement, choisis la réponse la plus défendable et dis-le dans la justification.`;

const SCHEMA = {
  type: "object",
  properties: {
    reponses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer", description: "Index de la question (tel que fourni)." },
          bonneReponse: { type: "string", enum: ["A", "B", "C", "D"] },
          justification: { type: "string" },
          sectionIndex: {
            type: "integer",
            description: "Index de la section qui ancre la réponse, ou -1.",
          },
        },
        required: ["index", "bonneReponse", "justification", "sectionIndex"],
        additionalProperties: false,
      },
    },
  },
  required: ["reponses"],
  additionalProperties: false,
} as const;

function formatSections(sections: SectionRef[]): string {
  return sections
    .map((s, i) => `[#${i}] (${s.type}) ${s.titre}\n${s.texte}`)
    .join("\n\n———\n\n");
}

function formatQuestions(questions: QuestionRef[]): string {
  return questions
    .map((q, i) => {
      const opts = q.options.map((o) => `${o.key}) ${o.text}`).join("\n   ");
      return `[#${i}] ${q.enonce}\n   ${opts}`;
    })
    .join("\n\n");
}

/** Déduit la bonne réponse + justification ancrée pour chaque question fournie. */
export async function deduireReponses(
  courseId: string,
  sections: SectionRef[],
  questions: QuestionRef[],
): Promise<ReponseDeduite[]> {
  if (questions.length === 0) return [];

  const prompt = `SECTIONS DU COURS :
${formatSections(sections)}

═══════════════════════════════════════

QUESTIONS DE L'EXAMEN :
${formatQuestions(questions)}`;

  const { reponses } = await runStructured<{ reponses: RawReponse[] }>({
    phase: "ingestion",
    courseId,
    model: MODELS.ingest,
    system: SYSTEM,
    prompt,
    toolName: "enregistrer_reponses",
    toolDescription: "Enregistre les bonnes réponses déduites et leur ancrage.",
    schema: SCHEMA,
    maxTokens: 12000,
  });

  const byIndex = new Map<number, RawReponse>();
  for (const r of reponses) byIndex.set(r.index, r);

  return questions.map((q, i) => {
    const r = byIndex.get(i);
    const sectionId =
      r && r.sectionIndex >= 0 && r.sectionIndex < sections.length
        ? sections[r.sectionIndex].id
        : null;
    return {
      questionId: q.id,
      bonneReponse: r?.bonneReponse ?? null,
      justification: r?.justification ?? "",
      sectionId,
    };
  });
}
