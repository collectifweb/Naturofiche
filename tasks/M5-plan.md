# M5 — Spécification d'implémentation (handoff)

> Doc **autonome** pour exécuter le dernier jalon **M5** dans une session fraîche.
> M1→M4 sont livrés, validés, committés et poussés sur `origin/main`.
> Source faisant autorité : [`cahier-des-charges-app-etude.md`](../cahier-des-charges-app-etude.md) §5.6, §5.8, §11, §12.
> Lire d'abord [`CLAUDE.md`](../CLAUDE.md), [`tasks/lessons.md`](lessons.md) et [`DESIGN.md`](../DESIGN.md).

## Objectif

M5 = les 3 dernières fonctions :
1. **Questions-réponses avec source** (§5.6) — poser une question sur le cours ; réponse priorisée sur le contenu ingéré, repli sur les connaissances du modèle ; **la source est toujours indiquée** (critère §12 : « les réponses affichent leur source : cours ou extérieur »).
2. **Import du corrigé officiel** (§5.8) — après la remise, importer le corrigé de l'école ; comparer aux réponses déduites par l'IA, corriger les écarts et les journaliser (`OfficialKey`).
3. **Suivi de l'usage API** (§11) — tableau lisant `ApiUsageLog` (déjà rempli depuis M2).

## Décisions cadrées (NE PAS re-débattre)

- **Aucune migration.** `OfficialKey` et `ApiUsageLog` existent déjà au schéma ([prisma/schema.prisma](../prisma/schema.prisma)). Le Q&A est **sans état** (aucune table d'historique). Confirmer avec `prisma generate` seulement si besoin ; ne PAS lancer `migrate`.
- **Q&A retrieval = mots-clés** (pas d'embeddings) : suffisant pour un mono-utilisateur SQLite. Repli = **connaissances du modèle** (PAS de web live — le cahier autorise « le web *ou* les connaissances du modèle »). Mentionner le web search comme amélioration future.
- **Q&A modèle = `MODELS.qa`** (Haiku) via `runStructured` ([src/lib/anthropic.ts](../src/lib/anthropic.ts)) → journalise `ApiUsageLog` phase `qa` automatiquement.
- **Corrigé = collage + parse souple** (pas d'upload PDF) : 20 lettres A–D, robuste.
- **Pas de persistance d'historique Q&A** ; liste en mémoire côté client pour la session courante.

## Modèles existants à réutiliser (déjà au schéma)

- `OfficialKey` : `courseId @unique`, `reponsesImportees String` (JSON), `ecartsDetectes String @default("[]")` (JSON), `importeLe DateTime`. Relation `Course.officialKey`.
- `ApiUsageLog` : `courseId?`, `phase` (`ingestion|verification|qa`), `model`, `inputTokens`, `outputTokens`, `createdAt`. Déjà écrit par `runStructured` à chaque appel IA.
- `Question` (type `examen_officiel`) : `enonce`, `options` (JSON `{key,text}[]`), `bonneReponse` (`A|B|C|D`, déduite par l'IA), `justification`, `sectionSourceId`, `statutValidation`. **Numérotation** : les `examen_officiel` ordonnées par `id` asc = numéro 1..20 (c'est l'ordre d'affichage actuel dans [src/app/course/[id]/page.tsx](../src/app/course/%5Bid%5D/page.tsx)).
- `Section` : `titre`, `texte`, `type`, `importance`, `ordre`.

## `runStructured` (rappel de signature)

```ts
// src/lib/anthropic.ts
runStructured<T>({ phase, courseId, model, system, prompt,
  toolName, toolDescription, schema, maxTokens }): Promise<T>
// phase: "ingestion" | "verification" | "qa" ; force un tool-use unique,
// renvoie l'input validé, journalise ApiUsageLog. MODELS = { ingest, verify, qa }.
// schema typé Record<string,unknown> ; les littéraux `as const` passent tels quels.
```

---

## 1) Q&A avec source (§5.6)

### `src/lib/qa.ts` (NOUVEAU, retrieval + appel IA)
- `rechercherSections(question, sections, topN = 4)` — **pur** : normaliser (minuscules, sans accents), tokeniser, retirer les stopwords FR courts, scorer chaque section par recouvrement de termes (titre ×3 + texte ×1), renvoyer les `topN` meilleures (exclure `type === "meta"`). Réutiliser l'esprit de `stripBoilerplate`/normalisation déjà présent dans [src/lib/sectioning.ts](../src/lib/sectioning.ts) si utile.
- `repondreQuestion(courseId, question, sections)` — appelle `runStructured` (`phase:"qa"`, `model: MODELS.qa`) avec en contexte les sections retrouvées (titre + texte tronqué ~1500 c.). Schéma de sortie :
  ```
  { reponse: string,
    source: "cours" | "exterieur" | "mixte",
    sectionsCitees: number[]  // indices (#0..n) des sections fournies réellement utilisées
  }
  ```
  Système : « Réponds à l'étudiant en t'appuyant D'ABORD sur les extraits du cours fournis. Si l'info n'y est pas, complète avec tes connaissances et marque la source en conséquence. N'invente pas d'ancrage : `cours` seulement si la réponse vient des extraits. »

### `src/app/api/course/[id]/qa/route.ts` (NOUVEAU)
`POST { question }` → charge les sections du cours, `rechercherSections`, `repondreQuestion`, renvoie `{ reponse, source, sections: [{id, titre}] }` (remap des indices `sectionsCitees` → titres). `runtime nodejs`, `dynamic force-dynamic`. Garde : cours `pret`.

### `src/components/qa-panel.tsx` (NOUVEAU, client)
Champ question + bouton « Demander » → POST → empile la paire Q/R dans une liste (état local). Chaque réponse affiche un badge **source** : `cours` (Chip vert `essentiel`), `complément extérieur` (Chip `secondaire`), `cours + extérieur` (Chip `utile`) + la liste des sections citées. Markdown léger optionnel (réutiliser [FicheMarkdown](../src/components/fiche-markdown.tsx) si la réponse contient du markdown).

### `src/app/course/[id]/qa/page.tsx` (NOUVEAU, server)
Garde `pret`, fil d'Ariane vers le cours, titre, rend `<QaPanel courseId />`.

---

## 2) Import du corrigé officiel (§5.8)

### `src/lib/corrige.ts` (NOUVEAU, pur)
- `parseCorrige(texte): { numero, reponse }[]` — accepter formats souples : `1. A` / `1) A` / `1 A` / `1A` (un par ligne), OU une suite de 20 lettres `ABCD…`, OU lettres séparées par espaces/virgules. Stratégie : d'abord extraire les paires (nombre, lettre A–D) ; sinon, séquence de lettres A–D autonomes → numérotées 1..n. Valider lettre ∈ {A,B,C,D}.
- `calculerEcarts(reponses, questionsOrdonnees): { numero, questionId, ia, officiel, ecart }[]` — pour chaque `numero`, retrouver la question (index `numero-1`), comparer `bonneReponse` (IA) vs `officiel`.

### `src/app/api/course/[id]/corrige/route.ts` (NOUVEAU)
`POST { reponses: {numero, reponse}[] }` → charger les `examen_officiel` ordonnées par `id` asc → `calculerEcarts` → **upsert `OfficialKey`** (`reponsesImportees` = JSON des réponses, `ecartsDetectes` = JSON des écarts, `importeLe = now`) → **mettre à jour `bonneReponse`** des questions pour matcher l'officiel (et `statutValidation = "valide"`, c'est désormais la vérité de référence) → renvoyer `{ total, ecarts: n, corriges }`. Garde : cours `pret`.

### `src/components/corrige-import.tsx` (NOUVEAU, client)
Textarea (collage) → bouton « Analyser » (parse local, aperçu : tableau numéro / réponse officielle / réponse IA actuelle / écart) → bouton « Appliquer le corrigé » → POST → toast récap (`N corrigées, M écarts`) + `router.refresh()`.

### `src/app/course/[id]/corrige/page.tsx` (NOUVEAU, server)
Garde `pret`. Si `OfficialKey` déjà importé, afficher un récap (date, nb écarts). Rendre `<CorrigeImport courseId questions={examenOfficielMini} />` (passer `[{numero, enonce, bonneReponseIA}]`).

> Après import, la **section « Questions d'examen » du dashboard** ([page cours](../src/app/course/%5Bid%5D/page.tsx)) reflète déjà les `bonneReponse` corrigées (elle lit la DB). Optionnel : y marquer « corrigé officiel appliqué ».

---

## 3) Suivi de l'usage API (§11)

### `src/app/course/[id]/usage/page.tsx` (NOUVEAU, server)
Agréger `ApiUsageLog` du cours via `prisma.apiUsageLog.groupBy({ by: ["phase","model"], _sum: { inputTokens, outputTokens }, _count: true })`. Tableau : phase · modèle · appels · tokens in · tokens out, + ligne **Total**. Estimation de coût **optionnelle** et **clairement marquée « estimation »** (constantes $/Mtok par modèle en haut du fichier ; ne pas prétendre à l'exactitude). Garde `pret`.

---

## Câblage des écrans

- [src/app/course/[id]/page.tsx](../src/app/course/%5Bid%5D/page.tsx) — ajouter une petite section « Outils » (sous `EtudeActions` ou dans la zone référence) avec 3 liens : **Q&A** (`/course/[id]/qa`), **Corrigé officiel** (`/course/[id]/corrige`), **Usage API** (`/course/[id]/usage`). Réutiliser `buttonVariants({ variant:"outline" })` + icônes lucide (`MessageCircleQuestion`, `ClipboardCheck`, `Activity`).
- Home ([src/app/page.tsx](../src/app/page.tsx)) — optionnel : lien Q&A sur la carte du cours actif.

## Invariants projet (à respecter — voir CLAUDE.md / lessons.md)

- **Node 20** : `export PATH="/home/alexandre/.nvm/versions/node/v20.20.2/bin:$PATH"` avant npm/npx. Si le hook `rtk` bloque un `npx`, préfixer `rtk proxy npx …`.
- **Next 16** : route handlers `({ params }: { params: Promise<{ id: string }> })` + `await params` ; `export const dynamic = "force-dynamic"`. Pas de `middleware.ts` (c'est `src/proxy.ts`).
- **base-ui** (pas Radix) : lien stylé bouton = `<Link className={buttonVariants({…})}>`, **pas** de `asChild`.
- **SQLite** : listes en String JSON (`JSON.parse/stringify` aux frontières), enums en String documentés. **Colonnes FR** (`statut`, `bonneReponse`, `enonce`…) — ne pas calquer `status`.
- **Design system** (clair only) : `Chip` (essentiel/utile/secondaire), tokens `green-wash`/`green-ink`/`brick-wash`/`destructive`, lecture en `font-serif`. Mobile-first (`max-w-md`/`max-w-2xl`).
- **Clé API strictement serveur** : tout appel IA via une route API, jamais côté client.
- **Inspection DB hors Next** : `node --env-file=.env script.mjs` **depuis la racine** (résout `@prisma/client`) ; supprimer le script jetable après. Ne PAS committer `.env`, `docs/*.pdf`, `prisma/dev.db`, `storage/`.
- **Git** : commits conventionnels **sans aucune attribution Claude / « Generated with »**. Brancher `main`. Push seulement si demandé.

## Cadence (obligatoire)

1. **Plan mode** : plan cochable dans `tasks/todo.md`, **validé avant** d'implémenter.
2. Implémenter, puis **`npm run build` vert + `eslint` + `tsc --noEmit`**.
3. **Vérif live sur F-354** (déjà ingéré) — cours `cmq0xcvix0000osbydme0whft`, serveur dev sur `http://localhost:3000` (app ouverte, pas de mot de passe) :
   - Q&A : `POST /api/course/<id>/qa { question: "Quels sont les signes de carence en zinc ?" }` → réponse + `source` cohérente + sections citées.
   - Corrigé : coller 20 réponses (ex. recopier les `bonneReponse` IA en changeant 2 lettres) → vérifier `OfficialKey` créé, `ecartsDetectes` = 2, `bonneReponse` mises à jour. **Restaurer** ensuite si on a faussé la DB de réf.
   - Usage : `/course/<id>/usage` agrège bien les logs (ingestion + verification déjà présents ; un appel Q&A ajoute une ligne `qa`).
4. **Docs** : cocher **M5** dans [tasks/todo.md](todo.md) (+ Review), leçons dans [tasks/lessons.md](lessons.md), MAJ [CLAUDE.md](../CLAUDE.md) + [README.md](../README.md). Marquer le **projet complet (M1→M5)**.
5. Commit (sans attribution Claude). Push si demandé.

## Vérification finale (critères §12 concernés)

- Les réponses Q&A **affichent leur source** (cours ou extérieur). ✅ obligatoire.
- Le corrigé officiel importé **corrige les écarts** et les journalise.
- La page usage **agrège** l'usage API.
- `npm run build` vert, types OK.
