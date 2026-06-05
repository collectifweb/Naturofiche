import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Déploiement : bundle autonome (.next/standalone) pour tourner sous Passenger
  // (cPanel WHC) sans installer toutes les deps sur le serveur.
  output: "standalone",
  // pdf-parse et @prisma/client doivent rester externes (require au runtime, pas
  // bundlés). Pour pdf-parse, ça évite son bug de chargement (lecture d'un PDF de
  // test quand module.parent est absent). Pour Prisma, c'est la reco officielle.
  serverExternalPackages: [
    "pdf-parse",
    "@prisma/client",
    "prisma",
    // Driver adapter MySQL : pur JS mais avec des require() dynamiques -> garder externe
    // (tracé et copié tel quel dans .next/standalone, pas bundlé).
    "@prisma/adapter-mariadb",
    "mariadb",
  ],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@prisma/adapter-mariadb/**/*",
      "./node_modules/@prisma/driver-adapter-utils/**/*",
      "./node_modules/@prisma/debug/**/*",
      "./node_modules/mariadb/**/*",
      "./node_modules/denque/**/*",
      "./node_modules/iconv-lite/**/*",
      "./node_modules/lru-cache/**/*",
    ],
  },
};

export default nextConfig;
