// Jetable : dump complet de la base SQLite locale vers JSON, pour réimport MySQL.
// Usage : DATABASE_URL="file:/abs/prisma/dev.db" node scripts/dump-db.mjs
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient();

const data = {
  courses: await prisma.course.findMany(),
  sections: await prisma.section.findMany(),
  studyUnits: await prisma.studyUnit.findMany(),
  fiches: await prisma.fiche.findMany(),
  progress: await prisma.progress.findMany(),
  questions: await prisma.question.findMany(),
  reviewItems: await prisma.reviewItem.findMany(),
  officialKeys: await prisma.officialKey.findMany(),
  qaMessages: await prisma.qaMessage.findMany(),
  apiUsageLogs: await prisma.apiUsageLog.findMany(),
};

writeFileSync("/tmp/nf-dump.json", JSON.stringify(data));
const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
console.log("DUMP_OK", JSON.stringify(counts));
await prisma.$disconnect();
