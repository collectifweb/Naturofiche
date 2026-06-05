// Répétition espacée — boîtes de Leitner (cahier §5.5). Fonctions PURES, sans DB.
//
// Horizon court et fixe (15–45 j) : on préfère Leitner à un espacement long (SM-2).
// Chaque notion vérifiée par quiz avance d'une boîte si la réponse est juste, et
// retombe en boîte 1 si elle est fausse. Plus la boîte est haute, plus l'intervalle
// avant la prochaine révision s'allonge : une notion ratée revient vite, une notion
// maîtrisée revient rarement mais au moins une fois avant l'examen.

import { ajouterJours } from "@/lib/plan";

/** Intervalle (jours) avant prochaine révision, indexé par boîte−1. 5 boîtes. */
export const INTERVALLES = [1, 2, 4, 7, 12] as const;
export const BOITE_MAX = INTERVALLES.length;
export const BOITE_MIN = 1;

/** Boîte suivante après une réponse : +1 si juste (plafonnée), retour à 1 si fausse. */
export function prochaineBoite(boite: number, correct: boolean): number {
  if (!correct) return BOITE_MIN;
  return Math.min(boite + 1, BOITE_MAX);
}

/** Intervalle en jours associé à une boîte (1..BOITE_MAX). */
export function intervalleJours(boite: number): number {
  const i = Math.max(BOITE_MIN, Math.min(boite, BOITE_MAX)) - 1;
  return INTERVALLES[i];
}

/** Date de prochaine échéance pour une boîte, à partir d'une date donnée. */
export function dateEcheance(boite: number, from: Date): Date {
  return ajouterJours(from, intervalleJours(boite));
}

/** Élément de révision (sous-ensemble de ReviewItem nécessaire au tri). */
export interface ReviewLike {
  boite: number;
  prochaineEcheance: Date | null;
}

/** Une notion est échue si jamais revue (pas d'échéance) ou si l'échéance est passée. */
export function estEchu(item: ReviewLike, now: Date = new Date()): boolean {
  return !item.prochaineEcheance || item.prochaineEcheance.getTime() <= now.getTime();
}

/**
 * Ordonne les notions pour la révision : boîtes basses d'abord (les moins maîtrisées),
 * puis par échéance la plus ancienne (les jamais-revues, échéance nulle, en tête).
 */
export function prioriserRevision<T extends ReviewLike>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.boite !== b.boite) return a.boite - b.boite;
    const ea = a.prochaineEcheance ? a.prochaineEcheance.getTime() : 0;
    const eb = b.prochaineEcheance ? b.prochaineEcheance.getTime() : 0;
    return ea - eb;
  });
}
