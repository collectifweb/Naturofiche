-- CreateTable
CREATE TABLE "QaMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "studyUnitId" TEXT,
    "question" TEXT NOT NULL,
    "reponse" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'cours',
    "sectionsCitees" TEXT NOT NULL DEFAULT '[]',
    "sourcesWeb" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QaMessage_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QaMessage_studyUnitId_fkey" FOREIGN KEY ("studyUnitId") REFERENCES "StudyUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QaMessage_courseId_createdAt_idx" ON "QaMessage"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "QaMessage_studyUnitId_createdAt_idx" ON "QaMessage"("studyUnitId", "createdAt");
