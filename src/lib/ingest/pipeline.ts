import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { MODELS } from "@/lib/anthropic";
import { extractPdf } from "@/lib/pdf";
import { stripBoilerplate } from "@/lib/sectioning";
import { parseExam, type ParsedQuestion } from "@/lib/exam-parse";
import { setProgress, ETAPES } from "./progress";
import { decouper } from "./structure";
import { deduireReponses } from "./answers";
import { genererParcours } from "./generate";
import { verifierQuestions } from "./verify";

// Orchestrateur du pipeline d'ingestion IA (M2). Tourne UNE fois par cours, en tâche
// de fond (le serveur est un process Node permanent → la promesse survit à la réponse
// HTTP). Idempotent : on purge les artefacts M2 et on ré-extrait depuis le PDF disque.

/** (Re)lance l'ingestion complète d'un cours. Ne jette pas : journalise l'erreur dans Course. */
export async function runIngestion(courseId: string): Promise<void> {
  try {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new Error("Cours introuvable.");
    if (!course.cheminPdfCours) throw new Error("PDF du cours manquant.");

    await setProgress(courseId, {
      statut: "ingestion",
      etape: ETAPES.decoupage.label,
      pct: 5,
      erreurMessage: null,
    });

    // 1) Ré-extraction du texte depuis le disque (self-contained / re-runnable).
    const coursText = (await extractPdf(await readFile(course.cheminPdfCours))).text;
    const examenText = course.cheminPdfExamen
      ? (await extractPdf(await readFile(course.cheminPdfExamen))).text
      : coursText;
    const cleaned = stripBoilerplate(coursText);

    // 2) Purge des artefacts M2 d'un éventuel run précédent (conserve examen_officiel).
    await purge(courseId);

    // 3) Questions d'examen : on réutilise les rangs examen_officiel (créés à l'import),
    //    sinon on les (re)crée depuis le PDF.
    let dbQuestions = await prisma.question.findMany({
      where: { courseId, type: "examen_officiel" },
      orderBy: { id: "asc" },
    });
    if (dbQuestions.length === 0) {
      const parsed = parseExam(examenText);
      if (parsed.length > 0) {
        await prisma.question.createMany({
          data: parsed.map((q) => ({
            courseId,
            type: "examen_officiel",
            enonce: q.enonce,
            options: JSON.stringify(q.options),
            statutValidation: "en_attente",
          })),
        });
        dbQuestions = await prisma.question.findMany({
          where: { courseId, type: "examen_officiel" },
          orderBy: { id: "asc" },
        });
      }
    }
    const questionRefs = dbQuestions.map((q) => ({
      id: q.id,
      enonce: q.enonce,
      options: parseOptions(q.options),
    }));
    const parsedForStructure: ParsedQuestion[] = questionRefs.map((q, i) => ({
      numero: i + 1,
      enonce: q.enonce,
      options: q.options,
    }));

    // 4) Étape 1 — Découpe & hiérarchisation (remplace les sections heuristiques).
    const structured = await decouper(courseId, cleaned, parsedForStructure);
    await prisma.section.createMany({
      data: structured.map((s) => ({
        courseId,
        titre: s.titre,
        niveau: s.niveau,
        ordre: s.ordre,
        texte: s.texte,
        type: s.type,
        importance: s.importance,
      })),
    });
    const sections = await prisma.section.findMany({
      where: { courseId },
      orderBy: { ordre: "asc" },
    });

    // 5) Étape 2 — Déduction des réponses ancrées.
    await setProgress(courseId, { etape: ETAPES.reponses.label, pct: ETAPES.reponses.pct });
    const reponses = await deduireReponses(
      courseId,
      sections.map((s) => ({ id: s.id, titre: s.titre, texte: s.texte, type: s.type })),
      questionRefs,
    );
    for (const r of reponses) {
      await prisma.question.update({
        where: { id: r.questionId },
        data: {
          bonneReponse: r.bonneReponse,
          justification: r.justification,
          sectionSourceId: r.sectionId,
          statutValidation: "en_attente",
        },
      });
    }

    // 6) Étape 3 — Fiches + mini-quiz + réservoir examen blanc.
    await setProgress(courseId, { etape: ETAPES.generation.label, pct: ETAPES.generation.pct });
    await genererParcours(
      courseId,
      sections.map((s) => ({
        id: s.id,
        titre: s.titre,
        texte: s.texte,
        type: s.type,
        importance: s.importance,
        ordre: s.ordre,
      })),
      course.delaiJours,
      questionRefs.slice(0, 4).map((q) => ({ enonce: q.enonce, options: q.options })),
    );

    // 7) Étape 4 — Vérification (modèle distinct). On ne vérifie que les questions ayant
    //    une bonne réponse à contrôler.
    await setProgress(courseId, {
      statut: "verification",
      etape: ETAPES.verification.label,
      pct: ETAPES.verification.pct,
    });
    const toVerify = await prisma.question.findMany({
      where: { courseId, bonneReponse: { not: null } },
      include: { sectionSource: true },
    });
    await verifierQuestions(
      courseId,
      toVerify.map((q) => ({
        id: q.id,
        type: q.type,
        enonce: q.enonce,
        options: parseOptions(q.options),
        bonneReponse: q.bonneReponse,
        justification: q.justification,
        sectionTexte: q.sectionSource?.texte ?? null,
      })),
    );

    // 8) Prêt.
    await prisma.course.update({ where: { id: courseId }, data: { ingestModel: MODELS.ingest } });
    await setProgress(courseId, {
      statut: "pret",
      etape: ETAPES.pret.label,
      pct: 100,
      erreurMessage: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ingestion] échec :", err);
    await setProgress(courseId, { statut: "erreur", erreurMessage: message }).catch(() => {});
  }
}

/** Supprime les artefacts M2 (sections, unités, fiches, quiz/blanc) et réinitialise
 *  les réponses des questions d'examen officiel. Conserve les rangs examen_officiel. */
async function purge(courseId: string): Promise<void> {
  await prisma.$transaction([
    prisma.studyUnit.deleteMany({ where: { courseId } }), // cascade Fiche + Progress
    prisma.question.deleteMany({
      where: { courseId, type: { in: ["quiz_verif", "examen_blanc"] } },
    }),
    prisma.section.deleteMany({ where: { courseId } }), // SetNull sur examen_officiel.sectionSource
    prisma.question.updateMany({
      where: { courseId, type: "examen_officiel" },
      data: {
        bonneReponse: null,
        justification: null,
        sectionSourceId: null,
        statutValidation: "en_attente",
      },
    }),
  ]);
}

function parseOptions(json: string): { key: string; text: string }[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
