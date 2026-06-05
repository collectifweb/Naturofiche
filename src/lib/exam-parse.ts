// Parsing EXAMEN léger (M1) — best-effort pour afficher le nombre de questions et
// amorcer la structure. Le parsing fiable + déduction des bonnes réponses = IA (M2).
//
// Format CMDQ réel (cours 354) :
//   Question 1
//   <énoncé sur la/les lignes suivantes>
//   • A <option>
//   • B <option>
//   • C <option>
//   • D <option>
// Plus un repli générique "1." / "A)" pour d'autres mises en page.

export interface ParsedOption {
  key: string; // "A" | "B" | "C" | "D"
  text: string;
}

export interface ParsedQuestion {
  numero: number;
  enonce: string;
  options: ParsedOption[];
}

// En-têtes / pieds de page / grille de réponse à ignorer (bruit d'extraction PDF).
const NOISE_RE =
  /^(\d+\s*-\s*Manuel pédagogique|Collège des Médecines Douces|Études internationales|Activités notées|Utiliser la grille|Grille de réponse|©\s*CMDQ|EXAMEN\b|DATE D'ÉCHÉANCE|Échéancier|A\s*C\s*T\s*I\s*V|-\s*\d+\s*$|\d+\s+O\s+O\s+O\s+O\s*$)/i;

export function parseExam(text: string): ParsedQuestion[] {
  const lines = text.split("\n");
  const cmdqMode = /(^|\n)\s*Question\s+\d/i.test(text);
  const questions: ParsedQuestion[] = [];
  let current: ParsedQuestion | null = null;

  const commit = () => {
    if (current && current.options.length >= 2) questions.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || NOISE_RE.test(line)) continue;

    const q = matchQuestion(line, cmdqMode);
    if (q) {
      commit();
      current = { numero: q.numero, enonce: q.enonce, options: [] };
      continue;
    }

    if (current) {
      const opt = matchOption(line);
      if (opt) {
        current.options.push(opt);
        continue;
      }
      // Continuation : énoncé tant qu'aucune option, sinon dernière option.
      if (current.options.length > 0) {
        current.options[current.options.length - 1].text += " " + line;
      } else {
        current.enonce = (current.enonce ? current.enonce + " " : "") + line;
      }
    }
  }
  commit();

  return dedupeByNumero(questions);
}

function matchQuestion(
  line: string,
  cmdqMode: boolean,
): { numero: number; enonce: string } | null {
  if (cmdqMode) {
    const m = line.match(/^Question\s+(\d{1,3})\b\s*(.*)$/i);
    if (m) return { numero: parseInt(m[1], 10), enonce: m[2].trim() };
    return null;
  }
  const m = line.match(/^(\d{1,2})[).]\s+(\S.*)$/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 40) return { numero: n, enonce: m[2].trim() };
  }
  return null;
}

function matchOption(line: string): ParsedOption | null {
  // CMDQ : puce + lettre, ex. "• A Le cuivre".
  let m = line.match(/^[•·●○∙*•●◦]\s*([A-Da-d])\s+(\S.*)$/);
  if (m) return { key: m[1].toUpperCase(), text: m[2].trim() };
  // Délimité : "A) texte" ou "A. texte".
  m = line.match(/^([A-Da-d])[).]\s+(\S.*)$/);
  if (m) return { key: m[1].toUpperCase(), text: m[2].trim() };
  return null;
}

function dedupeByNumero(questions: ParsedQuestion[]): ParsedQuestion[] {
  const byNum = new Map<number, ParsedQuestion>();
  for (const q of questions) {
    const existing = byNum.get(q.numero);
    if (!existing || q.options.length > existing.options.length) byNum.set(q.numero, q);
  }
  return [...byNum.values()].sort((a, b) => a.numero - b.numero);
}
