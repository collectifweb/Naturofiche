import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { extractPdf } from "@/lib/pdf";
import { sectionize } from "@/lib/sectioning";
import { parseExam } from "@/lib/exam-parse";
import { courseDir } from "@/lib/paths";
import { triggerIngestion } from "@/lib/ingest";

export const runtime = "nodejs";
export const maxDuration = 120;

async function fileToBuffer(file: File): Promise<Buffer> {
  return Buffer.from(await file.arrayBuffer());
}

function looksLikePdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export async function POST(req: NextRequest) {
  let courseId: string | null = null;
  try {
    const form = await req.formData();
    const coursPdf = form.get("coursPdf");
    const examenPdf = form.get("examenPdf");
    const delaiRaw = form.get("delaiJours");
    const titreRaw = (form.get("titre") as string | null)?.trim() || null;
    const codeRaw = (form.get("code") as string | null)?.trim() || null;

    if (!(coursPdf instanceof File) || coursPdf.size === 0) {
      return NextResponse.json({ error: "Le PDF du cours est requis." }, { status: 400 });
    }
    // Examen optionnel : certains cours l'incluent dans le PDF du cours.
    const hasExamen = examenPdf instanceof File && examenPdf.size > 0;
    if (!looksLikePdf(coursPdf) || (hasExamen && !looksLikePdf(examenPdf as File))) {
      return NextResponse.json({ error: "Les fichiers doivent être des PDF." }, { status: 400 });
    }
    const delaiJours = parseInt(String(delaiRaw ?? ""), 10);
    if (!Number.isInteger(delaiJours) || delaiJours < 1 || delaiJours > 365) {
      return NextResponse.json({ error: "Délai invalide (1 à 365 jours)." }, { status: 400 });
    }

    // Un seul cours actif à la fois : on désactive les précédents.
    await prisma.course.updateMany({ where: { actif: true }, data: { actif: false } });

    // Création initiale (statut extraction) pour obtenir un id.
    const titreInitial = titreRaw ?? deriveTitle(coursPdf.name);
    const course = await prisma.course.create({
      data: {
        title: titreInitial,
        code: codeRaw,
        delaiJours,
        statut: "extraction",
        cheminPdfCours: "",
        cheminPdfExamen: null,
        actif: true,
      },
    });
    courseId = course.id;

    // Sauvegarde des PDF sur le disque local.
    const dir = courseDir(course.id);
    await mkdir(dir, { recursive: true });
    const cheminPdfCours = path.join(dir, "cours.pdf");
    const coursBuffer = await fileToBuffer(coursPdf);
    await writeFile(cheminPdfCours, coursBuffer);

    let cheminPdfExamen: string | null = null;
    let examenBuffer: Buffer | null = null;
    if (hasExamen) {
      cheminPdfExamen = path.join(dir, "examen.pdf");
      examenBuffer = await fileToBuffer(examenPdf as File);
      await writeFile(cheminPdfExamen, examenBuffer);
    }

    // Extraction du texte : cours toujours, examen seulement si fourni.
    const coursExtraction = await extractPdf(coursBuffer);
    const examenExtraction = examenBuffer ? await extractPdf(examenBuffer) : null;

    // Découpage structurel provisoire (M1) + parsing QCM. Sans fichier d'examen
    // séparé, on cherche les questions DANS le PDF du cours (l'examen y est parfois
    // inclus) ; les exercices ouverts (sans A/B/C/D) sont naturellement ignorés.
    const drafts = sectionize(coursExtraction.text);
    const questions = parseExam((examenExtraction ?? coursExtraction).text);

    await prisma.$transaction([
      prisma.section.createMany({
        data: drafts.map((s) => ({
          courseId: course.id,
          titre: s.titre,
          niveau: s.niveau,
          ordre: s.ordre,
          texte: s.texte,
          type: s.type,
        })),
      }),
      prisma.question.createMany({
        data: questions.map((q) => ({
          courseId: course.id,
          type: "examen_officiel",
          enonce: q.enonce,
          options: JSON.stringify(q.options),
          statutValidation: "en_attente",
        })),
      }),
      prisma.course.update({
        where: { id: course.id },
        data: {
          cheminPdfCours,
          cheminPdfExamen,
          title: titreRaw ?? deriveTitle(coursPdf.name, coursExtraction.info),
          // Sections heuristiques + questions posées ; le pipeline IA (M2) prend le relais.
          statut: "ingestion",
        },
      }),
    ]);

    // Déclenche l'ingestion IA en tâche de fond (découpe adaptative, hiérarchisation,
    // déduction des réponses, fiches/quiz, vérification). La page cours suit la progression.
    await triggerIngestion(course.id);

    return NextResponse.json({
      courseId: course.id,
      sections: drafts.length,
      questions: questions.length,
      coursPages: coursExtraction.numPages,
      examenPages: examenExtraction?.numPages ?? null,
      examenSepare: hasExamen,
    });
  } catch (err) {
    console.error("[import] échec :", err);
    if (courseId) {
      await prisma.course.update({ where: { id: courseId }, data: { statut: "erreur" } }).catch(() => {});
    }
    return NextResponse.json(
      { error: "Échec de l'import. Vérifie que les PDF sont des fichiers texte valides." },
      { status: 500 },
    );
  }
}

function deriveTitle(filename: string, info?: Record<string, unknown> | null): string {
  const fromMeta = info && typeof info.Title === "string" ? info.Title.trim() : "";
  if (fromMeta && fromMeta.length >= 3 && !/^untitled/i.test(fromMeta)) return fromMeta;
  const base = filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  return base || "Cours sans titre";
}
