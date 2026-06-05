import { prisma } from "@/lib/prisma";

// Bornes de progression (%) par étape du pipeline d'ingestion. La barre côté UI
// lit `progressPct` ; les valeurs sont indicatives (pas de sous-progression fine).
export const ETAPES = {
  decoupage: { label: "Découpe & hiérarchisation du cours…", pct: 15 },
  reponses: { label: "Déduction des bonnes réponses…", pct: 45 },
  generation: { label: "Génération des fiches & quiz…", pct: 65 },
  verification: { label: "Vérification par un second agent…", pct: 88 },
  pret: { label: "Parcours prêt.", pct: 100 },
} as const;

interface ProgressPatch {
  statut?: string;
  etape?: string;
  pct?: number;
  erreurMessage?: string | null;
}

/** Met à jour l'état d'avancement d'un cours (statut + label d'étape + %). */
export async function setProgress(courseId: string, patch: ProgressPatch): Promise<void> {
  await prisma.course.update({
    where: { id: courseId },
    data: {
      ...(patch.statut !== undefined ? { statut: patch.statut } : {}),
      ...(patch.etape !== undefined ? { etapeIngestion: patch.etape } : {}),
      ...(patch.pct !== undefined ? { progressPct: patch.pct } : {}),
      ...(patch.erreurMessage !== undefined ? { erreurMessage: patch.erreurMessage } : {}),
    },
  });
}
