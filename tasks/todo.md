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
- [ ] `npm run build` vert
- [ ] Test bout-en-bout sur `docs/F-354.pdf` + `docs/F-exam-354.pdf` (sections affichées, ~20 questions)
- [ ] git init + commit initial

### Notes M1
- Découpage **volontairement grossier** : l'objectif M1 est « afficher des sections », pas la qualité finale (c'est M2).
- En M1, le statut d'un cours passe directement à `pret` après extraction (pas encore d'ingestion IA).
- Les questions d'examen sont stockées en `type=examen_officiel`, `bonneReponse` null (déduite en M2 / importée en M5).

### Review M1
_(à compléter après le test bout-en-bout sur les vrais PDF)_

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
