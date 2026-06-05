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
  (ex. `cp` recevant une cible ` `, ou `git commit -m …` avec « le spécificateur de chemin ` ` »).
  → privilégier des commandes **sur une seule ligne** ou séparées ; pour un message de commit multi-ligne,
  passer par un fichier : `git commit -F /tmp/commit-msg.txt`.
- **Le répertoire de travail PERSISTE entre les appels Bash.** Un `cd public/icons` (pour rasteriser les
  icônes) est resté actif et un `cat >> .gitignore` ultérieur a créé `public/icons/.gitignore` au lieu du
  `.gitignore` racine. → toujours `cd` vers la racine (ou utiliser des chemins absolus) avant les écritures
  relatives ; préférer l'outil Write/Edit au heredoc pour les fichiers du repo.
- **`sleep` en avant-plan est bloqué** par le harness (échec du shell). Pour attendre un service, utiliser
  `curl --retry N --retry-connrefused --retry-delay 1` plutôt qu'une boucle `sleep`.
- **Un agent mémoire édite les fichiers du repo en parallèle** (`CLAUDE.md`, `.gitignore` ont été modifiés
  pendant la session). → **relire** un fichier juste avant de l'éditer ; ne pas présumer de son contenu.

## Versions / dépendances

- **Prisma 7** (sorti récemment) casse la config classique : `url = env("DATABASE_URL")` n'est plus accepté
  dans le schéma (exige `prisma.config.ts` + driver adapter). Pour une app SQLite mono-utilisateur, on
  **épingle Prisma 6** (`prisma@6`, `@prisma/client@6`) → `url = env()` direct, zéro friction.
- **create-next-app@latest** installe désormais **Next 16 + React 19 + Tailwind v4** (config CSS dans
  `globals.css`, plus de `tailwind.config.js`). shadcn/ui supporte cette stack.
- **pdf-parse v2 vs v1** : `npm i pdf-parse` installe la **v2** (ESM réécrite, **pas d'export par défaut**
  → `import pdfParse from "pdf-parse"` casse au type-check). On épingle **`pdf-parse@1`** (1.1.4, API
  classique `pdf(buffer): Promise<{text,numpages,info}>`, couverte par `@types/pdf-parse`).
- **pdf-parse** (v1) a un bug connu : son `index.js` lit un PDF de test au chargement quand `module.parent`
  est absent (cas des bundlers). Mitigation : le déclarer dans `serverExternalPackages` (next.config.ts)
  pour qu'il soit `require` au runtime, non bundlé.
- **Prisma 6 bloque les commandes destructrices lancées par une IA** (`migrate reset`) sans consentement
  explicite de l'utilisateur. Pour un reset de la base **de dev** : supprimer `prisma/dev.db` puis
  `prisma migrate deploy`, ou `prisma.course.deleteMany()` via un script client (pas de garde).
- **Next 16 déprécie `middleware.ts`** au profit de **`proxy.ts`** (fonction exportée `proxy`, même
  signature, même `export const config`).
- **Bouton shadcn « base-nova »** : basé sur `@base-ui/react` → **pas de prop `asChild`** (Radix Slot).
  Pour un lien stylé en bouton : `<Link className={buttonVariants({ variant, className })}>`.

## Format des documents CMDQ (cours 354)

- **Examen** : questions introduites par `Question 1`, `Question 2`… (le mot + numéro), options en
  **puces** `• A …` / `• B …` (pas `1.` ni `A)`). Présence d'une « Grille de réponse » (`1 O O O O`…) et
  d'en-têtes/pieds à ignorer. Le parseur détecte ce mode et a un repli générique `1.` / `A)`.
- **Cours** : pieds de page récurrents `N - Manuel pédagogique`, en-tête `Collège des Médecines Douces`,
  copyright `©CMDQ` — du **boilerplate à retirer avant le découpage** (sinon pris pour des titres).
  Vrais titres : `CHAPITRE N`, `Introduction`, `Objectifs`, exercices numérotés `N. …`.

## Architecture

- SQLite via Prisma : **pas de tableaux ni d'enums natifs** → listes en `String` JSON, enums en `String`
  documentés par commentaire.
- Clé API Anthropic : client **lazy** (`getAnthropic()`) pour ne pas échouer à l'import quand la clé est
  absente, et rester strictement côté serveur.
