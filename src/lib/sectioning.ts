// Découpage STRUCTUREL PROVISOIRE (M1) — volontairement heuristique.
// La vraie découpe adaptative + hiérarchisation (essentiel/utile/secondaire) est
// faite par l'IA en M2. Ici on s'appuie sur les titres détectables, avec repli
// par longueur quand la structure manque, juste pour "afficher des sections".

export type SectionType = "notion" | "tableau" | "diathese" | "meta";

export interface DraftSection {
  titre: string;
  niveau: number;
  ordre: number;
  texte: string;
  type: SectionType;
}

interface HeadingHit {
  lineIndex: number;
  titre: string;
  niveau: number;
}

const KEYWORD_HEADING =
  /^(chapitre|partie|section|annexe|module|introduction|conclusion|objectifs?|avant-propos|pr[ée]ambule)\b/i;

const META_RE =
  /(guide de l['’]?[ée]tudiant|consignes|[ée]ch[ée]anc|copyright|tous droits r[ée]serv[ée]s|table des mati[èe]res|plan de cours|bar[èe]me|modalit[ée]s|pr[ée]sentation du cours|sommaire)/i;

const DIATHESE_RE = /diath[èe]s?e/i;
const TABLEAU_TITLE_RE = /(tableau|aliments riches|besoins particuliers|teneur|apports|valeurs?)/i;

// Boilerplate récurrent des PDF CMDQ (pieds/en-têtes de page, copyright) à retirer
// AVANT le découpage : sinon « 12 - Manuel pédagogique » est pris pour un titre.
const BOILERPLATE_PATTERNS: RegExp[] = [
  /^\d+\s*-\s*Manuel pédagogique\b/i,
  /^Manuel pédagogique\s*-\s*\d+/i,
  /^Collège des Médecines Douces\b/i,
  /^Études internationales\b/i,
  /^©\s*CMDQ/i,
  /^Les informations contenues dans ce manuel/i,
  /diplôme ou d.une attestation/i,
  /reproduction ou traduction/i,
  /Tous droits réservés/i,
  /^-?\s*\d{1,3}\s*-?\s*$/, // numéro de page seul
];

/**
 * Retire le boilerplate de pagination. Deux passes :
 *  1) motifs explicites CMDQ ;
 *  2) générique — lignes courtes récurrentes (forme normalisée, chiffres masqués)
 *     contenant un chiffre/marque institutionnelle → en-têtes/pieds d'autres mises en page.
 * Les sous-titres de gabarit sans chiffre (ex. « Signes de carence ») sont préservés.
 */
export function stripBoilerplate(text: string): string {
  const lines = text.split("\n");
  const norm = (l: string) => l.trim().replace(/\d+/g, "#").replace(/\s+/g, " ");

  const freq = new Map<string, number>();
  for (const l of lines) {
    const t = l.trim();
    if (t.length === 0 || t.length > 60) continue;
    freq.set(norm(l), (freq.get(norm(l)) ?? 0) + 1);
  }
  const recurring = new Set<string>();
  for (const [k, n] of freq) if (n >= 6 && /\d|coll|manuel|cmdq/i.test(k)) recurring.add(k);

  return lines
    .filter((l) => {
      const t = l.trim();
      if (BOILERPLATE_PATTERNS.some((p) => p.test(t))) return false;
      if (t.length > 0 && t.length <= 60 && recurring.has(norm(l))) return false;
      return true;
    })
    .join("\n");
}

/** Découpe le texte d'un cours en sections provisoires. */
export function sectionize(rawText: string): DraftSection[] {
  const fullText = stripBoilerplate(rawText);
  const lines = fullText.split("\n");

  // 1) Titres "forts" : numérotés ou par mot-clé.
  let headings = detectHeadings(lines, false);

  // 2) Si trop peu de structure, on autorise aussi les titres EN CAPITALES.
  if (headings.length < 3) {
    headings = detectHeadings(lines, true);
  }

  // 3) Toujours rien d'exploitable → repli par longueur.
  if (headings.length < 3) {
    return chunkByLength(fullText);
  }

  const sections: DraftSection[] = [];

  // Préambule éventuel avant le premier titre.
  const firstHeadingLine = headings[0].lineIndex;
  const preamble = lines.slice(0, firstHeadingLine).join("\n").trim();
  if (preamble.length > 120) {
    sections.push(makeSection("Préambule", 1, 0, preamble));
  }

  headings.forEach((h, i) => {
    const start = h.lineIndex + 1;
    const end = i + 1 < headings.length ? headings[i + 1].lineIndex : lines.length;
    const body = lines.slice(start, end).join("\n").trim();
    sections.push(makeSection(h.titre, h.niveau, sections.length, body, h.titre));
  });

  return sections.filter((s) => s.titre.length > 0 && (s.texte.length > 0 || s.type === "meta"));
}

function detectHeadings(lines: string[], allowAllCaps: boolean): HeadingHit[] {
  const hits: HeadingHit[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (line.length === 0 || line.length > 90) continue;

    // Numéroté : "1.", "1.2", "3.1.4 Titre…"
    const numbered = line.match(/^(\d+(?:\.\d+)*)[).]?\s+(.{2,80})$/);
    if (numbered && !isOptionLine(line)) {
      const niveau = Math.min(numbered[1].split(".").length, 4);
      hits.push({ lineIndex: i, titre: line, niveau });
      continue;
    }

    // Par mot-clé : Chapitre, Annexe, Partie, Objectifs…
    if (KEYWORD_HEADING.test(line)) {
      const niveau = /^(chapitre|partie|annexe|module)/i.test(line) ? 1 : 2;
      hits.push({ lineIndex: i, titre: line, niveau });
      continue;
    }

    // EN CAPITALES (titre court non ponctué) — seulement en second passage.
    if (allowAllCaps && isAllCapsHeading(line)) {
      hits.push({ lineIndex: i, titre: toTitleCase(line), niveau: 2 });
    }
  }
  return hits;
}

function isOptionLine(line: string): boolean {
  // Évite de confondre des items "1) ..." d'une liste avec des titres trop courts.
  return /^[a-dA-D][).]\s/.test(line);
}

function isAllCapsHeading(line: string): boolean {
  if (/[.:;!?]$/.test(line)) return false;
  const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 3) return false;
  const upper = line.replace(/[^A-ZÀ-Þ]/g, "").length;
  return upper / letters.length >= 0.7;
}

function toTitleCase(s: string): string {
  const lower = s.toLocaleLowerCase("fr");
  return lower.charAt(0).toLocaleUpperCase("fr") + lower.slice(1);
}

function makeSection(
  titre: string,
  niveau: number,
  ordre: number,
  texte: string,
  titreForType = titre,
): DraftSection {
  return { titre: clampTitre(titre), niveau, ordre, texte, type: classify(titreForType, texte) };
}

function clampTitre(titre: string): string {
  const t = titre.trim();
  return t.length > 120 ? t.slice(0, 117) + "…" : t;
}

function classify(titre: string, texte: string): SectionType {
  const head = (titre + "\n" + texte.slice(0, 240)).toLowerCase();
  if (META_RE.test(head)) return "meta";
  if (DIATHESE_RE.test(titre) || DIATHESE_RE.test(texte.slice(0, 240))) return "diathese";
  if (TABLEAU_TITLE_RE.test(titre)) return "tableau";
  // Heuristique de corps réservée aux sections courtes (qui SONT un tableau),
  // pas aux gros chapitres qui en contiennent un.
  if (texte.length < 2500 && isTabular(texte)) return "tableau";
  return "notion";
}

/** Heuristique "ça ressemble à un tableau" : plusieurs lignes multi-colonnes. */
function isTabular(texte: string): boolean {
  const lines = texte.split("\n");
  let cols = 0;
  for (const l of lines) {
    if (/\S\t+\S/.test(l) || /\S {2,}\S {2,}\S/.test(l)) cols++;
    if (cols >= 4) return true;
  }
  return false;
}

/** Repli : découpe par longueur sur les frontières de paragraphe (~2500 caractères). */
function chunkByLength(fullText: string, target = 2500): DraftSection[] {
  const paras = fullText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const sections: DraftSection[] = [];
  let buf = "";
  let n = 1;
  const flush = () => {
    if (!buf.trim()) return;
    const titre = firstLineTitle(buf, n);
    sections.push(makeSection(titre, 2, sections.length, buf.trim()));
    buf = "";
    n++;
  };
  for (const p of paras) {
    if (buf.length + p.length > target && buf.length > 0) flush();
    buf += (buf ? "\n\n" : "") + p;
  }
  flush();
  return sections;
}

function firstLineTitle(buf: string, n: number): string {
  const first = buf.split("\n")[0].trim();
  if (first.length >= 8 && first.length <= 80) return first;
  return `Partie ${n}`;
}
