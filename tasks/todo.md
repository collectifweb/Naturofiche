# NaturoFiche — Suivi des tâches

App mono-utilisateur, locale, PWA mobile-first. Ingère un cours CMDQ + son examen
(PDF texte), génère un parcours d'étude court (fiches, quiz, examen blanc) avec
répétition espacée. IA Anthropic côté serveur uniquement.

Cadence : **jalon par jalon**, plan validé avant chaque implémentation.

---

## M1 — Socle technique ✅ (en cours de validation)

Boucle livrée : **import → extraction texte → découpage structurel provisoire → affichage des sections.**

- [x] Scaffold Next.js 16 (App Router, TS, Tailwind v4, `src/`) — Node 20 requis
- [x] shadcn/ui (style base-nova) + composants : button, card, input, label, badge, progress, sonner, separator
- [x] Prisma 6 + SQLite : schéma **complet** (Course, Section, StudyUnit, Fiche, Question, Progress, ReviewItem, OfficialKey, ApiUsageLog) + migration `init` + singleton `src/lib/prisma.ts`
- [x] Libs serveur : `pdf.ts` (extraction), `sectioning.ts` (découpe heuristique), `exam-parse.ts` (QCM), `anthropic.ts` (client lazy + config modèles, non appelé en M1)
- [x] Page `/import` (mobile-first) + API `POST /api/import` (upload → storage local → extraction → sections + questions)
- [x] Page `/course/[id]` (sections + types + nb questions) ; home `/` mono-cours
- [x] PWA : `manifest.webmanifest`, icônes (feuille verte) 192/512/maskable + apple-touch, `sw.js` (network-first), enregistrement en prod
- [x] Garde d'accès optionnelle : `middleware.ts` + `/login` + `/api/login` (actif si `ACCESS_PASSWORD`)
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

## M2 — Pipeline d'ingestion IA + agent de vérification (à planifier)
- Découpe adaptative + hiérarchisation **essentiel / utile / secondaire**
- Correspondance examen → sections, déduction des réponses (justification ancrée)
- Génération des fiches + mini-quiz + réservoir examen blanc
- **Agent de vérification** (modèle distinct) : unicité de la bonne réponse, ancrage, anti-hallucination
- Barre de progression réelle (statut Course + polling), `ApiUsageLog`

## M3 — Plan d'étude + étude quotidienne
- Délai configurable, rythme non bloquant, recalage si jours sautés (jamais au-delà du plafond)
- Fiche du jour + mini-quiz + progression

## M4 — Répétition espacée + examen blanc
- Boîtes de Leitner (ReviewItem), bascule mode révision en fin de parcours
- Examen blanc 20 QCM noté /100, seuil 80 %, correction renvoyant aux sections

## M5 — Q&A + corrigé officiel + suivi API
- Q&A avec indication de source (cours / extérieur)
- Import du corrigé officiel, comparaison + journalisation des écarts
- Tableau de suivi de l'usage API
