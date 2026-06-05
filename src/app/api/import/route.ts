import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { extractPdf } from "@/lib/pdf";
import { sectionize } from "@/lib/sectioning";
import { parseExam } from "@/lib/exam-parse";
import { courseDir } from "@/lib/paths";

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

    if (!(coursPdf instanceof File) || !(examenPdf instanceof File)) {
      return NextResponse.json({ error: "Les deux PDF (cours et examen) sont requis." }, { status: 400 });
    }
    if (!looksLikePdf(coursPdf) || !looksLikePdf(examenPdf)) {
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
        cheminPdfExamen: "",
        actif: true,
      },
    });
    courseId = course.id;

    // Sauvegarde des PDF sur le disque local.
    const dir = courseDir(course.id);
    await mkdir(dir, { recursive: true });
    const cheminPdfCours = path.join(dir, "cours.pdf");
    const cheminPdfExamen = path.join(dir, "examen.pdf");
    await writeFile(cheminPdfCours, await fileToBuffer(coursPdf));
    await writeFile(cheminPdfExamen, await fileToBuffer(examenPdf));

    // Extraction du texte des deux PDF.
    const [coursExtraction, examenExtraction] = await Promise.all([
      extractPdf(await fileToBuffer(coursPdf)),
      extractPdf(await fileToBuffer(examenPdf)),
    ]);

    // Découpage structurel provisoire (M1) + parsing examen léger.
    const drafts = sectionize(coursExtraction.text);
    const questions = parseExam(examenExtraction.text);

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
          // M1 : pas d'ingestion IA encore → on marque "pret" (provisoire).
          statut: "pret",
        },
      }),
    ]);

    return NextResponse.json({
      courseId: course.id,
      sections: drafts.length,
      questions: questions.length,
      coursPages: coursExtraction.numPages,
      examenPages: examenExtraction.numPages,
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
