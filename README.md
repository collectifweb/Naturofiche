# NaturoFiche

Application web **mono-utilisateur, locale, PWA mobile-first** pour préparer un examen
de formation (CMDQ) à partir d'un PDF de cours et de son PDF d'examen. Elle génère un
parcours d'étude court (fiches de synthèse, mini-quiz, examen blanc, Q&A sourcé et persistant) avec répétition
espacée. Tous les appels IA (Anthropic / Claude) passent côté serveur ; la clé API
n'est jamais exposée au client.

Voir le cahier des charges : [`cahier-des-charges-app-etude.md`](./cahier-des-charges-app-etude.md).
Suivi des jalons : [`tasks/todo.md`](./tasks/todo.md).

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind v4** + **shadcn/ui** (base-nova)
- **Design system maison** (thème clair) : papier chaud + vert herbacé, polices Geist / Source Serif 4 — voir [DESIGN.md](./DESIGN.md) et [PRODUCT.md](./PRODUCT.md)
- **Prisma 6** + **SQLite** (fichier local `prisma/dev.db`)
- **API Anthropic** (`@anthropic-ai/sdk`), modèles configurables via `.env` — **pipeline d'ingestion branché** (M2, sorties structurées par tool-use)
- **react-markdown** + **remark-gfm** — rendu des fiches (markdown + tableaux GFM) côté serveur (M3)
- Extraction PDF : **pdf-parse** (v1, texte sélectionnable, pas d'OCR)
- PWA installable (manifest + service worker), pensée pour le tunnel Cloudflare

## Prérequis

- **Node 20+** (Next 16 ne supporte plus Node 18). Sur cette machine : `nvm use 20`
  ou préfixer avec `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`.

## Démarrage

```bash
# 1. Variables d'environnement
cp .env.example .env   # puis renseigner ANTHROPIC_API_KEY

# 2. Dépendances
npm install

# 3. Base de données (migrations + client)
npx prisma migrate dev

# 4. Développement
npm run dev            # http://localhost:3000

# 5. Production
npm run build && npm run start
```

## Variables d'environnement

| Variable             | Rôle                                                        |
| -------------------- | ----------------------------------------------------------- |
| `ANTHROPIC_API_KEY`  | Clé API Anthropic (serveur uniquement).                     |
| `DATABASE_URL`       | Chemin SQLite (`file:./dev.db`).                            |
| `INGEST_MODEL`       | Modèle d'ingestion (défaut `claude-opus-4-8`).             |
| `VERIFY_MODEL`       | Modèle de l'agent de vérification (défaut `claude-sonnet-4-6`). |
| `QA_MODEL`           | Modèle Q&A en direct (défaut `claude-haiku-4-5-20251001`). |
| `ACCESS_PASSWORD`    | Mot de passe d'accès optionnel (tunnel public). Vide = ouvert. |

## Structure

```
src/
  app/
    globals.css              # tokens du design system (palette oklch, polices)
    layout.tsx               # shell + polices Geist/Source Serif + PWA + toaster
    page.tsx                 # accueil (cours actif)
    import/page.tsx          # écran d'import (PDF cours + examen OPTIONNEL + délai)
    course/[id]/page.tsx     # tableau de bord d'étude (plan + fiches) OU progression d'ingestion
    course/[id]/fiche/[unitId]/page.tsx  # lecture d'une fiche + Q&A contextuel + mini-quiz (M3/M5bis)
    course/[id]/revision/page.tsx  # révision espacée (Leitner) : notions échues/prioritaires (M4)
    course/[id]/examen/page.tsx  # examen blanc 20 QCM noté /100, seuil 80 % (M4)
    course/[id]/qa/page.tsx      # Q&A sur le cours, source cours/extérieur/mixte (M5)
    course/[id]/corrige/page.tsx # import du corrigé officiel + correction des écarts (M5)
    course/[id]/usage/page.tsx   # suivi agrégé ApiUsageLog par phase/modèle (M5)
    login/page.tsx           # garde d'accès optionnelle
    api/import/route.ts      # upload → extraction → sections/questions → déclenche l'ingestion IA
    api/course/[id]/ingest/  # (re)lance le pipeline (fire-and-forget, ?force=1)
    api/course/[id]/status/  # avancement de l'ingestion (polling)
    api/course/[id]/progress/ # enregistre la complétion d'une fiche (+ score) → fiche suivante (M3)
    api/course/[id]/review/  # met à jour les boîtes de Leitner depuis un quiz (M4)
    api/course/[id]/qa/      # Q&A serveur + historique persistant + journalisation phase qa (M5/post-M5)
    api/course/[id]/corrige/ # upsert OfficialKey + correction des examen_officiel (M5)
    api/login/route.ts       # pose le cookie d'accès
  components/
    ui/*                     # shadcn (button, card, chip, input…) — chip = signature
    ingestion-progress.tsx   # barre de progression + polling + relance (M2)
    fiche-markdown.tsx       # rendu markdown des fiches (react-markdown + remark-gfm, RSC) (M3)
    quiz-runner.tsx          # mini-quiz interactif (modes fiche|revision) + Leitner (M3/M4)
    exam-runner.tsx          # examen blanc : répondre à tout puis noter /100 (M4)
    qa-panel.tsx             # Q&A client, historique persistant, page dédiée + mode compact dans les fiches (M5/post-M5)
    corrige-import.tsx       # parsing local + aperçu avant application du corrigé (M5)
    sw-register.tsx          # enregistrement du service worker (prod)
  lib/
    prisma.ts                # singleton Prisma
    pdf.ts                   # extraction de texte
    sectioning.ts            # stripBoilerplate + découpage heuristique (fallback import)
    exam-parse.ts            # parsing QCM léger (fallback import)
    anthropic.ts             # client Claude (lazy) + runStructured (tool-use) + config modèles
    ingest/                  # pipeline IA M2 : pipeline · structure · answers · generate · verify · progress
    plan.ts                  # moteur de plan d'étude dérivé (rythme, recalage des jours sautés) — M3, pur
    leitner.ts               # moteur de répétition espacée (boîtes, échéances, priorités) — M4, pur
    qa.ts                    # retrieval mots-clés + appel Q&A structuré (M5)
    corrige.ts               # parser souple du corrigé officiel + calcul des écarts (M5)
    auth.ts                  # token de la garde d'accès
    paths.ts                 # chemins de stockage des PDF
  proxy.ts                   # gate optionnelle si ACCESS_PASSWORD (Next 16)
prisma/schema.prisma         # modèle de données complet
public/                      # manifest, service worker, icônes
storage/                     # PDF importés (gitignoré)
docs/                        # PDF de cours de test (gitignorés)
```

## État

**M1 → M5 livrés** sur le cours de référence F-354 : le périmètre du cahier est complet.

- **M1** — socle : import (examen optionnel), extraction PDF, découpage heuristique, PWA, garde d'accès, design system.
- **M2** — **pipeline d'ingestion IA branché** ([`src/lib/ingest/`](./src/lib/ingest/)) : découpe adaptative + hiérarchisation essentiel/utile/secondaire, correspondance examen↔sections, déduction des réponses ancrées, génération fiches + mini-quiz + examen blanc, **agent de vérification distinct**, barre de progression réelle. Tourne une fois par cours, en tâche de fond, avec suivi de l'usage API.
- **M3** — **plan d'étude + étude quotidienne** ([`src/lib/plan.ts`](./src/lib/plan.ts)) : rythme **dérivé** non bloquant (recalage automatique des jours sautés, plafond jamais dépassé), tableau de bord (jour, progression, lot du jour), lecture des fiches en markdown (tableaux GFM), Q&A contextuel dans la fiche et **mini-quiz interactif** avec correction immédiate + enregistrement de la complétion. **Aucune migration.**
- **M4** — **répétition espacée + examen blanc** ([`src/lib/leitner.ts`](./src/lib/leitner.ts)) : boîtes de Leitner sur les mini-quiz (notions ratées revues vite, maîtrisées espacées), **mode révision** mis en avant en fin de parcours, et **examen blanc** de 20 QCM noté **/100 et /20** au seuil 80 % avec correction renvoyant aux sections. **Aucune migration.**
- **M5** — **Q&A avec source + corrigé officiel + suivi API** ([`src/lib/qa.ts`](./src/lib/qa.ts), [`src/lib/corrige.ts`](./src/lib/corrige.ts)) : questions en direct via Haiku côté serveur, réponse étiquetée `cours` / `extérieur` / `mixte`, import du corrigé officiel avec correction et journalisation des écarts dans `OfficialKey`, page Usage agrégeant `ApiUsageLog` par phase/modèle.
- **M5bis/post-M5** — **Q&A avec recherche web + historique persistant** : option explicite « Recherche sur le web » dans le panneau Q&A. Par défaut, la réponse reste centrée sur le cours ; si l'option est cochée, l'outil serveur Anthropic `web_search_20250305` est limité à 1 recherche et à des domaines santé/institutionnels, puis affiche les sources web cliquables. Le panneau est disponible en page dédiée et directement dans chaque fiche révisable, où les anciennes questions sont repliées et sauvegardées dans `QaMessage`.

> L'ingestion IA tourne **en tâche de fond dans le process Node** (fire-and-forget après l'import) : ça
> suppose un serveur permanent (`next start`/`next dev`), pas du serverless. La page cours suit la
> progression par polling ; en cas d'échec, relancer via `POST /api/course/[id]/ingest?force=1`.
