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
- **Tailwind v4** + **shadcn/ui**
- **Prisma 6** + **SQLite** (fichier local `prisma/dev.db`)
- **API Anthropic** (`@anthropic-ai/sdk`), modèles configurables via `.env`
- Extraction PDF : **pdf-parse** (texte sélectionnable, pas d'OCR)
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
    page.tsx                 # accueil (cours actif)
    import/page.tsx          # écran d'import (2 PDF + délai)
    course/[id]/page.tsx     # sections découpées + questions détectées
    login/page.tsx           # garde d'accès optionnelle
    api/import/route.ts      # upload → extraction → découpage → DB
    api/login/route.ts       # pose le cookie d'accès
  lib/
    prisma.ts                # singleton Prisma
    pdf.ts                   # extraction de texte
    sectioning.ts            # découpage structurel provisoire (M1)
    exam-parse.ts            # parsing QCM léger (M1)
    anthropic.ts             # client Claude (lazy) + config modèles
    auth.ts                  # token de la garde d'accès
  middleware.ts              # gate optionnelle si ACCESS_PASSWORD
prisma/schema.prisma         # modèle de données complet
public/                      # manifest, service worker, icônes
storage/                     # PDF importés (gitignoré)
docs/                        # PDF de cours de test (gitignorés)
```

## État

**M1 (socle technique) livré** : import, extraction, découpage structurel provisoire,
affichage des sections, PWA, garde d'accès. Le découpage/hiérarchisation par IA et la
déduction des réponses arrivent en **M2**. Voir [`tasks/todo.md`](./tasks/todo.md).

> ⚠️ Le découpage de M1 est **volontairement heuristique** (par titres / longueur),
> juste pour afficher des sections. La vraie découpe adaptative et la hiérarchisation
> essentiel/utile/secondaire sont faites par l'IA en M2.
