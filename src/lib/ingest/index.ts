import { runIngestion } from "./pipeline";
import { setProgress, ETAPES } from "./progress";

export { runIngestion } from "./pipeline";

/**
 * Déclenche l'ingestion en TÂCHE DE FOND. On bascule le statut en "ingestion" de façon
 * synchrone (pour que le polling le voie immédiatement) puis on lance le pipeline sans
 * l'attendre — la requête HTTP rend la main tout de suite, le travail continue dans le
 * process Node permanent.
 */
export async function triggerIngestion(courseId: string): Promise<void> {
  await setProgress(courseId, {
    statut: "ingestion",
    etape: ETAPES.decoupage.label,
    pct: 2,
    erreurMessage: null,
  });
  void runIngestion(courseId).catch((err) => {
    console.error("[ingestion] erreur non gérée :", err);
  });
}
