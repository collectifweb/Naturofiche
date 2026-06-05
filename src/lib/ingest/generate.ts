import { prisma } from "@/lib/prisma";
import { MODELS, runStructured } from "@/lib/anthropic";

// Étape 3 du pipeline — GÉNÉRATION DU PARCOURS (cahier §5.1, §5.4, §5.7).
// 1) unités d'étude dérivées des sections essentiel/utile, réparties sur le délai
//    (essentiel d'abord) — le rythme non bloquant et le recalage sont M3 ;
// 2) une fiche de synthèse + un mini-quiz de vérification par unité (par lots) ;
// 3) un réservoir de questions d'examen blanc, construit à partir des fiches générées
//    (contexte compact, moins coûteux que de renvoyer tout le cours).

export interface SectionFull {
  id: string;
  titre: string;
  texte: string;
  type: string;
  importance: string | null;
  ordre: number;
}

interface UnitPlan {
  sectionId: string;
  titre: string;
  texte: string;
  jourCible: number;
  ordre: number;
}

interface RawFiche {
  index: number;
  contenuMarkdown: string;
  notionsCles: string[];
  quiz: RawQcm[];
}

interface RawQcm {
  enonce: string;
  options: { key: string; text: string }[];
  bonneReponse: "A" | "B" | "C" | "D";
  justification: string;
}

const BATCH = 4;

/**
 * Construit le plan d'unités d'étude : une unité par section essentiel/utile,
 * essentiel d'abord, réparties sur `delaiJours` (plafond strict).
 */
export function construireUnites(sections: SectionFull[], delaiJours: number): UnitPlan[] {
  const studiables = sections.filter(
    (s) => s.type !== "meta" && (s.importance === "essentiel" || s.importance === "utile"),
  );
  const poids = (imp: string | null) => (imp === "essentiel" ? 0 : 1);
  const ordered = [...studiables].sort(
    (a, b) => poids(a.importance) - poids(b.importance) || a.ordre - b.ordre,
  );

  const total = ordered.length;
  const jours = Math.max(1, delaiJours);
  const parJour = Math.max(1, Math.ceil(total / jours));

  return ordered.map((s, i) => ({
    sectionId: s.id,
    titre: s.titre,
    texte: s.texte,
    jourCible: Math.min(Math.floor(i / parJour) + 1, jours),
    ordre: i,
  }));
}

const FICHE_SYSTEM = `Tu es un professeur particulier qui rédige des fiches de révision pour réussir un examen (seuil 80 %). Philosophie : l'essentiel pour réussir, pas l'exhaustivité.

Pour chaque section fournie, produis :
- contenuMarkdown : une fiche de synthèse en Markdown, hiérarchisée, qui met en avant les notions importantes (titres, listes, gras). Va à l'essentiel ; signale ce qui est secondaire comme « à survoler » plutôt que de l'imposer. Reste fidèle au cours, n'invente rien.
- notionsCles : 3 à 6 notions-clés (mots ou expressions courts).
- quiz : 2 QCM de vérification dans le style de l'examen (4 options A/B/C/D, une seule bonne réponse), avec la bonne réponse et une justification courte ancrée dans la section.`;

const FICHE_SCHEMA = {
  type: "object",
  properties: {
    fiches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer", description: "Index de l'unité (tel que fourni)." },
          contenuMarkdown: { type: "string" },
          notionsCles: { type: "array", items: { type: "string" } },
          quiz: {
            type: "array",
            items: qcmSchema(),
          },
        },
        required: ["index", "contenuMarkdown", "notionsCles", "quiz"],
        additionalProperties: false,
      },
    },
  },
  required: ["fiches"],
  additionalProperties: false,
} as const;

function qcmSchema() {
  return {
    type: "object",
    properties: {
      enonce: { type: "string" },
      options: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", enum: ["A", "B", "C", "D"] },
            text: { type: "string" },
          },
          required: ["key", "text"],
          additionalProperties: false,
        },
      },
      bonneReponse: { type: "string", enum: ["A", "B", "C", "D"] },
      justification: { type: "string" },
    },
    required: ["enonce", "options", "bonneReponse", "justification"],
    additionalProperties: false,
  } as const;
}

/** Crée les unités, fiches et mini-quiz, puis le réservoir d'examen blanc. Persiste tout. */
export async function genererParcours(
  courseId: string,
  sections: SectionFull[],
  delaiJours: number,
  exemples: { enonce: string; options: { key: string; text: string }[] }[],
): Promise<{ unites: number; fiches: number; quiz: number; examenBlanc: number }> {
  const plans = construireUnites(sections, delaiJours);
  if (plans.length === 0) {
    return { unites: 0, fiches: 0, quiz: 0, examenBlanc: 0 };
  }

  // 1) Persiste les unités d'étude (ids nécessaires pour fiches/quiz).
  const units: { id: string; plan: UnitPlan }[] = [];
  for (const plan of plans) {
    const u = await prisma.studyUnit.create({
      data: {
        courseId,
        ordre: plan.ordre,
        jourCible: plan.jourCible,
        titre: plan.titre,
        sectionsLiees: JSON.stringify([plan.sectionId]),
        progress: { create: {} },
      },
    });
    units.push({ id: u.id, plan });
  }

  // 2) Fiches + mini-quiz, par lots.
  let fiches = 0;
  let quiz = 0;
  const fichesPourBlanc: { titre: string; markdown: string; sectionId: string }[] = [];

  for (let start = 0; start < units.length; start += BATCH) {
    const lot = units.slice(start, start + BATCH);
    const prompt =
      "SECTIONS À FICHER :\n\n" +
      lot
        .map((u, i) => `[#${i}] ${u.plan.titre}\n${u.plan.texte}`)
        .join("\n\n———\n\n");

    const { fiches: gen } = await runStructured<{ fiches: RawFiche[] }>({
      phase: "ingestion",
      courseId,
      model: MODELS.ingest,
      system: FICHE_SYSTEM,
      prompt,
      toolName: "enregistrer_fiches",
      toolDescription: "Enregistre les fiches de synthèse et leurs mini-quiz.",
      schema: FICHE_SCHEMA,
      maxTokens: 16000,
    });

    const byIndex = new Map<number, RawFiche>();
    for (const f of gen) byIndex.set(f.index, f);

    for (let i = 0; i < lot.length; i++) {
      const f = byIndex.get(i);
      if (!f) continue;
      const u = lot[i];

      await prisma.fiche.create({
        data: {
          studyUnitId: u.id,
          contenuMarkdown: f.contenuMarkdown,
          notionsCles: JSON.stringify(f.notionsCles ?? []),
        },
      });
      fiches++;
      fichesPourBlanc.push({
        titre: u.plan.titre,
        markdown: f.contenuMarkdown,
        sectionId: u.plan.sectionId,
      });

      for (const qcm of f.quiz ?? []) {
        if (!validQcm(qcm)) continue;
        await prisma.question.create({
          data: {
            courseId,
            type: "quiz_verif",
            enonce: qcm.enonce,
            options: JSON.stringify(qcm.options),
            bonneReponse: qcm.bonneReponse,
            justification: qcm.justification,
            sectionSourceId: u.plan.sectionId,
            studyUnitId: u.id,
            statutValidation: "en_attente",
          },
        });
        quiz++;
      }
    }
  }

  // 3) Réservoir d'examen blanc à partir des fiches générées.
  const examenBlanc = await genererExamenBlanc(courseId, fichesPourBlanc, exemples);

  return { unites: units.length, fiches, quiz, examenBlanc };
}

const BLANC_SYSTEM = `Tu génères un examen blanc dans le style de l'examen officiel d'un cours. On te donne les FICHES de révision (le périmètre étudiable) et quelques questions officielles comme RÉFÉRENCE DE STYLE.

Produis ~20 QCM (4 options A/B/C/D, une seule bonne réponse) qui couvrent les notions importantes des fiches, avec pour chacune la bonne réponse, une justification courte et l'index de la fiche source. Ne recopie pas les questions de référence ; reste fidèle aux fiches, n'invente rien hors périmètre.`;

const BLANC_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          enonce: { type: "string" },
          options: qcmSchema().properties.options,
          bonneReponse: { type: "string", enum: ["A", "B", "C", "D"] },
          justification: { type: "string" },
          ficheIndex: { type: "integer", description: "Index de la fiche source." },
        },
        required: ["enonce", "options", "bonneReponse", "justification", "ficheIndex"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

async function genererExamenBlanc(
  courseId: string,
  fiches: { titre: string; markdown: string; sectionId: string }[],
  exemples: { enonce: string; options: { key: string; text: string }[] }[],
): Promise<number> {
  if (fiches.length === 0) return 0;

  const ref =
    exemples.length > 0
      ? exemples
          .slice(0, 4)
          .map(
            (q) =>
              `- ${q.enonce}\n  ${q.options.map((o) => `${o.key}) ${o.text}`).join("  ")}`,
          )
          .join("\n")
      : "(aucune)";

  const prompt = `FICHES (périmètre étudiable) :
${fiches.map((f, i) => `[#${i}] ${f.titre}\n${f.markdown}`).join("\n\n———\n\n")}

QUESTIONS OFFICIELLES (référence de style, ne pas recopier) :
${ref}`;

  const { questions } = await runStructured<{
    questions: (RawQcm & { ficheIndex: number })[];
  }>({
    phase: "ingestion",
    courseId,
    model: MODELS.ingest,
    system: BLANC_SYSTEM,
    prompt,
    toolName: "enregistrer_examen_blanc",
    toolDescription: "Enregistre les questions de l'examen blanc.",
    schema: BLANC_SCHEMA,
    maxTokens: 16000,
  });

  let n = 0;
  for (const q of questions) {
    if (!validQcm(q)) continue;
    const fiche = q.ficheIndex >= 0 && q.ficheIndex < fiches.length ? fiches[q.ficheIndex] : null;
    await prisma.question.create({
      data: {
        courseId,
        type: "examen_blanc",
        enonce: q.enonce,
        options: JSON.stringify(q.options),
        bonneReponse: q.bonneReponse,
        justification: q.justification,
        sectionSourceId: fiche?.sectionId ?? null,
        statutValidation: "en_attente",
      },
    });
    n++;
  }
  return n;
}

function validQcm(q: RawQcm): boolean {
  return (
    !!q.enonce &&
    Array.isArray(q.options) &&
    q.options.length >= 2 &&
    ["A", "B", "C", "D"].includes(q.bonneReponse)
  );
}
