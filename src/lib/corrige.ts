export type LettreReponse = "A" | "B" | "C" | "D";

export interface ReponseCorrigee {
  numero: number;
  reponse: LettreReponse;
}

export interface QuestionCorrige {
  id: string;
  bonneReponse: string | null;
}

export interface EcartCorrige {
  numero: number;
  questionId: string;
  ia: string | null;
  officiel: LettreReponse;
  ecart: boolean;
}

function estLettreReponse(value: string): value is LettreReponse {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

function dedoublonnerParNumero(reponses: ReponseCorrigee[]): ReponseCorrigee[] {
  const map = new Map<number, LettreReponse>();
  for (const item of reponses) {
    if (Number.isInteger(item.numero) && item.numero > 0) {
      map.set(item.numero, item.reponse);
    }
  }
  return Array.from(map.entries())
    .map(([numero, reponse]) => ({ numero, reponse }))
    .sort((a, b) => a.numero - b.numero);
}

export function parseCorrige(texte: string): ReponseCorrigee[] {
  const upper = texte.toUpperCase();
  const paires: ReponseCorrigee[] = [];
  const pairRegex = /(?:^|[^\d])(\d{1,2})\s*[\).:\-]?\s*([ABCD])(?=$|[^A-Z])/gm;

  for (const match of upper.matchAll(pairRegex)) {
    const numero = Number(match[1]);
    const reponse = match[2];
    if (Number.isInteger(numero) && numero > 0 && estLettreReponse(reponse)) {
      paires.push({ numero, reponse });
    }
  }

  if (paires.length > 0) return dedoublonnerParNumero(paires);

  const lettresAutonomes = Array.from(upper.matchAll(/(?:^|[^A-Z])([ABCD])(?=$|[^A-Z])/g)).map(
    (match) => match[1],
  );
  if (lettresAutonomes.length > 0) {
    return lettresAutonomes.map((reponse, index) => ({
      numero: index + 1,
      reponse: reponse as LettreReponse,
    }));
  }

  const compactable = upper.replace(/[\s,;|/.-]/g, "");
  if (/^[ABCD]+$/.test(compactable)) {
    const compact = compactable;
    return compact.split("").map((reponse, index) => ({
      numero: index + 1,
      reponse: reponse as LettreReponse,
    }));
  }

  return [];
}

export function calculerEcarts(
  reponses: ReponseCorrigee[],
  questionsOrdonnees: QuestionCorrige[],
): EcartCorrige[] {
  return reponses
    .map((item) => {
      const question = questionsOrdonnees[item.numero - 1];
      if (!question) return null;
      const ia = question.bonneReponse;
      return {
        numero: item.numero,
        questionId: question.id,
        ia,
        officiel: item.reponse,
        ecart: ia !== item.reponse,
      };
    })
    .filter((item): item is EcartCorrige => item !== null);
}
