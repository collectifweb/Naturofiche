# NaturoFiche

Application web **mono-utilisateur, locale, PWA mobile-first** pour préparer un examen
de formation (CMDQ) à partir d'un PDF de cours et de son PDF d'examen. Elle génère un
parcours d'étude court (fiches de synthèse, mini-quiz, examen blanc) avec répétition
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
    course/[id]/page.tsx     # progression d'ingestion OU parcours hiérarchisé (sections, réponses, fiches)
    login/page.tsx           # garde d'accès optionnelle
    api/import/route.ts      # upload → extraction → sections/questions → déclenche l'ingestion IA
    api/course/[id]/ingest/  # (re)lance le pipeline (fire-and-forget, ?force=1)
    api/course/[id]/status/  # avancement de l'ingestion (polling)
    api/login/route.ts       # pose le cookie d'accès
  components/
    ui/*                     # shadcn (button, card, chip, input…) — chip = signature
    ingestion-progress.tsx   # barre de progression + polling + relance (M2)
    sw-register.tsx          # enregistrement du service worker (prod)
  lib/
    prisma.ts                # singleton Prisma
    pdf.ts                   # extraction de texte
    sectioning.ts            # stripBoilerplate + découpage heuristique (fallback import)
    exam-parse.ts            # parsing QCM léger (fallback import)
    anthropic.ts             # client Claude (lazy) + runStructured (tool-use) + config modèles
    ingest/                  # pipeline IA M2 : pipeline · structure · answers · generate · verify · progress
    auth.ts                  # token de la garde d'accès
    paths.ts                 # chemins de stockage des PDF
  proxy.ts                   # gate optionnelle si ACCESS_PASSWORD (Next 16)
prisma/schema.prisma         # modèle de données complet
public/                      # manifest, service worker, icônes
storage/                     # PDF importés (gitignoré)
docs/                        # PDF de cours de test (gitignorés)
```

## État

**M1 + M2 livrés et validés** sur le cours de référence F-354.

- **M1** — socle : import (examen optionnel), extraction PDF, découpage heuristique, PWA, garde d'accès, design system.
- **M2** — **pipeline d'ingestion IA branché** ([`src/lib/ingest/`](./src/lib/ingest/)) : découpe adaptative + hiérarchisation essentiel/utile/secondaire, correspondance examen↔sections, déduction des réponses ancrées, génération fiches + mini-quiz + examen blanc, **agent de vérification distinct**, barre de progression réelle. Tourne une fois par cours, en tâche de fond, avec suivi de l'usage API.

Prochaine étape : **M3** (plan d'étude + étude quotidienne). Voir [`tasks/todo.md`](./tasks/todo.md).

> L'ingestion IA tourne **en tâche de fond dans le process Node** (fire-and-forget après l'import) : ça
> suppose un serveur permanent (`next start`/`next dev`), pas du serverless. La page cours suit la
> progression par polling ; en cas d'échec, relancer via `POST /api/course/[id]/ingest?force=1`.
