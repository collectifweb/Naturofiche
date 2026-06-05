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

## Design / CSS (Tailwind v4 + shadcn base-nova)

- **lightningcss convertit `oklch()` en `#hex` + `lab()`** dans le CSS compilé. → inutile de grep les
  valeurs `oklch` dans le build pour vérifier la palette : chercher les hex (`--primary:#007838`) ou `lab()`.
- **Mapping de police du scaffold cassé** : le `@theme` généré avait `--font-sans: var(--font-sans)` (auto-
  référence dans le vide) alors que le layout définit `--font-geist-sans`. Corrigé : `--font-sans:
  var(--font-geist-sans)`, `--font-serif: var(--font-source-serif)`. Vérifier ce mapping après un init shadcn.
- **La `Card` base-nova colle déjà à un design « plat »** : `ring-1 ring-foreground/10` (= liseré 1px) + pied
  `bg-muted/50`, **aucune ombre**. Le simple swap des tokens `:root` warm-ifie tout sans toucher aux composants.
- **Thème clair only** : ne pas ajouter de classe `.dark` ni next-themes toggle ; poser `color-scheme: light`.

## Architecture

- SQLite via Prisma : **pas de tableaux ni d'enums natifs** → listes en `String` JSON, enums en `String`
  documentés par commentaire.
- Clé API Anthropic : client **lazy** (`getAnthropic()`) pour ne pas échouer à l'import quand la clé est
  absente, et rester strictement côté serveur.

## Pipeline IA (M2)

- **Sortie structurée = tool-use forcé, pas du JSON en texte libre.** `runStructured()` déclare **un seul
  outil** + `tool_choice: { type:"tool", name }` et lit l'`input` validé du bloc `tool_use`. Zéro parsing
  fragile, et le modèle est contraint au schéma. Types SDK 0.100.1 : `Anthropic.Messages.Tool.InputSchema`
  et `Anthropic.Messages.Usage`. Comme les schémas locaux sont en `as const` (`required` devient un tuple
  *readonly*), typer le param `schema` en `Record<string, unknown>` et **caster** `as
  Anthropic.Messages.Tool.InputSchema` au point d'appel SDK (sinon erreur readonly→mutable).
- **Ne PAS faire ré-émettre le texte des sections au modèle** (coûteux + risque de paraphrase). Envoyer le
  cours en **lignes numérotées** et demander des **plages** (`ligneDebut/ligneFin`) ; trancher le texte
  verbatim côté serveur. Sortie compacte, ancrage fidèle.
- **Indexer, ne pas matcher par texte.** Pour relier réponses↔questions et réponses↔sections, passer des
  index (`#0..n`) et remapper vers les ids DB. Évite le matching par énoncé (fragile, doublons). Les rangs
  `examen_officiel` créés à l'import sont **réutilisés** par le pipeline (pas de `numero` en base).
- **Ingestion = tâche de fond in-process.** L'import `await` juste le passage en `statut=ingestion` puis
  lance `runIngestion` **sans l'attendre** (`void …catch`). La promesse survit à la réponse HTTP **parce que
  le process Node est permanent** (`next dev`/`next start`) — pas en serverless. La page cours **poll**
  `GET …/status`. Le job ne **jette jamais** : il écrit l'erreur dans `Course.statut="erreur"` +
  `erreurMessage`, et `?force=1` relance proprement (purge + ré-extraction depuis le PDF disque).
- **Le pipeline purge puis remplace les sections heuristiques** de l'import. Donc créer ces sections à
  l'import sert juste de vue immédiate/fallback ; `stripBoilerplate` reste utile (nettoyage avant la découpe IA).
- **Barre de progression « réelle » sans sur-ingénierie** : `progressPct` par bornes d'étape (5/45/65/88/100)
  + `etapeIngestion` (label). Pas de sous-progression fine ; les `counts` (sections/questions/unités) montent
  visiblement pendant la génération.
- **Coût d'une ingestion** (108 p., Opus ingestion + Sonnet vérif) : ~27 appels, ~279k in / 74k out tokens,
  ~13 min, ~8 $. **Batching** indispensable (fiches par lots de 4, examen blanc à partir des fiches plutôt
  que du cours brut, vérif par lots de 12) — sinon des dizaines d'appels en plus.
- **Inspection DB hors Next** : `node --env-file=.env script.mjs` **depuis la racine du projet** (résout
  `@prisma/client` via le `node_modules` du projet) ; un script placé dans `/tmp` échoue en
  `ERR_MODULE_NOT_FOUND`. Ne pas committer le script jetable (le supprimer après).

## Plan d'étude & étude quotidienne (M3)

- **Plan dérivé > plan stocké.** Recalculer le rythme à chaque rendu (`computePlan`, pur) plutôt que de
  stocker/mettre à jour `jourCible` : le **recalage des jours sautés tombe gratuitement** de
  `densite = ceil(restantes / joursRestants)` (moins de jours restants ⇒ densité plus haute, échéance
  jamais repoussée). Zéro cron, zéro mutate-on-read (un GET ne doit pas écrire). M2 avait posé `jourCible`
  en provisoire ; M3 ne le touche pas, il dérive le jour effectif.
- **Diff de jours insensible à l'heure.** `dateDebut` est posé à l'`import` (avec son heure) ; pour que le
  « jour courant » ne saute pas selon l'heure, comparer des **dates à minuit** :
  `Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)` puis différence d'index.
- **Tableaux markdown = `remark-gfm` obligatoire.** Sans le plugin, les tables `| … |` du cours (besoins
  particuliers, aliments riches — porteuses de réponses d'examen) s'affichent en texte brut. `react-markdown`
  se rend **en RSC** (aucun poids client) ; styles dans une classe `.fiche-prose` (globals.css) plutôt que le
  plugin `@tailwindcss/typography`, pour rester sur la charte (lecture serif, un seul vert, tables sur tokens).
- **Options de quiz = `<button>` nu, pas le composant `Button`.** Le `Button` base-nova porte des styles
  d'action ; un choix de QCM a besoin d'états propres (sélectionné / bon / mauvais / révélé) → bouton simple
  stylé à la main avec les tokens `green-wash`/`green-ink` (bon) et `brick-wash`/`destructive` (mauvais choisi).
- **Vérifier un recalage temporel sans voyager dans le temps** : rétro-dater `Course.dateDebut` via un script
  Prisma jetable, curler la page, vérifier le jour courant + la densité, puis **restaurer** la date.

## Répétition espacée & examen blanc (M4)

- **Pas de migration si le modèle anticipait le jalon.** `ReviewItem` était déjà au schéma (posé en M1) et
  **cascade depuis `Question`** (`onDelete: Cascade`) → le purge de re-ingestion (`question.deleteMany`)
  nettoie les `ReviewItem` **gratuitement**. Vérifier la cascade par la migration SQL plutôt que par un test
  destructif (`grep "ReviewItem" prisma/migrations/*/migration.sql | grep CASCADE`).
- **Créer les `ReviewItem` paresseusement** (au 1ᵉʳ passage d'un quiz), pas en masse à l'ingestion : ça évite
  de faire apparaître en révision des notions dont la fiche n'a pas encore été lue, et ça colle au sens du
  cahier (« les notions **vues** réapparaissent »). Boîte de départ après réponse = `prochaineBoite(1, correct)`.
- **Généraliser plutôt que dupliquer.** Le mini-quiz (correction immédiate) sert aussi la révision : un prop
  `mode: "fiche" | "revision"` suffit (révision = Leitner sans complétion de fiche). Mais l'**examen blanc** a
  une interaction différente (répondre à TOUT puis noter) → composant **distinct** (`ExamRunner`), ne pas forcer
  le même composant. Règle : même interaction → un prop ; interaction différente → composant séparé.
- **Score calculable côté client = pas de table.** Les `examen_blanc` portent déjà `bonneReponse` ; le score
  /100 + /20 + verdict 80 % se calcule dans le composant. Garder l'examen **sans état** (pas d'historique
  d'essais) tant que le cahier ne demande que le score + le verdict — une table = une migration à ne pas payer.
- **`modeRevision` dérivé** (comme le plan) : `termine || joursRestants ≤ ceil(delaiJours·0,2)`. Sert à
  **mettre en avant** la révision dans les derniers jours, sans jamais la bloquer le reste du temps.
- **Tirage varié** d'un examen : `Math.random` est OK dans un composant Server Next (≠ script Workflow où il est
  interdit) ; `router.refresh()` côté client redéclenche le rendu serveur → nouveau mélange de 20 questions.
