-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "delaiJours" INTEGER NOT NULL,
    "dateDebut" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT NOT NULL DEFAULT 'nouveau',
    "cheminPdfCours" TEXT NOT NULL,
    "cheminPdfExamen" TEXT NOT NULL,
    "ingestModel" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "niveau" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL,
    "texte" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'notion',
    "importance" TEXT,
    CONSTRAINT "Section_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "jourCible" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "sectionsLiees" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "StudyUnit_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Fiche" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyUnitId" TEXT NOT NULL,
    "contenuMarkdown" TEXT NOT NULL,
    "notionsCles" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "Fiche_studyUnitId_fkey" FOREIGN KEY ("studyUnitId") REFERENCES "StudyUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enonce" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "bonneReponse" TEXT,
    "justification" TEXT,
    "sectionSourceId" TEXT,
    "statutValidation" TEXT NOT NULL DEFAULT 'en_attente',
    "studyUnitId" TEXT,
    CONSTRAINT "Question_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Question_sectionSourceId_fkey" FOREIGN KEY ("sectionSourceId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyUnitId" TEXT NOT NULL,
    "completeLe" DATETIME,
    "scoreQuiz" INTEGER,
    CONSTRAINT "Progress_studyUnitId_fkey" FOREIGN KEY ("studyUnitId") REFERENCES "StudyUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "boite" INTEGER NOT NULL DEFAULT 1,
    "prochaineEcheance" DATETIME,
    "historique" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "ReviewItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OfficialKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "reponsesImportees" TEXT NOT NULL,
    "ecartsDetectes" TEXT NOT NULL DEFAULT '[]',
    "importeLe" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OfficialKey_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiUsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT,
    "phase" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiUsageLog_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Section_courseId_ordre_idx" ON "Section"("courseId", "ordre");

-- CreateIndex
CREATE INDEX "StudyUnit_courseId_ordre_idx" ON "StudyUnit"("courseId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "Fiche_studyUnitId_key" ON "Fiche"("studyUnitId");

-- CreateIndex
CREATE INDEX "Question_courseId_type_idx" ON "Question"("courseId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Progress_studyUnitId_key" ON "Progress"("studyUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewItem_questionId_key" ON "ReviewItem"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialKey_courseId_key" ON "OfficialKey"("courseId");
