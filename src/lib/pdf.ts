import pdfParse from "pdf-parse";

export interface PdfExtraction {
  text: string;
  numPages: number;
  info: Record<string, unknown> | null;
}

/** Extrait le texte d'un PDF (texte sélectionnable, pas d'OCR). */
export async function extractPdf(buffer: Buffer): Promise<PdfExtraction> {
  const data = await pdfParse(buffer);
  return {
    text: normalizeText(data.text),
    numPages: data.numpages,
    info: (data.info as Record<string, unknown>) ?? null,
  };
}

/** Nettoyage léger : normalise les sauts de ligne, espaces insécables, lignes vides. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/ /g, " ") // espace insécable
    .replace(/[ \t]+\n/g, "\n") // espaces en fin de ligne
    .replace(/\n{3,}/g, "\n\n") // au plus une ligne vide consécutive
    .trim();
}
