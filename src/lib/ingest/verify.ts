import { prisma } from "@/lib/prisma";
import { MODELS, runStructured } from "@/lib/anthropic";

// Étape 4 du pipeline — AGENT DE VÉRIFICATION (cahier §5.2, §8).
// Un modèle DISTINCT (Sonnet) sert de contre-regard : pour chaque question il valide
// qu'une SEULE bonne réponse est défendable et qu'elle est ANCRÉE dans une section.
// Verdict : valide (on garde) · corrige (on applique la correction du vérificateur) ·
// rejete (douteux : flaggé, exclu du quiz / examen blanc, sans bloquer le cours).

export interface VerifItem {
  id: string;
  type: string;
  enonce: string;
  options: { key: string; text: string }[];
  bonneReponse: string | null;
  justification: string | null;
  sectionTexte: string | null;
}

interface RawVerdict {
  index: number;
  verdict: "valide" | "corrige" | "rejete";
  bonneReponse?: "A" | "B" | "C" | "D";
  justification?: string;
  raison: string;
}

const BATCH = 12;

const SYSTEM = `Tu es un agent de vérification rigoureux et indépendant. Le corrigé officiel n'existe pas encore et la barre de réussite est à 80 % : ton contre-regard doit être sévère.

Pour CHAQUE question (QCM A/B/C/D), on te donne la bonne réponse PROPOSÉE, sa justification, et le texte de la section source. Vérifie :
1. UNICITÉ : une seule réponse est défendable (pas d'ambiguïté, pas deux réponses correctes).
2. ANCRAGE : la bonne réponse découle bien du texte de la section fourni (pas d'invention/hallucination).

Rends un verdict :
- "valide" : la réponse proposée est correcte et ancrée.
- "corrige" : la réponse proposée est fausse MAIS une autre option est clairement correcte → donne bonneReponse + justification corrigées.
- "rejete" : aucune réponse n'est défendable de façon unique et ancrée (question ambiguë, hors cours, ou inventée).
Donne toujours une raison courte.`;

const SCHEMA = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          verdict: { type: "string", enum: ["valide", "corrige", "rejete"] },
          bonneReponse: { type: "string", enum: ["A", "B", "C", "D"] },
          justification: { type: "string" },
          raison: { type: "string" },
        },
        required: ["index", "verdict", "raison"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdicts"],
  additionalProperties: false,
} as const;

function formatItem(item: VerifItem, i: number): string {
  const opts = item.options.map((o) => `${o.key}) ${o.text}`).join("\n   ");
  return `[#${i}] ${item.enonce}
   ${opts}
   → réponse proposée : ${item.bonneReponse ?? "(aucune)"}
   → justification : ${item.justification ?? "(aucune)"}
   → section source : ${item.sectionTexte ? item.sectionTexte.slice(0, 1500) : "(non ancrée)"}`;
}

/** Vérifie un lot de questions et applique les verdicts (statutValidation). */
export async function verifierQuestions(
  courseId: string,
  items: VerifItem[],
): Promise<{ valide: number; corrige: number; rejete: number }> {
  const tally = { valide: 0, corrige: 0, rejete: 0 };

  for (let start = 0; start < items.length; start += BATCH) {
    const lot = items.slice(start, start + BATCH);
    const prompt = "QUESTIONS À VÉRIFIER :\n\n" + lot.map(formatItem).join("\n\n");

    const { verdicts } = await runStructured<{ verdicts: RawVerdict[] }>({
      phase: "verification",
      courseId,
      model: MODELS.verify,
      system: SYSTEM,
      prompt,
      toolName: "enregistrer_verdicts",
      toolDescription: "Enregistre les verdicts de vérification.",
      schema: SCHEMA,
      maxTokens: 8000,
    });

    const byIndex = new Map<number, RawVerdict>();
    for (const v of verdicts) byIndex.set(v.index, v);

    for (let i = 0; i < lot.length; i++) {
      const item = lot[i];
      const v = byIndex.get(i);
      // Sans verdict exploitable, on flagge rejete (prudence : la barre est à 80 %).
      if (!v) {
        await mark(item.id, "rejete");
        tally.rejete++;
        continue;
      }
      if (v.verdict === "corrige" && v.bonneReponse) {
        await mark(item.id, "valide", v.bonneReponse, v.justification ?? item.justification);
        tally.corrige++;
      } else if (v.verdict === "valide") {
        await mark(item.id, "valide");
        tally.valide++;
      } else {
        await mark(item.id, "rejete");
        tally.rejete++;
      }
    }
  }

  return tally;
}

async function mark(
  id: string,
  statut: "valide" | "rejete",
  bonneReponse?: string,
  justification?: string | null,
): Promise<void> {
  await prisma.question.update({
    where: { id },
    data: {
      statutValidation: statut,
      ...(bonneReponse ? { bonneReponse } : {}),
      ...(justification !== undefined && justification !== null ? { justification } : {}),
    },
  });
}
