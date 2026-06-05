# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

**NaturoFiche** — PWA mono-utilisateur d'étude par fiches. Ingère un PDF de cours + son PDF d'examen (formation naturopathie CMDQ) et génère un parcours d'étude court (fiches de synthèse + quiz) calé sur un délai fixe, en priorisant ce qui tombe à l'examen. Philosophie : **l'essentiel pour réussir (seuil 80 %), pas l'exhaustivité**. Spec complète et faisant autorité : [cahier-des-charges-app-etude.md](cahier-des-charges-app-etude.md).

Mono-utilisateur, **un seul cours actif** à la fois, 100 % local derrière un tunnel Cloudflare. Clé API Anthropic strictement côté serveur.

## Stack

- **Next.js 16** (App Router, RSC) + **React 19** + **TypeScript** strict
- **Prisma 6** + **SQLite** (`prisma/dev.db`) — fichier local
- **Tailwind v4** (config CSS dans [src/app/globals.css](src/app/globals.css), **pas** de `tailwind.config`) + **shadcn/ui** (style `base-nova`, `@base-ui/react`, icônes lucide, toasts sonner)
- **Design system appliqué** (thème **clair only**) : papier chaud + **un seul** vert herbacé ; polices **Geist** (UI) / **Source Serif 4** (lecture des fiches) / **Geist Mono**. Tokens `oklch` dans [globals.css](src/app/globals.css), composant signature [Chip](src/components/ui/chip.tsx). Source de vérité : [DESIGN.md](DESIGN.md) + [PRODUCT.md](PRODUCT.md).
- **pdf-parse** (v1 épinglé) — extraction texte (PDF au texte sélectionnable, pas d'OCR)
- **@anthropic-ai/sdk** — ingestion IA (client prêt, branché en M2)
- Alias d'import : `@/*` → `./src/*` ; util `cn()` dans [src/lib/utils.ts](src/lib/utils.ts)

## Commandes

```bash
npm run dev          # serveur dev → http://localhost:3000
npm run build        # build prod
npm run start        # serveur prod
npm run lint         # eslint

npx prisma migrate dev --name <nom>   # créer + appliquer une migration
npx prisma generate                   # régénérer le client après edit du schéma
npx prisma studio                     # explorer la DB
```

**Node 20+ requis** (Next 16) : `nvm use 20` ou `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`. Pas (encore) de framework de test. Note env : si le hook `rtk` bloque un `npx`, relancer via `rtk proxy npx …`.

## État d'avancement (jalons)

**M1 (socle technique) livré ET validé**, design system appliqué. Construit : accueil mono-cours ([src/app/page.tsx](src/app/page.tsx)), écran d'import + API ([src/app/import/page.tsx](src/app/import/page.tsx), [src/app/api/import/route.ts](src/app/api/import/route.ts)), page cours ([src/app/course/[id]/page.tsx](src/app/course/[id]/page.tsx)), PWA (manifest + `public/sw.js` + icônes), garde d'accès optionnelle ([src/proxy.ts](src/proxy.ts) — convention Next 16, **pas** `middleware.ts` — + `/login`). Validé bout-en-bout sur [docs/](docs/) F-354 + son examen : **44 sections, 20 questions**, `npm run build` vert. Ajouts post-M1 : **PDF d'examen optionnel** (repli sur le PDF du cours s'il l'inclut → `cheminPdfExamen` nullable) et **design system** ([DESIGN.md](DESIGN.md)) appliqué aux 3 écrans. **Prochaine étape : M2** (en attente du plan validé).

- **M1** socle : Next/Prisma/SQLite, écran d'import, extraction PDF, affichage des sections.
- **M2** pipeline d'ingestion IA (correspondance examen↔sections, déduction des réponses, génération fiches/quiz) + agent de vérification.
- **M3** plan d'étude (délai configurable, rythme non bloquant, recalage si jours sautés) + étude quotidienne.
- **M4** répétition espacée (Leitner) + examen blanc noté.
- **M5** Q&A avec source affichée, import du corrigé officiel, suivi de l'usage API.

## Architecture

### Pipeline d'ingestion (cœur du projet)
PDF cours + examen → extraction texte → découpage en sections → correspondance examen↔sections → déduction des bonnes réponses → génération fiches/quiz → **vérification par un agent IA distinct** → parcours prêt. Tourne **une seule fois par cours**, à l'import (coût maîtrisé). `Course.statut` suit l'avancement : `nouveau | extraction | ingestion | verification | pret | erreur`.

### Couche IA — [src/lib/anthropic.ts](src/lib/anthropic.ts)
- Trois modèles configurables par env, choisis selon le besoin de jugement :
  - `INGEST_MODEL` (Opus) — découpage adaptatif + hiérarchisation des notions ; la partie la plus délicate.
  - `VERIFY_MODEL` (Sonnet) — contre-regard : valide l'unicité et l'ancrage de chaque bonne réponse, signale les hallucinations.
  - `QA_MODEL` (Haiku) — Q&A en direct, plus fréquent.
- `getAnthropic()` est lazy ; la clé ne quitte **jamais** le serveur. **Tous les appels IA passent par des routes API serveur.**
- `ApiUsageLog` journalise chaque appel (phase, modèle, tokens).

### Heuristiques M1 — PROVISOIRES, remplacées par l'IA en M2
- [src/lib/sectioning.ts](src/lib/sectioning.ts) : `stripBoilerplate()` (retire pieds/en-têtes CMDQ récurrents) **puis** découpe par titres (numérotés, mots-clés, CAPS), repli par longueur (~2500 car.). Classe en `notion | tableau | diathese | meta`.
- [src/lib/exam-parse.ts](src/lib/exam-parse.ts) : parsing QCM best-effort — format CMDQ `Question N` + options puces `• A` (repli générique `1.` / `A)`). Source : examen séparé, **ou le PDF du cours** si l'examen y est inclus.
- Ne pas sur-investir : placeholders pour « afficher quelque chose ». La vraie découpe adaptative et la hiérarchisation (essentiel / utile / secondaire) sont un travail IA prévu en M2.

### Données — [prisma/schema.prisma](prisma/schema.prisma)
`Course` → `Section`, `StudyUnit` (→ `Fiche`, `Progress`), `Question` (→ `ReviewItem`), `OfficialKey`, `ApiUsageLog`. Conventions SQLite à respecter :
- Pas de tableaux ni d'enums natifs : les listes sont des **String JSON** (`@default("[]")` — ex. `sectionsLiees`, `notionsCles`, `options`, `historique`) ; les « enums » sont des **String documentées** en commentaire (`statut`, `type`, `importance`, `statutValidation`). Toujours `JSON.parse`/`stringify` aux frontières.
- Colonnes **en français** (`statut`, `enonce`, `bonneReponse`…). ⚠️ Ne pas calquer la convention `status` d'autres projets.
- `Course.actif` : un seul cours actif affiché en home.

### Storage — [src/lib/paths.ts](src/lib/paths.ts)
PDF sur disque local sous `storage/courses/<courseId>/`. Les PDF de test réels sont dans [docs/](docs/) — le cours **354 « L'oligothérapie »** (`F-354.pdf` + `F-exam-354.pdf`) est le cas de référence du cahier des charges (20 QCM A/B/C/D, passage 80/100, corrigé officiel reçu le lendemain de la remise).

### Config Next critique — [next.config.ts](next.config.ts)
`serverExternalPackages: ["pdf-parse", "@prisma/client", "prisma"]` — **ne pas retirer** : pdf-parse plante au bundling (il lit un PDF de test quand `module.parent` est absent) et Prisma doit rester externe (reco officielle). Le client Prisma est un singleton ([src/lib/prisma.ts](src/lib/prisma.ts)) pour survivre au hot reload.

## Déploiement

Process Node sur la machine perso (allumée en permanence), exposé par le tunnel Cloudflare existant. Pas d'hébergement tiers, pas de DB distante. `ACCESS_PASSWORD` (env) optionnel pour protéger l'accès public ; vide = app ouverte.

## Méthode de travail (rappel)

- **Diagnostic avant fix** : tracer le chemin d'exécution réel, prouver la cause racine, ne pas traiter les symptômes. En cas de doute, poser une question plutôt que deviner.
- **Plan mode** pour toute tâche non triviale (3+ étapes) : plan cochable dans `tasks/todo.md`, validé **avant** d'implémenter. Si ça dérape, STOP et re-planifier.
- **Anti-régression** : après edit de composants, vérifier rendu/compilation ; chercher les effets de bord (mêmes imports/scope) ; pas de `const` dupliqué. « Un dev senior approuverait-il ce changement ? »
- **Doc + leçons** : après toute tâche, mettre à jour la doc concernée ; après toute correction de l'utilisateur, écrire le pattern dans `tasks/lessons.md` (à relire en début de session).
- **Subagents** pour la recherche/exploration parallèle, afin de garder le contexte principal propre.
