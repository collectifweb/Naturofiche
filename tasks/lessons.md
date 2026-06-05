# NaturoFiche — Leçons (self-improvement loop)

Patterns appris pendant le développement, pour éviter de répéter les erreurs.

## Environnement / toolchain

- **Node** : `/usr/bin/node` = v18.19, mais **Next.js 16 exige Node 20+**. Node 20.20.2 est dispo via nvm
  (`/home/alexandre/.nvm/versions/node/v20.20.2/bin`). Préfixer les commandes node/npm/npx avec
  `export PATH="/home/alexandre/.nvm/versions/node/v20.20.2/bin:$PATH";`.
- **Hook RTK réécrit les commandes** : `npx <pkg>@latest …` est transformé en commande `npm` → erreur
  « Unknown command ». Solution : préfixer par **`rtk proxy`** pour exécuter sans filtrage
  (ex. `rtk proxy npx -y shadcn@latest add …`, `rtk proxy npx prisma migrate dev`). Les `npm install`
  simples passent sans souci.
- **create-next-app refuse un dossier non vide** et refuse les **majuscules** dans le nom (dossier
  « Naturofiche »). Méthode : déplacer temporairement les fichiers existants, scaffolder dans un
  **sous-dossier minuscule** avec `--skip-install`, remonter le contenu (`cp -a sous-dossier/. ./`),
  supprimer le `.git` du scaffold, restaurer les fichiers, puis `npm install` à la racine.
- **Commandes multi-lignes avec `\`** : le hook peut injecter un argument vide (` `) et casser la commande
  (ex. `cp` recevant une cible ` `). → privilégier des commandes **sur une seule ligne** ou séparées.

## Versions / dépendances

- **Prisma 7** (sorti récemment) casse la config classique : `url = env("DATABASE_URL")` n'est plus accepté
  dans le schéma (exige `prisma.config.ts` + driver adapter). Pour une app SQLite mono-utilisateur, on
  **épingle Prisma 6** (`prisma@6`, `@prisma/client@6`) → `url = env()` direct, zéro friction.
- **create-next-app@latest** installe désormais **Next 16 + React 19 + Tailwind v4** (config CSS dans
  `globals.css`, plus de `tailwind.config.js`). shadcn/ui supporte cette stack.
- **pdf-parse** a un bug connu : son `index.js` lit un PDF de test au chargement quand `module.parent`
  est absent (cas des bundlers). Mitigation : le déclarer dans `serverExternalPackages` (next.config.ts)
  pour qu'il soit `require` au runtime, non bundlé.

## Architecture

- SQLite via Prisma : **pas de tableaux ni d'enums natifs** → listes en `String` JSON, enums en `String`
  documentés par commentaire.
- Clé API Anthropic : client **lazy** (`getAnthropic()`) pour ne pas échouer à l'import quand la clé est
  absente, et rester strictement côté serveur.
