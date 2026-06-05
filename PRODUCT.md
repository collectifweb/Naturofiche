# Product

## Register

product

## Users

Un seul utilisateur : un adulte qui suit une formation en naturopathie à distance au Collège des Médecines Douces du Québec (CMDQ). Il étudie surtout sur son téléphone, par sessions courtes de quelques minutes, intercalées dans une journée déjà remplie. Son contexte est celui de la révision sous contrainte : un examen daté, 20 questions à choix multiples, une note de passage à 80 %, et un corrigé qui n'arrive que le lendemain de la remise. Il connaît déjà Next.js (il maintient l'app lui-même), mais quand il l'utilise, il n'est pas développeur : il est étudiant pressé qui veut savoir quoi réviser maintenant.

Le job à accomplir : *« Dis-moi l'essentiel à étudier aujourd'hui pour réussir cet examen, et fais-moi sentir que j'avance. »*

## Product Purpose

NaturoFiche ingère un PDF de cours et son PDF d'examen, puis génère un parcours d'étude court, calé sur un délai fixe et jamais dépassé, sous forme de fiches de synthèse et de quiz. Le cœur du produit n'est pas l'exhaustivité mais la **hiérarchisation** : distinguer ce qui doit être étudié (essentiel, utile) de ce qui est secondaire, en priorisant ce qui tombe à l'examen. L'app enseigne, fait réviser par répétition espacée, répond aux questions sur le cours en citant sa source, et propose un examen blanc noté.

Le succès se mesure simplement : l'utilisateur réussit son examen au seuil de 80 % en ayant étudié peu, mais juste. Une session réussie, c'est ouvrir l'app, lire une fiche, faire le quiz, sentir qu'on a avancé, et refermer en moins de cinq minutes.

## Brand Personality

**Chaleureux, clair, précis.** Une voix de bon professeur particulier : humaine et encourageante, jamais infantilisante. L'app rassure un étudiant qui prépare un examen à enjeu, sans jamais le gamifier. La chaleur vient du ton, de la température des couleurs et de la douceur des formes, pas du bruit : aucune mascotte, aucun confetti, aucun streak qui culpabilise. L'encouragement passe par une progression visible et honnête, pas par des récompenses artificielles.

Sous cette chaleur, une exigence de **précision et de lisibilité** empruntée à Linear : minimal, net, rapide, bien contrasté, sans décoration gratuite. Et une **clarté pédagogique** empruntée à Oak / Khan : une hiérarchie d'information évidente, un contenu qui se lit, accessible à un usage mobile prolongé. Émotion visée : *confiance tranquille*. L'utilisateur referme l'app en se disant « je sais quoi faire, et je suis sur la bonne voie ».

## Anti-references

- **LMS corporate / Moodle.** Pas d'interface dense et administrative, pas de gris institutionnel daté, pas de menus à onglets, pas de lourdeur cognitive. Le parcours est court : l'écran doit l'être aussi.
- **Dashboard SaaS générique.** Pas de « hero metric » géant, pas de cartes KPI alignées en grille identique, pas de graphiques décoratifs, pas de dégradés d'accent à la SaaS. C'est une app d'étude, pas un tableau de bord analytique.
- **Dark techy néon.** Pas de néon sur fond noir, pas de dégradés violet/cyan, pas de glassmorphism, pas de glow. L'ambiance crypto/gaming est l'opposé d'une étude sereine.
- **Gamification bruyante façon Duolingo.** L'encouragement est assumé, mais sobre : pas de streak-théâtre, pas de badges, pas de sons de victoire.

## Design Principles

1. **L'essentiel pour réussir, pas l'exhaustivité.** L'interface met en avant ce qui compte pour l'examen et démote le reste. Le secondaire est signalé comme survolable, jamais imposé. Si un écran déborde, on coupe avant d'entasser.
2. **Encourager sans gamifier.** L'élan vient d'une progression visible et honnête (où j'en suis par rapport au rythme prévu), d'un ton humain et de petits accusés de réception. Jamais de mécanique de récompense artificielle.
3. **Mobile, une chose à la fois.** Pensé pour le pouce et les sessions de quelques minutes. Un écran = une intention : la fiche du jour, ce quiz, cette réponse. On ne fait pas tout voir en même temps.
4. **Confiance par la traçabilité.** Chaque fiche, chaque bonne réponse, chaque réponse de Q&A renvoie à sa source (section du cours, ou complément extérieur clairement étiqueté). La confiance se gagne en montrant d'où vient l'information, surtout tant que le corrigé officiel n'existe pas.
5. **Clarté avant décoration.** Précision de Linear, lisibilité d'Oak. La hiérarchie se lit au premier coup d'œil. Tout élément qui n'aide pas à étudier ou à se repérer est retiré.

## Accessibility & Inclusion

Mono-utilisateur, donc pas de mandat WCAG formel, mais le confort de lecture mobile est une priorité explicite, pas un détail. Cibles à tenir : corps de texte ≥ 16px, contraste AA minimum (4.5:1) sur le texte courant et de préférence au-delà, cibles tactiles confortables (≥ 44px), longueur de ligne tenue entre 65 et 75 caractères pour les fiches. Mobile-first : tout doit fonctionner d'abord au pouce, sur un écran de téléphone, en sessions de lecture. Les animations restent discrètes et ne portent jamais d'information seule.
