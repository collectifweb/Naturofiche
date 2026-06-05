import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Driver adapter pur-JS (pas de moteur Rust Prisma) : Prisma parle à MySQL/MariaDB
// par le réseau, ce qui contourne le blocage d'I/O fichier de CageFS sur l'hébergement
// mutualisé WHC (le moteur Rust ne pouvait ouvrir aucun fichier SQLite). Voir tasks/DEPLOY.md.
// DATABASE_URL = mysql://user:pass@host:3306/db (l'adapter réécrit mysql:// -> mariadb://).
const adapter = new PrismaMariaDb(process.env.DATABASE_URL ?? "");

// Singleton : évite d'épuiser les connexions en dev (hot reload Next.js).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
