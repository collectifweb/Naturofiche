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
- **@anthropic-ai/sdk** — ingestion IA **branchée** (pipeline M2, [src/lib/ingest/](src/lib/ingest/)) ; sorties structurées par **tool-use forcé** ([`runStructured`](src/lib/anthropic.ts))
- **react-markdown** + **remark-gfm** — rendu des fiches markdown (tableaux GFM) **côté serveur** ([FicheMarkdown](src/components/fiche-markdown.tsx), classe `.fiche-prose`)
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

**M1 → M5 livrés** sur F-354 : le périmètre du cahier est complet. M1 = socle (import, extraction, garde d'accès, PWA, design system). **M2 = pipeline d'ingestion IA branché et validé en live** : découpe adaptative + hiérarchisation essentiel/utile/secondaire, correspondance examen↔sections, déduction des réponses ancrées, génération fiches + mini-quiz + examen blanc, **agent de vérification distinct**, barre de progression réelle. **M3 = plan d'étude + étude quotidienne** : rythme **dérivé** non bloquant avec recalage automatique des jours sautés, tableau de bord, lecture des fiches (markdown + tableaux) et mini-quiz interactif avec progression. **M4 = répétition espacée (Leitner) + examen blanc noté** : boîtes de Leitner sur les mini-quiz, mode révision en fin de parcours, examen blanc 20 QCM noté /100 au seuil 80 %. **M5 = Q&A sourcé + corrigé officiel + suivi API** : Q&A via Haiku serveur avec source affichée, import du corrigé officiel et correction des écarts, page d'usage `ApiUsageLog`.

- **M1** socle : Next/Prisma/SQLite, écran d'import, extraction PDF, affichage des sections. *(validé : convention `proxy.ts` Next 16 **pas** `middleware.ts`)*
- **M2** ✅ pipeline d'ingestion IA ([src/lib/ingest/](src/lib/ingest/)) + agent de vérification. Run live F-354 : **57 sections** (29 essentiel / 18 utile / 2 secondaire / 8 méta), **20/20 questions d'examen** déduites + ancrées (19 validées, 1 flaggée par le vérificateur), **47 fiches**, 94 quiz + 22 examen blanc, **27 appels API** (~279k in / 74k out). `npm run build` vert.
- **M3** ✅ plan d'étude + étude quotidienne. Moteur de plan **dérivé** ([src/lib/plan.ts](src/lib/plan.ts), `computePlan`, sans IA ni écriture) : jour courant, densité recompactée (recalage des jours sautés, plafond jamais dépassé), rythme à jour/avance/retard. Page fiche ([/course/[id]/fiche/[unitId]](src/app/course/%5Bid%5D/fiche/%5BunitId%5D/page.tsx)) : fiche markdown (react-markdown + remark-gfm, tableaux), notions-clés, Q&A contextuel, mini-quiz interactif ([QuizRunner](src/components/quiz-runner.tsx)) avec correction immédiate ; complétion via `POST /api/course/[id]/progress`. **Aucune migration**. Validé F-354 (47 unités ; recalage prouvé : jour 1→11 ⇒ densité 1→3/j, échéance non repoussée).
- **M4** ✅ répétition espacée (Leitner) + examen blanc noté. Moteur Leitner **pur** ([src/lib/leitner.ts](src/lib/leitner.ts), 5 boîtes, intervalles `[1,2,4,7,12]` j). `POST /api/course/[id]/review` upsert les `ReviewItem` ; page [/revision](src/app/course/%5Bid%5D/revision/page.tsx) (notions échues/prioritaires, `QuizRunner mode="revision"`) ; examen blanc [/examen](src/app/course/%5Bid%5D/examen/page.tsx) ([ExamRunner](src/components/exam-runner.tsx), 20 QCM, score /100+/20, seuil 80 %, correction + renvoi section). `plan.modeRevision` met la révision en avant en fin de parcours. **Aucune migration** (`ReviewItem` cascade depuis `Question`).
- **M5** ✅ Q&A avec source affichée, import du corrigé officiel, suivi de l'usage API. `src/lib/qa.ts` fait un retrieval mots-clés (top 4, hors méta), puis `runStructured` phase `qa` / `MODELS.qa`; `/course/[id]/qa` affiche toujours la source (`cours`, `complément extérieur`, `cours + extérieur`). `src/lib/corrige.ts` parse les corrigés souples (paires numérotées, lettres séparées, suite A-D), `/api/course/[id]/corrige` upsert `OfficialKey` et corrige les `examen_officiel`. `/course/[id]/usage` agrège les logs par phase/modèle. **Aucune migration**.
- **M5bis** ✅ Q&A avec recherche web explicite. La recherche web est désactivée par défaut ; l'option « Recherche sur le web » utilise l'outil serveur Anthropic `web_search_20250305` (`max_uses=1`, timeout 30 s, domaines santé/institutionnels autorisés) et affiche les sources web cliquables en plus des sections du cours. Le même panneau Q&A est aussi intégré directement dans les fiches révisables en mode compact, avec les anciennes questions repliées.

## Architecture

### Pipeline d'ingestion (cœur du projet) — [src/lib/ingest/](src/lib/ingest/)
PDF cours + examen → extraction texte → **4 étapes IA** → parcours prêt. Tourne **une seule fois par cours** (coût maîtrisé). Orchestré par `pipeline.ts` → `runIngestion(courseId)` :
1. **`structure.ts`** (Opus) — découpe adaptative + hiérarchisation. Astuce : on envoie le cours en **lignes numérotées** et l'IA renvoie des **plages** (`ligneDebut/ligneFin`) → on tranche le texte verbatim nous-mêmes (sortie compacte, pas de paraphrase).
2. **`answers.ts`** (Opus) — déduction des bonnes réponses + justification ancrée + section source. Sections/questions **indexées** → remap vers les ids DB (pas de matching textuel fragile).
3. **`generate.ts`** (Opus) — unités d'étude (1 par section essentiel/utile, réparties sur le délai, essentiel d'abord), fiches + mini-quiz par lots, réservoir examen blanc à partir des fiches.
4. **`verify.ts`** (Sonnet, **modèle distinct**) — verdict par question : `valide` / `corrige` (applique la correction) / `rejete` (flaggé « à vérifier », exclu, **sans bloquer** le cours).

**Exécution en tâche de fond in-process** : l'import déclenche `triggerIngestion` (fire-and-forget) et rend la main ; le pipeline tourne dans le process Node permanent. `Course.statut` (`nouveau | extraction | ingestion | verification | pret | erreur`) + `etapeIngestion`/`progressPct` suivent l'avancement ; la page cours **poll** `GET /api/course/[id]/status` ([IngestionProgress](src/components/ingestion-progress.tsx)). **Idempotent / re-runnable** : `POST /api/course/[id]/ingest?force=1` purge les artefacts M2 et ré-extrait depuis le PDF disque.

### Plan d'étude & étude quotidienne (M3) — [src/lib/plan.ts](src/lib/plan.ts)
Le rythme est **dérivé à chaque rendu, jamais stocké**. `computePlan(course, units)` (pur, sans IA ni DB) calcule depuis `dateDebut` (jour 1), le plafond `delaiJours` et l'état de complétion : `jourCourant`, `densite = ceil(restantes / joursRestants)` (fiches/jour à tenir), affectation des unités incomplètes aux jours, `echeance`, et le statut de rythme (`a_jour | en_avance | en_retard | termine`). **Le recalage des jours sautés en découle gratuitement** : moins de jours restants ⇒ densité plus haute, l'échéance n'est jamais repoussée — pas de cron, pas de mutate-on-read. M2 avait posé `StudyUnit.jourCible` en répartition provisoire ; le moteur le **remplace** pour la vue vivante.
- **Tableau de bord** [src/app/course/[id]/page.tsx](src/app/course/%5Bid%5D/page.tsx) (cours `pret`) : en-tête plan (jour, barre de complétion, lot du jour, rythme, échéance) + bouton **« Continuer l'étude »** (1re fiche incomplète) + fiches **groupées par jour effectif** ; sections + questions d'examen relégués en **référence repliée** (`<details>`, tout reste accessible — §5.3). La home affiche le même statut + deep-link « Continuer ».
- **Page fiche** [src/app/course/[id]/fiche/[unitId]/page.tsx](src/app/course/%5Bid%5D/fiche/%5BunitId%5D/page.tsx) : fiche markdown rendue **côté serveur** (FicheMarkdown, **tableaux** GFM) + notions-clés (`Chip`) + Q&A contextuel ([QaPanel](src/components/qa-panel.tsx), mode compact, historique de session) + mini-quiz interactif ([QuizRunner](src/components/quiz-runner.tsx), client) : sélection → **correction immédiate** (la justification renvoie à la fiche) → `POST /api/course/[id]/progress` enregistre `Progress.completeLe` + `scoreQuiz` (% du quiz) et renvoie la **fiche suivante** pour enchaîner. Complétion = validation du quiz.

### Répétition espacée & examen blanc (M4) — [src/lib/leitner.ts](src/lib/leitner.ts)
- **Leitner** (pur, sans DB) : 5 boîtes, intervalles `[1, 2, 4, 7, 12]` jours. Bonne réponse ⇒ boîte +1 (max 5) ; mauvaise ⇒ retour boîte 1 ; `prochaineEcheance = aujourd'hui + intervalle(boîte)`. `prioriserRevision` trie boîtes basses d'abord, puis échéance la plus ancienne. Porte sur les **`quiz_verif`** (contrôles par notion) ; les `ReviewItem` sont créés **paresseusement** au 1ᵉʳ passage d'un quiz.
- **`POST /api/course/[id]/review`** (`{ resultats: {questionId, correct}[] }`) — upsert `ReviewItem` (boîte/échéance/historique) ; appelé par [QuizRunner](src/components/quiz-runner.tsx) en mode `fiche` **et** `revision`. Page [/course/[id]/revision](src/app/course/%5Bid%5D/revision/page.tsx) : sert les notions échues (ou prioritaires) en lot de 10, `mode="revision"` (Leitner sans complétion de fiche).
- **Examen blanc** [/course/[id]/examen](src/app/course/%5Bid%5D/examen/page.tsx) : 20 `examen_blanc` `valide` mélangés, [ExamRunner](src/components/exam-runner.tsx) (client) — répondre à tout PUIS noter : **score /100 + /20**, réussite/échec au **seuil 80 %**, correction par question + renvoi à la section. **Sans état** (pas d'historique d'essais persisté). Mis en avant quand `plan.modeRevision` (derniers ~20 % du délai).
- **Re-ingestion** : `ReviewItem` **cascade depuis `Question`** → le purge ([pipeline.ts](src/lib/ingest/pipeline.ts) `question.deleteMany`) les nettoie sans code dédié.

### Q&A, corrigé officiel & usage API (M5)
- **Q&A sans état** : [src/lib/qa.ts](src/lib/qa.ts) normalise sans accents, retire des stopwords FR courts et score les sections par recouvrement (titre ×3, texte ×1), hors `type="meta"`. Les extraits retrouvés sont tronqués et envoyés à `runStructured` (`phase:"qa"`, `model: MODELS.qa`) via [POST `/api/course/[id]/qa`](src/app/api/course/%5Bid%5D/qa/route.ts). La réponse structurée contient `source: "cours" | "exterieur" | "mixte"` et `sectionsCitees`; [QaPanel](src/components/qa-panel.tsx) garde seulement l'historique de session côté client. Il existe en page dédiée `/qa` et en version compacte directement dans les fiches révisables.
- **Q&A web explicite** : le même endpoint accepte `mode:"cours_web"`. Dans ce cas [src/lib/qa.ts](src/lib/qa.ts) appelle directement `anthropic.messages.create` avec `web_search_20250305` au lieu de `runStructured` (sinon le tool-use structuré empêcherait la recherche serveur). Les citations `web_search_result_location` sont extraites des blocs texte et exposées à l'UI ; les textes de pré-recherche sont ignorés. Les domaines sont limités à des sources santé/institutionnelles (`nih.gov`, `ods.od.nih.gov`, `medlineplus.gov`, `msdmanuals.com`, etc.) et `max_uses=1` garde coût/latence raisonnables.
- **Corrigé officiel** : [src/lib/corrige.ts](src/lib/corrige.ts) parse un collage souple de 20 réponses A-D. [POST `/api/course/[id]/corrige`](src/app/api/course/%5Bid%5D/corrige/route.ts) charge les `examen_officiel` ordonnées par `id` asc (numéros 1..20), calcule les écarts, upsert `OfficialKey` (`reponsesImportees`, `ecartsDetectes`, `importeLe`) puis met les questions à la vérité officielle (`bonneReponse`, `statutValidation="valide"`).
- **Usage API** : [src/app/course/[id]/usage/page.tsx](src/app/course/%5Bid%5D/usage/page.tsx) lit `ApiUsageLog.groupBy({ by: ["phase","model"] })`, affiche appels/tokens in/out et total. Les coûts restent hors UI pour éviter une estimation trompeuse.

### Couche IA — [src/lib/anthropic.ts](src/lib/anthropic.ts)
- Trois modèles configurables par env, choisis selon le besoin de jugement :
  - `INGEST_MODEL` (Opus) — découpage adaptatif + hiérarchisation des notions ; la partie la plus délicate.
  - `VERIFY_MODEL` (Sonnet) — contre-regard : valide l'unicité et l'ancrage de chaque bonne réponse, signale les hallucinations.
  - `QA_MODEL` (Haiku) — Q&A en direct, plus fréquent.
- `getAnthropic()` est lazy ; la clé ne quitte **jamais** le serveur. **Tous les appels IA passent par des routes API serveur.**
- `runStructured<T>()` — helper unique : déclare **un seul outil** + `tool_choice` forcé → renvoie l'`input` validé du `tool_use` (pas de parsing de texte libre) et journalise `ApiUsageLog` (phase, modèle, tokens) à chaque appel.

### Heuristiques [src/lib/sectioning.ts](src/lib/sectioning.ts) / [src/lib/exam-parse.ts](src/lib/exam-parse.ts) — fallback rapide à l'import
- `stripBoilerplate()` (retire pieds/en-têtes CMDQ récurrents) est **toujours utilisé** : le pipeline IA s'en sert pour nettoyer le texte avant la découpe. Le découpe-par-titres (`sectionize`) et le parsing QCM (`parseExam`) restent appelés **à l'import** pour une vue immédiate + créer les rangs `examen_officiel` ; **le pipeline M2 purge ensuite ces sections heuristiques et les remplace** par la découpe IA.
- `parseExam` : format CMDQ `Question N` + options puces `• A` (repli générique `1.` / `A)`). Source : examen séparé, **ou le PDF du cours** si l'examen y est inclus.

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

⚠️ **L'ingestion M2 tourne en tâche de fond *dans le même process*** (fire-and-forget après la réponse HTTP). Ça suppose un **serveur Node persistant** (`next start` / `next dev`) — ça ne survivrait pas en serverless (Vercel/Lambda). Comme la cible est justement une machine perso permanente, c'est OK. Si le process redémarre en pleine ingestion, le cours reste en `ingestion` → relancer via `POST /api/course/[id]/ingest?force=1`.

## Méthode de travail (rappel)

- **Diagnostic avant fix** : tracer le chemin d'exécution réel, prouver la cause racine, ne pas traiter les symptômes. En cas de doute, poser une question plutôt que deviner.
- **Plan mode** pour toute tâche non triviale (3+ étapes) : plan cochable dans `tasks/todo.md`, validé **avant** d'implémenter. Si ça dérape, STOP et re-planifier.
- **Anti-régression** : après edit de composants, vérifier rendu/compilation ; chercher les effets de bord (mêmes imports/scope) ; pas de `const` dupliqué. « Un dev senior approuverait-il ce changement ? »
- **Doc + leçons** : après toute tâche, mettre à jour la doc concernée ; après toute correction de l'utilisateur, écrire le pattern dans `tasks/lessons.md` (à relire en début de session).
- **Subagents** pour la recherche/exploration parallèle, afin de garder le contexte principal propre.
