import { MODELS, runStructured } from "@/lib/anthropic";
import type { ParsedQuestion } from "@/lib/exam-parse";

// Étape 1 du pipeline — DÉCOUPE ADAPTATIVE + HIÉRARCHISATION (cahier §5.1).
// La partie la plus délicate : l'IA juge elle-même la granularité (s'appuyer sur la
// structure quand elle existe, regrouper/fractionner sinon) ET classe chaque section
// en essentiel / utile / secondaire. Signal #1 = les questions de l'examen.
//
// Pour éviter que le modèle ré-émette tout le texte (coûteux, risque de paraphrase),
// on lui fournit le cours en lignes NUMÉROTÉES et il renvoie des PLAGES (ligneDebut/
// ligneFin) ; on tranche le texte verbatim nous-mêmes.

export type SectionType = "notion" | "tableau" | "diathese" | "meta";
export type Importance = "essentiel" | "utile" | "secondaire";

export interface StructuredSection {
  titre: string;
  niveau: number;
  ordre: number;
  texte: string;
  type: SectionType;
  importance: Importance | null; // null pour les sections méta (hors étude)
  questionsCouvertes: number[]; // numéros de questions d'examen couvertes
}

interface RawSection {
  titre: string;
  niveau: number;
  type: SectionType;
  importance: Importance;
  ligneDebut: number;
  ligneFin: number;
  questionsCouvertes: number[];
}

const SYSTEM = `Tu es un pédagogue expert qui prépare un étudiant à réussir un examen (seuil 80 %).
On te donne le TEXTE D'UN COURS en lignes numérotées et les QUESTIONS de son examen.

Ta mission : découper le cours en sections logiques et hiérarchiser leur importance.

DÉCOUPE (universelle, sans règle figée) :
- Appuie-toi sur la structure réelle du document (titres, chapitres, gabarits répétés) quand elle existe.
- Quand un chapitre répète un même gabarit pour plusieurs entrées (ex. un oligoélément : carence, action, sources, supplémentation), fais UNE section par entrée — ce sont les unités à réviser une par une.
- Quand la structure manque, regroupe le texte en blocs thématiques cohérents.
- Écarte les parties MÉTA (guide de l'étudiant, échéances administratives, copyright, barème, table des matières) : type "meta".
- Les tableaux de synthèse (besoins, aliments riches, teneurs) : type "tableau". Les diathèses : type "diathese". Le reste : type "notion".

HIÉRARCHISATION (le plus important) — chaque section reçoit une importance :
- "essentiel" : ce qui tombe à l'examen ou est indispensable pour répondre aux questions. PRIORITÉ ABSOLUE aux sujets couverts par une question.
- "utile" : à connaître, soutient la compréhension, mais pas directement interrogé.
- "secondaire" : survolable, anecdotique, détails non testés.
Signaux, par ordre de poids : (1) les questions de l'examen, (2) les objectifs annoncés du cours, (3) la mise en avant dans le texte (titres, répétitions, tableaux, résumés).

ANCRAGE : pour chaque section, indique la plage de lignes (ligneDebut..ligneFin, bornes incluses, numéros tels qu'affichés) et la liste des numéros de questions d'examen qu'elle permet de répondre (vide si aucune).
Les plages doivent couvrir le cours sans chevauchement, dans l'ordre.`;

const SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      description: "Sections du cours, dans l'ordre d'apparition.",
      items: {
        type: "object",
        properties: {
          titre: { type: "string", description: "Titre court et explicite de la section." },
          niveau: {
            type: "integer",
            minimum: 1,
            maximum: 3,
            description: "1 = chapitre, 2 = sous-section, 3 = entrée.",
          },
          type: { type: "string", enum: ["notion", "tableau", "diathese", "meta"] },
          importance: { type: "string", enum: ["essentiel", "utile", "secondaire"] },
          ligneDebut: { type: "integer", description: "Première ligne (incluse)." },
          ligneFin: { type: "integer", description: "Dernière ligne (incluse)." },
          questionsCouvertes: {
            type: "array",
            items: { type: "integer" },
            description: "Numéros des questions d'examen auxquelles cette section répond.",
          },
        },
        required: [
          "titre",
          "niveau",
          "type",
          "importance",
          "ligneDebut",
          "ligneFin",
          "questionsCouvertes",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["sections"],
  additionalProperties: false,
} as const;

function formatQuestions(questions: ParsedQuestion[]): string {
  if (questions.length === 0) return "(aucune question d'examen détectée)";
  return questions
    .map((q) => {
      const opts = q.options.map((o) => `${o.key}) ${o.text}`).join("  ");
      return `Q${q.numero}. ${q.enonce}\n   ${opts}`;
    })
    .join("\n");
}

/**
 * Découpe + hiérarchise le cours via Opus. `courseText` doit être le texte DÉJÀ nettoyé
 * (stripBoilerplate). Retourne les sections avec leur texte verbatim tranché localement.
 */
export async function decouper(
  courseId: string,
  courseText: string,
  questions: ParsedQuestion[],
): Promise<StructuredSection[]> {
  const lines = courseText.split("\n");
  const numbered = lines.map((l, i) => `${String(i + 1).padStart(4, "0")}|${l}`).join("\n");

  const prompt = `QUESTIONS DE L'EXAMEN :
${formatQuestions(questions)}

COURS (lignes numérotées) :
${numbered}`;

  const { sections } = await runStructured<{ sections: RawSection[] }>({
    phase: "ingestion",
    courseId,
    model: MODELS.ingest,
    system: SYSTEM,
    prompt,
    toolName: "enregistrer_decoupage",
    toolDescription: "Enregistre le découpage et la hiérarchisation du cours.",
    schema: SCHEMA,
    maxTokens: 16000,
  });

  return sections
    .map((s) => normalize(s, lines))
    .filter((s): s is StructuredSection => s !== null)
    .sort((a, b) => a.ordre - b.ordre)
    .map((s, i) => ({ ...s, ordre: i })); // ré-indexe proprement
}

function normalize(s: RawSection, lines: string[]): StructuredSection | null {
  const total = lines.length;
  const debut = Math.max(1, Math.min(s.ligneDebut, total));
  const fin = Math.max(debut, Math.min(s.ligneFin, total));
  const texte = lines.slice(debut - 1, fin).join("\n").trim();

  const titre = s.titre.trim();
  if (!titre) return null;
  // Une section méta peut être vide de matière ; une section d'étude vide est ignorée.
  if (s.type !== "meta" && texte.length === 0) return null;

  return {
    titre: titre.length > 160 ? titre.slice(0, 157) + "…" : titre,
    niveau: Math.min(Math.max(s.niveau, 1), 3),
    ordre: debut, // tri provisoire par ligne de début, ré-indexé ensuite
    texte,
    type: s.type,
    importance: s.type === "meta" ? null : s.importance,
    questionsCouvertes: Array.isArray(s.questionsCouvertes) ? s.questionsCouvertes : [],
  };
}
