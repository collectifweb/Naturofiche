-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "delaiJours" INTEGER NOT NULL,
    "dateDebut" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT NOT NULL DEFAULT 'nouveau',
    "etapeIngestion" TEXT,
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "erreurMessage" TEXT,
    "cheminPdfCours" TEXT NOT NULL,
    "cheminPdfExamen" TEXT,
    "ingestModel" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Course" ("actif", "cheminPdfCours", "cheminPdfExamen", "code", "createdAt", "dateDebut", "delaiJours", "id", "ingestModel", "statut", "title", "updatedAt") SELECT "actif", "cheminPdfCours", "cheminPdfExamen", "code", "createdAt", "dateDebut", "delaiJours", "id", "ingestModel", "statut", "title", "updatedAt" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
