// Moteur de plan d'étude (cahier §5.3) — fonctions PURES, sans IA ni accès DB.
//
// Principe : le rythme est *dérivé* à chaque rendu, jamais stocké. À partir de la
// date de début (jour 1), du plafond `delaiJours` et de l'état de complétion, on
// recalcule combien de fiches faire par jour pour rester sous le plafond. Le recalage
// des jours sautés en découle gratuitement : moins de jours restants ⇒ densité plus
// haute, l'échéance n'est jamais repoussée. M2 a posé `StudyUnit.jourCible` en
// répartition uniforme provisoire ; ce moteur le remplace pour la vue vivante.

const MS_PAR_JOUR = 86_400_000;

/** Index du jour calendaire local (ignore l'heure) — base d'un diff insensible à l'heure d'import. */
function indexJour(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PAR_JOUR);
}

/** Nombre de jours calendaires entiers entre deux dates (a - b). */
export function diffJours(a: Date, b: Date): number {
  return indexJour(a) - indexJour(b);
}

/** Date décalée de `n` jours (n peut être négatif). */
export function ajouterJours(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Entrée minimale par unité d'étude (issue de la DB, triée par `ordre`). */
export interface PlanUnitInput {
  id: string;
  ordre: number;
  titre: string;
  completeLe: Date | null;
}

/** Unité enrichie de son jour effectif (recalculé) et de drapeaux d'affichage. */
export interface PlannedUnit {
  id: string;
  ordre: number;
  titre: string;
  estComplete: boolean;
  /** Jour effectif recalculé (1..delaiJours) pour une unité incomplète ; null si complétée. */
  jourEffectif: number | null;
  /** Fait partie du lot suggéré aujourd'hui. */
  estAujourdhui: boolean;
}

export type RythmeStatut = "termine" | "a_jour" | "en_avance" | "en_retard";

export interface PlanState {
  total: number;
  completes: number;
  restantes: number;
  /** Jour courant du parcours (1..delaiJours), borné au plafond. */
  jourCourant: number;
  joursRestants: number;
  delaiJours: number;
  /** Fiches/jour à tenir à partir d'aujourd'hui pour finir dans les temps (recalage). */
  densite: number;
  /** Date du dernier jour du parcours (dateDebut + delaiJours − 1). Jamais dépassée. */
  echeance: Date;
  termine: boolean;
  /** Derniers ~20 % du délai (ou parcours terminé) : la révision passe au premier plan (§5.5). */
  modeRevision: boolean;
  rythme: RythmeStatut;
  /** Nombre de fiches de retard (>0 si en retard, sinon 0). */
  retard: number;
  /** Nombre de fiches d'avance (>0 si en avance, sinon 0). */
  avance: number;
  /** Unités incomplètes suggérées aujourd'hui (≥ 1 tant qu'il reste des fiches). */
  fichesDuJourIds: string[];
  /** Première unité incomplète (par ordre) — cible du bouton « Continuer ». */
  prochaineFicheId: string | null;
  /** Toutes les unités, dans l'ordre, enrichies. */
  units: PlannedUnit[];
}

/**
 * Calcule l'état du plan d'étude à partir du cours et de ses unités.
 * `now` est injectable pour les tests / simulations (défaut : maintenant).
 */
export function computePlan(
  course: { dateDebut: Date; delaiJours: number },
  units: PlanUnitInput[],
  now: Date = new Date(),
): PlanState {
  const delaiJours = Math.max(1, course.delaiJours);
  const ordered = [...units].sort((a, b) => a.ordre - b.ordre);
  const total = ordered.length;

  const jourCourant = clamp(diffJours(now, course.dateDebut) + 1, 1, delaiJours);
  const joursRestants = Math.max(1, delaiJours - jourCourant + 1);
  const echeance = ajouterJours(course.dateDebut, delaiJours - 1);

  const incompletes = ordered.filter((u) => !u.completeLe);
  const completes = total - incompletes.length;
  const restantes = incompletes.length;
  const termine = restantes === 0;
  // Bascule en mode révision (§5.5) sur les derniers ~20 % du délai, ou une fois terminé.
  const modeRevision = termine || joursRestants <= Math.ceil(delaiJours * 0.2);

  // Densité recompactée : ce qu'il faut tenir par jour pour finir avant le plafond.
  const densite = restantes === 0 ? 0 : Math.ceil(restantes / joursRestants);

  // Affecte chaque unité incomplète à un jour effectif (à partir d'aujourd'hui).
  const jourParUnite = new Map<string, number>();
  incompletes.forEach((u, i) => {
    const jour = densite > 0 ? Math.floor(i / densite) : 0;
    jourParUnite.set(u.id, Math.min(jourCourant + jour, delaiJours));
  });

  const fichesDuJourIds = incompletes
    .filter((u) => jourParUnite.get(u.id) === jourCourant)
    .map((u) => u.id);

  // Indicateur de rythme : avance/retard vs une répartition idéale régulière.
  const idealParJour = Math.ceil(total / delaiJours);
  const attenduAujourdhui = Math.min(total, jourCourant * idealParJour);
  const ecart = completes - attenduAujourdhui; // >0 avance, <0 retard
  let rythme: RythmeStatut;
  if (termine) rythme = "termine";
  else if (ecart > 0) rythme = "en_avance";
  else if (ecart < 0) rythme = "en_retard";
  else rythme = "a_jour";

  const planned: PlannedUnit[] = ordered.map((u) => ({
    id: u.id,
    ordre: u.ordre,
    titre: u.titre,
    estComplete: !!u.completeLe,
    jourEffectif: u.completeLe ? null : (jourParUnite.get(u.id) ?? jourCourant),
    estAujourdhui: fichesDuJourIds.includes(u.id),
  }));

  return {
    total,
    completes,
    restantes,
    jourCourant,
    joursRestants,
    delaiJours,
    densite,
    echeance,
    termine,
    modeRevision,
    rythme,
    retard: ecart < 0 ? -ecart : 0,
    avance: ecart > 0 ? ecart : 0,
    fichesDuJourIds,
    prochaineFicheId: incompletes[0]?.id ?? null,
    units: planned,
  };
}
