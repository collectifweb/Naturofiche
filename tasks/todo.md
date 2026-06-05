# NaturoFiche — Suivi des tâches

App mono-utilisateur, locale, PWA mobile-first. Ingère un cours CMDQ + son examen
(PDF texte), génère un parcours d'étude court (fiches, quiz, examen blanc) avec
répétition espacée. IA Anthropic côté serveur uniquement.

Cadence : **jalon par jalon**, plan validé avant chaque implémentation.

---

## M1 — Socle technique ✅ livré et validé

Boucle livrée : **import → extraction texte → découpage structurel provisoire → affichage des sections.**

- [x] Scaffold Next.js 16 (App Router, TS, Tailwind v4, `src/`) — Node 20 requis
- [x] shadcn/ui (style base-nova) + composants : button, card, input, label, badge, progress, sonner, separator, chip
- [x] Prisma 6 + SQLite : schéma **complet** (Course, Section, StudyUnit, Fiche, Question, Progress, ReviewItem, OfficialKey, ApiUsageLog) + migration `init` + singleton `src/lib/prisma.ts`
- [x] Libs serveur : `pdf.ts` (extraction), `sectioning.ts` (découpe heuristique), `exam-parse.ts` (QCM), `anthropic.ts` (client lazy + config modèles, non appelé en M1)
- [x] Page `/import` (mobile-first) + API `POST /api/import` (upload → storage local → extraction → sections + questions)
- [x] Page `/course/[id]` (sections + types + nb questions) ; home `/` mono-cours
- [x] PWA : `manifest.webmanifest`, icônes (feuille verte) 192/512/maskable + apple-touch, `sw.js` (network-first), enregistrement en prod
- [x] Garde d'accès optionnelle : `src/proxy.ts` (Next 16) + `/login` + `/api/login` (actif si `ACCESS_PASSWORD`)
- [x] Docs : ce fichier, `lessons.md`, `README.md`, `CLAUDE.md` rempli, `.env.example`, `.gitignore`
- [x] `npm run build` vert (Next 16 / Turbopack)
- [x] Test bout-en-bout sur `docs/F-354.pdf` + `docs/F-exam-354.pdf` (44 sections, **20** questions)
- [x] git init + commit initial (`6bc3c60`)

### Notes M1
- Découpage **volontairement grossier** : l'objectif M1 est « afficher des sections », pas la qualité finale (c'est M2).
- En M1, le statut d'un cours passe directement à `pret` après extraction (pas encore d'ingestion IA).
- Les questions d'examen sont stockées en `type=examen_officiel`, `bonneReponse` null (déduite en M2 / importée en M5).

### Review M1

Testé de bout en bout sur le cours **354 « L'oligothérapie »** (108 p.) + son examen (10 p.) :

- **Examen → 20/20 questions** extraites, chacune avec 4 options A/B/C/D propres. Le format réel CMDQ
  diffère de l'hypothèse initiale (`Question 1` + options `• A …`, pas `1.` / `A)`), avec une grille de
  réponse et du boilerplate à ignorer — parseur corrigé en conséquence.
- **Cours → 44 sections** (notion 38, tableau 5, diathèse 1). Le découpage initial donnait 92 sections
  polluées par les pieds de page « N - Manuel pédagogique » pris pour des titres → ajout d'un
  `stripBoilerplate()` (motifs CMDQ + règle générique sur lignes courtes récurrentes) qui nettoie
  aussi le texte pour M2. Les gros chapitres ne sont pas encore sous-découpés (attendu : c'est le rôle
  de l'IA en M2).
- **Routes HTTP** : `/`, `/course/[id]`, `/import`, `/manifest.webmanifest`, `/sw.js`, icônes → 200.
- **Garde d'accès** prouvée : sans cookie → 307 vers `/login` ; mauvais mot de passe → 401 ; bon mot de
  passe → cookie `nf_auth` → 200.

**Limites assumées M1** : découpage volontairement grossier (sous-sections d'oligoéléments non isolées,
« Introduction » court parfois classé `tableau`), pas d'ingestion IA ni de hiérarchisation
essentiel/utile/secondaire — tout cela est le cœur de **M2**.

**Prérequis machine** : Node 20+ (Next 16). Le serveur permanent doit tourner sous Node 20.

---

## Post-M1 (avant M2) ✅

- [x] **PDF d'examen optionnel** à l'import : si aucun fichier d'examen, on cherche les QCM dans le PDF
  du cours (repli) ; `cheminPdfExamen` rendu nullable (migration `exam_optional`). Testé : cours seul → 200,
  cours + examen → 20 questions (pas de régression).
- [x] **Fix hydratation** : `suppressHydrationWarning` sur `<html>` (attributs injectés par extensions navigateur).
- [x] **Passe design** : design system [DESIGN.md](../DESIGN.md) / [PRODUCT.md](../PRODUCT.md) appliqué — tokens
  `oklch` papier chaud + vert herbacé dans `globals.css`, polices Geist / Source Serif 4, composant `Chip`
  (essentiel/utile/secondaire), thème **clair only**, restyle des 3 écrans. `tsc` + `build` verts.
- [x] **Doc-sync** : README / CLAUDE / tasks réconciliés avec le code avant compaction.

---

## M2 — Pipeline d'ingestion IA + agent de vérification ✅ livré et validé

Pipeline [src/lib/ingest/](../src/lib/ingest/) en **4 étapes**, tâche de fond in-process, sortie structurée par tool-use.

- [x] **Migration** `m2_ingestion_progress` : `Course.etapeIngestion`, `progressPct`, `erreurMessage`
- [x] **`runStructured`** ([src/lib/anthropic.ts](../src/lib/anthropic.ts)) : tool-use forcé + journalisation `ApiUsageLog`
- [x] **Étape 1 — `structure.ts`** (Opus) : découpe adaptative + hiérarchisation essentiel/utile/secondaire (lignes numérotées → plages de lignes)
- [x] **Étape 2 — `answers.ts`** (Opus) : déduction des réponses + justification ancrée + section source (indexation → ids DB)
- [x] **Étape 3 — `generate.ts`** (Opus) : unités d'étude réparties sur le délai, fiches + mini-quiz, réservoir examen blanc
- [x] **Étape 4 — `verify.ts`** (Sonnet, modèle distinct) : verdict valide/corrige/rejete, sans bloquer le cours
- [x] **Endpoints** : `POST /api/course/[id]/ingest` (fire-and-forget, `?force=1`), `GET …/status` (polling) ; import → `statut=ingestion` + trigger
- [x] **UI** : [IngestionProgress](../src/components/ingestion-progress.tsx) (barre + polling + relance) ; page cours = progression OU contenu hiérarchisé (Chip importance, réponses + justif + source, fiches)
- [x] **Idempotent / re-runnable** : purge des artefacts M2 + ré-extraction depuis le PDF disque
- [x] `npm run build` vert + `eslint` clean

### Review M2 (run live F-354, ~13 min, Opus + Sonnet)
- **57 sections** : 29 essentiel · 18 utile · 2 secondaire · 8 méta (exclus). Diathèses (7) et tableaux (7) bien isolés.
- **20/20 questions d'examen** déduites, **20/20 ancrées** à une section (critère §12) ; **19 validées + 1 rejetée** par le vérificateur (flaggée « à vérifier », comportement attendu). Réponses équilibrées A6/B4/C5/D5.
- **47 fiches** (1 par unité essentiel/utile) + 94 quiz de vérif + 22 examen blanc. Validation globale : 131 valides / 5 rejetés.
- **Coût** : 27 appels (15 Opus ingestion + 12 Sonnet vérif), ~279k in / 74k out tokens (~8 $) — one-time, maîtrisé.

**Limites assumées M2** : la vérification se concentre sur les questions (chemin critère §12) ; l'audit d'hallucination des fiches est léger (le quiz d'une fiche sert de garde indirecte). Régénération = la correction proposée par le vérificateur (pas de 2ᵉ passe Opus). La distribution `jourCible` est provisoire (répartition uniforme essentiel d'abord) — le **rythme non bloquant + recalage = M3**.

## M2bis (idées si besoin)
- 2ᵉ passe de régénération Opus pour les questions `rejete` persistantes.
- Audit d'hallucination dédié des fiches (section source vs contenu).

## M3 — Plan d'étude + étude quotidienne ✅ livré et validé

Rythme **dérivé** (recalculé à chaque rendu, jamais stocké) + lecture de fiche + mini-quiz interactif. **Aucune migration** (tout le modèle existait déjà).

- [x] **Moteur de plan** [src/lib/plan.ts](../src/lib/plan.ts) (`computePlan`, pur) : jour courant, densité recompactée (`ceil(restantes/joursRestants)`), affectation des unités incomplètes aux jours, échéance, rythme (à jour/avance/retard/terminé). Recalage des jours sautés **automatique et sans écriture**.
- [x] **Rendu markdown** : `react-markdown` + `remark-gfm` (tableaux), [FicheMarkdown](../src/components/fiche-markdown.tsx) (RSC) + classe `.fiche-prose` ([globals.css](../src/app/globals.css), lecture serif).
- [x] **Mini-quiz interactif** [QuizRunner](../src/components/quiz-runner.tsx) (client) : sélection → correction immédiate + justification (renvoi à la fiche) → enregistrement complétion + score.
- [x] **Endpoint** `POST /api/course/[id]/progress` ([route](../src/app/api/course/%5Bid%5D/progress/route.ts)) : upsert `Progress` (`completeLe`+`scoreQuiz`) + renvoie la fiche incomplète suivante.
- [x] **Page fiche** [/course/[id]/fiche/[unitId]](../src/app/course/%5Bid%5D/fiche/%5BunitId%5D/page.tsx) : fil d'Ariane, fiche markdown, notions-clés, mini-quiz, navigation préc./suiv.
- [x] **Tableau de bord** [/course/[id]](../src/app/course/%5Bid%5D/page.tsx) : en-tête plan + « Continuer l'étude » + fiches groupées par jour effectif + référence (sections/examen) repliée. Home enrichie (statut plan + deep-link « Continuer »).
- [x] `npm run build` vert + `eslint` clean + `tsc` OK.

### Review M3 (vérif sur F-354 déjà ingéré, 47 unités, délai 30)
- **Tableau de bord** : « Jour 1 / 30 », lot du jour (≈ 2 fiches : 47/30), échéance, rythme « à jour », bouton « Continuer ».
- **Page fiche** : markdown rendu **avec tableaux GFM** (besoins particuliers, aliments riches — cahier §10 : 1 `<table>`, 3 `<th>`, 26 `<td>`), mini-quiz interactif, nav préc./suiv.
- **Complétion** : `POST …/progress` → `Progress.completeLe`+`scoreQuiz=100` écrits, `prochaineFicheId` renvoyé pour enchaîner. (Reset après test → état post-ingestion vierge.)
- **Recalage §12 prouvé** : rétro-datage `dateDebut` de 10 j → « Jour 11 / 30 », densité **1 → 3 fiches/jour** (`ceil(47/20)`), échéance = start+29 **non repoussée** (plafond 30 j respecté). `dateDebut` restauré.

**Limites assumées M3** : l'examen blanc (réservoir déjà généré en M2) n'est pas encore **passable/noté** — c'est M4. Le délai est fixé à l'import (édition post-import = amélioration optionnelle). Pas de bascule « mode révision » de fin de parcours (Leitner = M4).

## M4 — Répétition espacée + examen blanc ✅ livré et validé

Boîtes de Leitner sur les `quiz_verif` + examen blanc noté. **Aucune migration** (`ReviewItem` existait déjà, cascade depuis `Question`).

- [x] **Moteur Leitner** [src/lib/leitner.ts](../src/lib/leitner.ts) (pur) : 5 boîtes, intervalles `[1,2,4,7,12]` j, `prochaineBoite` (+1 si juste / retour 1 si faux), `dateEcheance`, `estEchu`, `prioriserRevision` (boîtes basses puis plus anciennes).
- [x] **Endpoint** `POST /api/course/[id]/review` ([route](../src/app/api/course/%5Bid%5D/review/route.ts)) : upsert `ReviewItem` (boîte, échéance, historique) par notion ; renvoie le nb d'échus.
- [x] **QuizRunner généralisé** ([quiz-runner](../src/components/quiz-runner.tsx)) : prop `mode` `fiche | revision` — alimente Leitner dans les deux modes ; mode fiche garde la complétion (progress).
- [x] **Page révision** [/course/[id]/revision](../src/app/course/%5Bid%5D/revision/page.tsx) : sert les notions échues (sinon les prioritaires) en lot de 10, mode `revision`.
- [x] **Examen blanc noté** [ExamRunner](../src/components/exam-runner.tsx) + page [/course/[id]/examen](../src/app/course/%5Bid%5D/examen/page.tsx) : 20 QCM mélangés, répondre à tout → **score /100 + /20 + réussite/échec (seuil 80 %)** + correction renvoyant à la section.
- [x] **Mode révision** : `plan.modeRevision` (derniers ~20 % du délai ou terminé) → CTA « Réviser » (badge échus) + « Examen blanc » sur le dashboard, mis en avant ; lien examen sur la home.
- [x] `npm run build` vert + `eslint` + `tsc`.

### Review M4 (vérif sur F-354 ingéré)
- **Leitner** : `POST …/review` (1 juste / 1 faux) → `ReviewItem` créés (boîte 2 / boîte 1), échéance = +2 j / +1 j, `historique` rempli. Re-tests OK.
- **Mode révision** : `dateDebut` rétro-daté à J-24 → « Jour 25 / 30 » + encart « Dernière ligne droite », révision en CTA primaire. `/revision` sert les notions priorisées. Date restaurée.
- **Examen blanc** : `/examen` → 20 QCM ; score `bons/total` → /100 + /20, verdict ≥ 80 % ; correction + renvoi section.
- **Cascade** : migration confirme `ReviewItem … ON DELETE CASCADE` → le purge de re-ingestion (`question.deleteMany`) nettoie les `ReviewItem`. ReviewItem de test supprimés (état vierge).

**Limites assumées M4** : l'examen blanc est **sans état** (score calculé + affiché, pas d'historique d'essais persisté — évite une migration ; §12 ne demande que le score + verdict). Les `examen_blanc` restent hors Leitner (jeu distinct des `quiz_verif`). La révision porte sur les notions **déjà vues** (les non-vues passent par les fiches).

## M5 — Q&A + corrigé officiel + suivi API ✅ livré

> Spec d'implémentation **autonome** : [tasks/M5-plan.md](M5-plan.md) (à dérouler dans une session fraîche).

Contraintes M5 à garder visibles :
- [x] **Aucune migration** (`OfficialKey` + `ApiUsageLog` existent ; Q&A sans état).
- [x] Commandes Node avec `export PATH="/home/alexandre/.nvm/versions/node/v20.20.2/bin:$PATH";`.
- [x] IA strictement serveur : Q&A via route API + `runStructured`, jamais côté client.
- [x] Routes Next 16 : `params: Promise<{ id: string }>` + `dynamic = "force-dynamic"` ; liens boutons via `buttonVariants`, sans `asChild`.

Plan d'implémentation à valider avant de coder :
- [x] **Q&A lib** : créer `src/lib/qa.ts` avec retrieval mots-clés pur (`Section`, top 4, exclusion `meta`) + appel `runStructured` phase `qa`, modèle `MODELS.qa`, schéma `{ reponse, source, sectionsCitees }`.
- [x] **Q&A API/UI** : ajouter `POST /api/course/[id]/qa`, garde cours `pret`, remap des sections citées ; créer `QaPanel` client avec historique local, badge source (`cours` / `complément extérieur` / `cours + extérieur`) et page `/course/[id]/qa`.
- [x] **Corrigé lib** : créer `src/lib/corrige.ts` avec `parseCorrige` robuste (paires numérotées, suite de 20 lettres, lettres séparées) + `calculerEcarts` selon les `examen_officiel` ordonnées par `id`.
- [x] **Corrigé API/UI** : ajouter `POST /api/course/[id]/corrige` (upsert `OfficialKey`, journalisation JSON des écarts, correction des `bonneReponse`, `statutValidation="valide"`), composant `CorrigeImport` avec aperçu local, toast et page `/course/[id]/corrige`.
- [x] **Usage API** : ajouter page `/course/[id]/usage` qui agrège `ApiUsageLog` par `phase`/`model` avec appels, tokens in/out et total.
- [x] **Câblage dashboard** : ajouter une section « Outils » sur `/course/[id]` avec liens Q&A, Corrigé officiel et Usage API, en respectant le design mobile-first.
- [x] **Vérifications automatisées** : lancer `npm run lint`, `npx tsc --noEmit`, `npm run build` sous Node 20.
- [x] **Vérif live F-354** (`cmq0xcvix0000osbydme0whft`, `http://localhost:3000`) : tester Q&A zinc, import corrigé avec 2 écarts puis restaurer l'état, vérifier page usage et ligne `qa`.
- [x] **Docs de fin** : cocher M5 + Review dans ce fichier, ajouter les leçons M5, mettre à jour `CLAUDE.md` et `README.md` en marquant NaturoFiche complet M1→M5.
- [x] **Git** : commit conventionnel sans attribution IA ; ne pas pousser sans demande explicite.

### Review M5 (vérif sur F-354 ingéré)
- **Q&A** : `/course/cmq0xcvix0000osbydme0whft/qa` répond 200 ; `POST /api/course/cmq0xcvix0000osbydme0whft/qa` avec « Quels sont les signes de carence en zinc ? » → réponse sur les signes de carence, `source="cours"`, section citée « Zinc (Zn) ». L'appel a journalisé 1 ligne `qa` (`claude-haiku-4-5-20251001`, 2 778 in / 252 out).
- **Corrigé officiel** : `POST /api/course/cmq0xcvix0000osbydme0whft/corrige` avec 20 réponses dont 2 modifiées → `total=20`, `ecarts=2`, `OfficialKey` créée avec 20 réponses + 2 écarts, réponses 1/2 corrigées. État restauré ensuite : `OfficialKey=null`, réponses 1/2 revenues à D/A, question #8 revenue à `statutValidation="rejete"`.
- **Usage API** : `/course/cmq0xcvix0000osbydme0whft/usage` répond 200 et agrège les logs : ingestion 15 appels / 194 146 in / 60 393 out ; Q&A 1 appel / 2 778 in / 252 out ; vérification 12 appels / 84 915 in / 13 438 out ; total 28 appels / 281 839 in / 74 083 out.
- **Validation technique** : `npm run lint`, `npx tsc --noEmit`, `npm run build` verts sous Node 20. Le build a nécessité l'accès réseau pour `next/font` (polices Google), puis a compilé toutes les routes M5.

**Limites assumées M5** : Q&A sans historique persistant et sans embeddings (retrieval lexical), pas de web live (repli sur connaissances du modèle), pas d'estimation de coût affichée pour éviter des prix obsolètes.

## M5bis — Q&A avec recherche web ✅ livré

Objectif : enrichir le Q&A sans contaminer le mode d'étude par défaut.

- [x] **Mode explicite** : garder `cours seulement` par défaut ; ajouter `cours + web` dans l'UI Q&A.
- [x] **Serveur uniquement** : ajouter un appel Anthropic avec outil serveur `web_search_20250305`, `max_uses` limité, journalisé en phase `qa`.
- [x] **Sources visibles** : afficher les sections du cours citées + les sources web retournées (titre/URL si disponibles).
- [x] **Usage** : la page `/usage` doit refléter l'appel `qa` web via `ApiUsageLog`.
- [x] **Validation** : lint, `tsc --noEmit`, build, smoke test live F-354.
- [x] **Docs + git** : mettre à jour README/CLAUDE/lessons/todo, commit local sans push automatique.

### Review M5bis (vérif sur F-354)
- **Mode explicite** : `/course/cmq0xcvix0000osbydme0whft/qa` garde `Cours seulement` par défaut et propose `Cours + web` comme choix volontaire.
- **Web search** : `POST /api/course/cmq0xcvix0000osbydme0whft/qa` avec `mode="cours_web"` et « Le zinc est-il encore recommandé aujourd'hui pour soutenir l'immunité ? » → réponse `source="mixte"`, sections cours citées (Application symptomatique, Zinc, Cuivre-Zinc) + sources web NIH/PMC/MSD. Latence observée après limitation : ~7 s.
- **Garde coût/latence** : outil serveur `web_search_20250305`, `max_uses=1`, timeout SDK 30 s, domaines autorisés santé/institutionnels (`nih.gov`, `ods.od.nih.gov`, `medlineplus.gov`, `msdmanuals.com`, etc.).
- **Usage API** : Q&A total sur F-354 = 3 appels / 31 789 in / 1 258 out ; total cours = 30 appels / 310 850 in / 75 089 out.
- **Validation technique** : `npm run lint`, `npx tsc --noEmit`, `npm run build` verts sous Node 20.

**Limites assumées M5bis** : pas de persistance d'historique web, pas de coût web dédié en DB (le schéma ne stocke que tokens/appels par phase), et sources web contraintes à des domaines fiables plutôt qu'à tout le web.
