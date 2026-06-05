// Jetable : importe /tmp/nf-dump.json dans MySQL via l'adapter (tunnel SSH).
// Usage : DATABASE_URL="mysql://user:pw@127.0.0.1:3307/db" node scripts/load-mysql.mjs
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { readFileSync } from "node:fs";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });
const data = JSON.parse(readFileSync("/tmp/nf-dump.json", "utf8"));

// Réhydrate les champs DateTime (ISO string -> Date) par collection.
const dateFields = {
  courses: ["dateDebut", "createdAt", "updatedAt"],
  progress: ["completeLe"],
  reviewItems: ["prochaineEcheance"],
  officialKeys: ["importeLe"],
  qaMessages: ["createdAt"],
  apiUsageLogs: ["createdAt"],
};
function revive(rows, fields) {
  if (!fields) return rows;
  return rows.map((r) => {
    const o = { ...r };
    for (const f of fields) if (o[f] != null) o[f] = new Date(o[f]);
    return o;
  });
}

// Ordre des FK : Course -> Section -> StudyUnit -> Fiche -> Progress
// -> Question -> ReviewItem -> OfficialKey -> QaMessage -> ApiUsageLog
const order = [
  ["courses", "course"],
  ["sections", "section"],
  ["studyUnits", "studyUnit"],
  ["fiches", "fiche"],
  ["progress", "progress"],
  ["questions", "question"],
  ["reviewItems", "reviewItem"],
  ["officialKeys", "officialKey"],
  ["qaMessages", "qaMessage"],
  ["apiUsageLogs", "apiUsageLog"],
];

for (const [key, model] of order) {
  const rows = revive(data[key] ?? [], dateFields[key]);
  if (rows.length === 0) {
    console.log(`${key}: 0 (skip)`);
    continue;
  }
  const res = await prisma[model].createMany({ data: rows });
  console.log(`${key}: ${res.count} insérés`);
}

await prisma.$disconnect();
console.log("LOAD_OK");
