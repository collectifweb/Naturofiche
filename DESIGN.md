---
name: NaturoFiche
description: PWA d'étude par fiches et quiz, calée sur un examen, qui enseigne l'essentiel pour réussir.
colors:
  herbal-green: "oklch(0.50 0.14 151)"
  green-wash: "oklch(0.95 0.035 150)"
  warm-paper: "oklch(0.98 0.008 83)"
  warm-paper-raised: "oklch(0.995 0.005 83)"
  warm-ink: "oklch(0.23 0.014 70)"
  warm-stone: "oklch(0.955 0.01 83)"
  warm-stone-ink: "oklch(0.47 0.014 70)"
  warm-hairline: "oklch(0.90 0.01 80)"
  gentle-brick: "oklch(0.55 0.15 28)"
typography:
  display:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "clamp(2rem, 6vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  reading:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  body-ui:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.01em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.herbal-green}"
    textColor: "{colors.warm-paper-raised}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "oklch(0.45 0.14 151)"
    textColor: "{colors.warm-paper-raised}"
  button-secondary:
    backgroundColor: "{colors.warm-stone}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "32px"
  chip-essentiel:
    backgroundColor: "{colors.green-wash}"
    textColor: "oklch(0.40 0.09 152)"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
    typography: "{typography.label}"
  chip-utile:
    backgroundColor: "{colors.warm-stone}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
    typography: "{typography.label}"
  chip-secondaire:
    backgroundColor: "transparent"
    textColor: "{colors.warm-stone-ink}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
    typography: "{typography.label}"
  card-fiche:
    backgroundColor: "{colors.warm-paper-raised}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
  input:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "40px"
  quiz-option:
    backgroundColor: "{colors.warm-paper-raised}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  quiz-option-correct:
    backgroundColor: "{colors.green-wash}"
    textColor: "oklch(0.40 0.09 152)"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  quiz-option-incorrect:
    backgroundColor: "oklch(0.96 0.02 28)"
    textColor: "{colors.gentle-brick}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  progress:
    backgroundColor: "{colors.warm-stone}"
    textColor: "{colors.herbal-green}"
    rounded: "{rounded.pill}"
    height: "6px"
---

# Design System: NaturoFiche

## 1. Overview

**Creative North Star: "Le bon professeur particulier" (The Patient Tutor)**

NaturoFiche ne ressemble pas à une salle de classe ; il ressemble à un cours en tête-à-tête avec un bon professeur particulier. Chaleureux et encourageant, jamais infantilisant. Il vous dit exactement quoi réviser maintenant, vous montre honnêtement où vous en êtes, et ne vous noie jamais. La chaleur vient de la matière (un papier crème tiède, des coins doux, une voix humaine) et non du bruit. La précision vient de la rigueur de l'outil : minimal, net, vite lu, emprunté à Linear ; et de la clarté pédagogique d'Oak, où la hiérarchie se lit au premier coup d'œil.

La tension féconde du système est là : **du papier chaud tenu par une structure exacte**. Les surfaces sont tièdes et reposantes ; tout ce qui s'y pose est étiqueté, ordonné, traçable. Le vert n'est pas une ambiance, c'est un signal : il marque le progrès, la justesse, l'action principale, et il reste rare pour garder son sens. L'app est pensée pour le pouce et les sessions de quelques minutes : un écran porte une seule intention.

Ce système rejette explicitement trois familles. Il n'est **pas** un LMS corporate à la Moodle : pas de gris institutionnel, pas de densité administrative. Il n'est **pas** un dashboard SaaS générique : pas de hero-metric géant, pas de cartes KPI en grille, pas de graphiques décoratifs. Il n'est **pas** une app techy en dark néon : pas de violet-cyan, pas de glow, pas de glassmorphism. Et il encourage sans jamais gamifier à la Duolingo : pas de streak-théâtre, pas de confettis.

**Key Characteristics:**
- Papier crème tiède, jamais de blanc ni de noir pur.
- Un seul accent : un vert herbacé, utilisé sur ≤ 10 % de l'écran.
- Plat par défaut ; la séparation vient d'un liseré chaud, pas d'une ombre.
- Deux voix typographiques : l'outil (sans net) et le manuel (serif chaud).
- Mobile d'abord, une intention par écran, lecture confortable (65-75ch, ≥ 16px).
- Tout renvoie à sa source : la confiance se gagne par la traçabilité.

## 2. Colors

Une palette de papier chaud portée par un unique vert botanique. Les neutres sont tièdes (teinte ambre, ~70-83) et font tout le travail de surface ; le vert ne fait que ponctuer.

### Primary
- **Vert herbacé** (`oklch(0.50 0.14 151)`) : l'unique accent. Action principale (bouton « Continuer », « Importer »), état juste/validé d'un quiz, remplissage de la barre de progression, importance « essentiel ». Toujours posé sur fond clair, toujours rare. Le texte porté dessus est le papier surélevé (near-white tiède), contraste AA tenu (≥ 4.5:1).

### Secondary
- **Vert lavé** (`oklch(0.95 0.035 150)`) : un voile vert très clair, réservé aux fonds d'état positif (option correcte, fiche maîtrisée, chip « essentiel »). Jamais utilisé comme couleur de marque pleine surface ; c'est l'écho discret du vert herbacé.

### Neutral
- **Papier chaud** (`oklch(0.98 0.008 83)`) : le fond de l'app. Un crème tiède, reposant, qui remplace le blanc.
- **Papier surélevé** (`oklch(0.995 0.005 83)`) : fond des cartes et fiches, à peine plus clair que le fond, pour qu'une surface « se lève » sans ombre.
- **Encre chaude** (`oklch(0.23 0.014 70)`) : le texte courant. Un quasi-noir tiède, jamais `#000`. Contraste AAA sur le papier.
- **Pierre chaude** (`oklch(0.955 0.01 83)`) : remplissages discrets (boutons secondaires, pieds de carte, pistes de progression, chip « utile »).
- **Encre pierre** (`oklch(0.47 0.014 70)`) : texte secondaire (descriptions, méta, statut). Réservé au secondaire ; jamais pour du corps long.
- **Liseré chaud** (`oklch(0.90 0.01 80)`) : bordures et séparateurs, fins (1px). La seule façon de séparer des surfaces.

### Tertiary
- **Brique douce** (`oklch(0.55 0.15 28)`) : le rouge de l'app. Erreurs et réponse fausse, en version **adoucie** (jamais le rouge-alarme néon). Une mauvaise réponse se signale, elle ne punit pas.

### Named Rules
**La règle du seul vert.** Le vert herbacé n'occupe jamais plus de 10 % d'un écran. C'est un signal (progrès, justesse, action), pas une teinte d'ambiance. Sa rareté est son sens. Un écran « tout vert » est interdit : c'est le réflexe wellness qu'on refuse.

**La règle du papier chaud.** Aucun neutre n'est pur. Tout neutre est teinté tiède (teinte ~70-83, chroma 0.008-0.014). `#fff` et `#000` sont proscrits ; même l'encre et le papier surélevé portent une trace de chaleur.

## 3. Typography

**UI / Interface Font:** Geist Sans (avec system-ui, sans-serif)
**Reading / Fiche Font:** Source Serif 4 (avec Georgia, serif)
**Label / Mono Font:** Geist Mono (avec ui-monospace, monospace)

**Character:** Deux voix, deux rôles. Geist est la voix de l'outil : un grotesque net, neutre, précis, qui structure l'interface sans appeler l'attention. Source Serif 4 est la voix du manuel : un serif humaniste chaud qui rend la lecture des fiches reposante et crédible, comme un cours qu'on vous aurait écrit. Geist Mono porte les valeurs exactes (codes de cours, scores, clés A/B/C/D).

### Hierarchy
- **Display** (Geist, 600, `clamp(2rem, 6vw, 2.75rem)`, lh 1.05) : rare. Révélation de score d'examen blanc, premier écran d'accueil. Jamais en série.
- **Headline** (Geist, 600, `1.5rem`/24px, lh 1.15, tracking -0.01em) : titre de page (« NaturoFiche », titre du cours). Reprend le `text-2xl font-semibold tracking-tight` déjà en place.
- **Title** (Geist, 500, `1.125rem`/18px, lh 1.25) : titre de fiche, de section, de carte.
- **Reading** (Source Serif 4, 400, `1.0625rem`/17px, lh 1.65, mesure 65-75ch) : **le corps des fiches.** Le seul endroit où le serif parle. Longueur de ligne tenue pour le confort de lecture mobile.
- **Body-UI** (Geist, 400, `0.9375rem`/15px, lh 1.5) : textes d'interface, descriptions, libellés longs. Sur mobile, les champs montent à 16px pour éviter le zoom iOS.
- **Label** (Geist, 500, `0.8125rem`/13px, tracking 0.01em) : chips, méta, texte de bouton, statuts.
- **Mono** (Geist Mono, 500, `0.875rem`/14px) : scores (`18/20`), codes de cours (`F-354`), clés de réponse (`A B C D`).

### Named Rules
**La règle outil-et-manuel.** L'interface est l'outil (Geist) ; le contenu de la fiche est le manuel (Source Serif 4). On ne mélange jamais les rôles : pas de serif dans un bouton, pas de sans pour le corps d'une fiche. Ce contraste de voix est l'identité typographique de l'app.

**La règle des 65-75ch.** Le corps d'une fiche ne dépasse jamais 75 caractères de large. Sur mobile, la marge protège la mesure avant la largeur d'écran. La lecture confortable n'est pas un détail : c'est le cœur de l'usage.

## 4. Elevation

Le système est **plat par défaut**. Aucune ombre portée décorative. La profondeur se lit par deux moyens seulement : un **liseré chaud de 1px** (`ring-1` couleur liseré, ~10 % d'opacité de l'encre) qui détoure une surface, et un **ton de fond** très légèrement plus clair pour les surfaces « surélevées » (papier surélevé sur papier chaud). C'est l'héritage direct de Linear : des surfaces nettes, séparées par des hairlines, pas par du relief.

### Shadow Vocabulary
- **Flottant doux** (`box-shadow: 0 8px 24px oklch(0.23 0.014 70 / 0.10)`) : réservé aux éléments qui flottent réellement au-dessus du contenu, et seulement eux : toasts (sonner), popovers, menus. Diffus, chaud, jamais dur.

### Named Rules
**La règle du papier plat.** Les surfaces sont plates au repos, comme des feuilles posées. Une ombre n'apparaît que pour ce qui flotte vraiment (toast, popover). Une carte, une fiche, un champ : jamais d'ombre portée. Si une surface a besoin d'« exister », on la détoure d'un liseré chaud ou on la pose sur un fond légèrement plus clair.

## 5. Components

### Buttons
- **Shape:** coins doux, `rounded-lg` (10px). Compact par défaut (h 32px), `lg` à 36px pour les actions pleine largeur sur mobile.
- **Primary:** remplissage vert herbacé + texte papier surélevé. L'unique bouton vert d'un écran. Padding `0 14px`. Hover : vert plus profond (`oklch(0.45 0.14 151)`). Actif : `translate-y-px` (réponse tactile discrète).
- **Secondary:** remplissage pierre chaude + encre. Pour l'action de second rang (« Importer un autre cours »).
- **Outline:** fond papier + liseré chaud + encre ; hover sur fond pierre. Pour les actions neutres.
- **Ghost:** transparent, hover sur fond pierre. Pour les actions tertiaires et les icônes.
- **Destructive:** texte brique douce sur fond brique très lavé ; jamais un bloc rouge plein. Confirmation de suppression, rien d'agressif.
- **Focus:** anneau vert de 3px à 50 % d'opacité (`ring-3 ring-herbal-green/50`), visible et chaud.

### Chips (importance et statut)
Composant signature : il porte la doctrine de hiérarchisation du cours (essentiel / utile / secondaire). Pilule (`rounded-pill`), texte Label.
- **Essentiel:** vert lavé + texte vert profond. Ce qui tombe à l'examen, à étudier en priorité.
- **Utile:** pierre chaude + encre. À connaître, sans urgence.
- **Secondaire:** transparent + encre pierre, liseré ténu. Survolable, jamais imposé. Volontairement discret : sa discrétion dit « tu peux passer vite ».

### Quiz Option (signature)
La brique du quiz et de l'examen blanc. Rangée pleine largeur, tappable, cible tactile généreuse (min 48px de haut).
- **Shape & default:** `rounded-lg`, fond papier surélevé, liseré chaud. Clé A/B/C/D en Geist Mono à gauche, énoncé en Body-UI.
- **Selected:** anneau vert + voile vert lavé. L'utilisateur voit son choix sans validation encore.
- **Correct:** liseré vert + fond vert lavé + icône check verte. Encourageant, franc.
- **Incorrect:** liseré brique douce + fond brique très lavé. Jamais de rouge-alarme : on signale, on n'humilie pas. Au-dessous, l'explication renvoie à la fiche source (lien traçable).

### Cards / Containers (fiche, cours)
- **Corner Style:** `rounded-xl` (14px), coins nettement doux (chaleur).
- **Background:** papier surélevé, posé sur le fond papier chaud.
- **Shadow Strategy:** aucune ombre. Liseré chaud 1px (voir Elevation). Pied de carte sur fond pierre à 50 %.
- **Internal Padding:** 16px (mobile), 24px sur grand écran.
- **Fiche de lecture:** la carte qui porte le contenu d'étude passe en typographie Reading (Source Serif 4), interligne 1.65, mesure 65-75ch.

### Inputs / Fields
- **Style:** fond papier (ou pierre), liseré chaud 1px, `rounded-lg`. Hauteur confortable (40px). Texte à 16px sur mobile pour éviter le zoom iOS.
- **Focus:** anneau vert + liseré vert. Pas de glow, juste un anneau net.
- **Usage:** champ de délai à l'import, champ de question du module Q&A, dépôt de PDF.

### Progress
- **Style:** piste pierre chaude fine (6px), remplissage vert herbacé, `rounded-pill`. Honnête, pas festif : elle montre où on en est par rapport au rythme prévu, sans célébration artificielle.

### Navigation
- **Style:** en-tête minimal, titre en Headline, colonne centrée `max-w-md` (448px). Pensé pour le pouce. Pas de barre dense, pas d'onglets administratifs. La navigation principale tient en une ou deux actions claires par écran.

## 6. Do's and Don'ts

### Do:
- **Do** teinter chaque neutre vers le tiède (teinte ~70-83, chroma 0.008-0.014). Le fond est un crème, pas un blanc.
- **Do** réserver le vert herbacé à ≤ 10 % de l'écran : action principale, justesse, progrès, « essentiel ». Sa rareté fait son sens.
- **Do** séparer les surfaces par un liseré chaud de 1px ou un ton de fond ; surfaces plates par défaut.
- **Do** écrire le corps des fiches en Source Serif 4, interligne 1.65, mesure 65-75ch ; garder Geist pour l'interface.
- **Do** rendre chaque fiche, réponse et bonne réponse traçable vers sa section source.
- **Do** tenir le contraste AA (≥ 4.5:1) sur le texte courant, le corps à ≥ 16px sur mobile, les cibles tactiles à ≥ 44px.
- **Do** porter une seule intention par écran ; couper avant d'entasser.

### Don't:
- **Don't** ressembler à un LMS corporate / Moodle : pas de gris institutionnel, pas de densité administrative, pas d'onglets.
- **Don't** tomber dans le dashboard SaaS générique : pas de hero-metric géant, pas de cartes KPI en grille, pas de graphiques décoratifs.
- **Don't** virer au dark techy néon : pas de violet/cyan, pas de néon, pas de glassmorphism, pas de glow.
- **Don't** gamifier à la Duolingo : pas de streak-théâtre, pas de confettis, pas de badges, pas de sons de victoire.
- **Don't** utiliser `#fff` ou `#000`, ni un vert pleine surface (réflexe wellness refusé).
- **Don't** poser d'ombre portée sur une carte, une fiche ou un champ ; l'ombre est réservée à ce qui flotte (toast, popover).
- **Don't** punir une mauvaise réponse en rouge-alarme : la brique est douce, on signale sans humilier.
- **Don't** utiliser un liseré coloré en `border-left`/`border-right` > 1px comme accent (bande latérale), du texte en dégradé, ou une carte en verre.
