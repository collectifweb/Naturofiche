# Cahier des charges : application d'étude par fiches

Nom de travail : **NaturoFiche** (modifiable). Document destiné à Claude Code pour le développement.

---

## 1. Contexte et objectif

L'utilisateur suit une formation en naturopathie à distance au Collège des Médecines Douces du Québec (CMDQ). L'école envoie chaque cours sous forme d'un PDF au texte sélectionnable (pas de scan), accompagné d'un PDF d'examen distinct.

Caractéristiques d'un examen type (constatées sur le cours 354, « L'oligothérapie ») : 20 questions à choix multiples, options A/B/C/D, une seule bonne réponse par question, note de passage à 80/100. Le PDF d'examen ne contient pas le corrigé. L'école envoie le corrigé officiel le lendemain de la remise.

Objectif de l'application : ingérer un cours et son examen, puis générer un parcours d'étude court (quelques minutes par jour) sous forme de fiches de synthèse et de quiz, de façon à préparer l'examen dans un délai fixé et sans jamais le dépasser. La philosophie est l'essentiel pour réussir, pas l'exhaustivité. L'application enseigne les notions importantes du cours, en priorisant ce qui tombe à l'examen.

## 2. Périmètre

Inclus : import d'un cours et de son examen, génération automatique du parcours (fiches, quiz, examen blanc), étude quotidienne, répétition espacée, questions-réponses sur le cours, examen blanc noté, import du corrigé officiel après coup.

Hors périmètre : gestion multi-utilisateurs et comptes, plusieurs cours étudiés en parallèle (un seul cours actif à la fois), édition manuelle du contenu généré, application mobile native. L'accès mobile passe par une application web installable (PWA).

## 3. Acteurs et contraintes d'usage

Un seul utilisateur, donc pas d'authentification lourde. Si une protection est souhaitée (l'app passe par un tunnel public), un simple mot de passe d'accès via variable d'environnement suffit.

L'application tourne en local, sur une machine personnelle allumée en permanence qui sert de serveur, et reste accessible via un tunnel Cloudflare déjà en place. Usage principal sur téléphone, usage occasionnel sur ordinateur. La clé API Anthropic reste côté serveur et n'est jamais exposée au client.

## 4. Parcours utilisateur

1. **Importer un cours** : déposer le PDF du cours et celui de l'examen, choisir le délai en jours. L'application lance l'ingestion (traitement IA) avec une barre de progression. À la fin, le parcours est prêt.
2. **Étudier au quotidien** : ouvrir l'application, lire la fiche du jour, faire le mini-quiz de vérification. Possibilité d'enchaîner la fiche suivante pour avancer. La progression se met à jour.
3. **Poser une question** : interroger l'application sur une notion. La réponse est priorisée sur le contenu du cours, avec repli sur le web ou les connaissances du modèle si l'information manque. La source est toujours indiquée.
4. **Passer un examen blanc** : à la demande, ou proposé automatiquement vers la fin du parcours. 20 QCM dans le style du vrai examen, score sur 100, seuil de réussite à 80 %, correction renvoyant aux sections.
5. **Importer le corrigé officiel** : après la remise du vrai examen, importer le corrigé fourni par l'école pour corriger les réponses que l'IA aurait mal déduites.

## 5. Fonctionnalités détaillées

### 5.1 Ingestion d'un cours

L'application extrait le texte des deux PDF. Elle découpe le cours en sections logiques en s'appuyant sur la table des matières et la hiérarchie réelle du document. Sur le cours 354, cette hiérarchie comprend un chapitre où chaque oligoélément suit toujours le même gabarit (signes de carence, action, sources naturelles, supplémentation), des tableaux de synthèse (besoins particuliers, aliments riches) et une annexe sur les diathèses. Les parties méta (guide de l'étudiant, échéances administratives, copyright) sont écartées car elles ne sont pas de la matière.

L'examen est analysé pour en extraire les 20 questions et leurs options. L'application établit ensuite un lien entre chaque question et la ou les sections du cours qui y répondent, puis déduit la bonne réponse avec une justification ancrée dans le texte. Cette correspondance sert d'ossature au parcours.

À partir de là, l'application génère les unités d'étude réparties sur le délai choisi, les fiches de synthèse correspondantes, les mini-quiz de vérification et un réservoir de questions pour l'examen blanc.

Le découpage doit rester universel et s'adapter à chaque cours, sans règle figée. Le cours 354 se présente comme une suite d'entrées courtes à réviser une par une (les oligoéléments), mais un autre cours peut arriver en gros blocs thématiques sans découpe naturelle évidente. L'IA d'ingestion doit donc juger elle-même la bonne granularité : s'appuyer sur la structure du document quand elle existe, et regrouper ou fractionner le texte autrement quand elle manque.

Le vrai enjeu n'est pas seulement de découper, mais de hiérarchiser. Il faut distinguer ce que l'utilisateur doit étudier de ce qui est secondaire. Cette hiérarchisation s'appuie sur plusieurs signaux : les questions de l'examen d'abord (un sujet qui y figure devient prioritaire), puis les objectifs annoncés du cours et les éléments mis en avant dans le texte (titres, gras, tableaux, répétitions, résumés). Chaque notion reçoit un niveau d'importance : essentiel, utile ou secondaire. Les fiches se concentrent sur l'essentiel et l'utile, et signalent le secondaire comme survolable au lieu de l'imposer. C'est la partie la plus délicate du projet et celle qui mérite le plus de soin.

### 5.2 Agent de vérification

Une seconde passe IA, menée par un agent distinct, valide le contenu généré avant qu'il soit retenu. Pour chaque question, l'agent vérifie qu'une seule bonne réponse est défendable, qu'elle est ancrée dans une section précise du cours, et qu'aucune notion inventée ne s'est glissée dans les fiches. Les questions douteuses sont rejetées et régénérées. Cette vérification tourne une seule fois par cours, au moment de l'ingestion, ce qui en limite le coût. Elle compte parce que le corrigé n'existe pas avant la remise et que la barre est à 80 %.

### 5.3 Plan d'étude

Le délai est configurable par cours (par exemple 15, 30 ou 45 jours, champ libre), et le plafond est strict. Le plan est un rythme cible, pas un verrou : il suggère une fiche par jour selon la densité calculée, mais tout le contenu reste accessible. L'utilisateur peut enchaîner plusieurs fiches dans une même session et terminer plus tôt, ce qui correspond à sa façon de travailler.

Si des jours sont sautés, le plan se recompacte pour rester sous le plafond, en densifiant les jours restants, sans jamais repousser l'échéance au-delà du délai fixé. L'écran principal montre clairement où en est l'utilisateur par rapport au rythme prévu.

### 5.4 Étude quotidienne

La fiche du jour présente une synthèse hiérarchisée, de longueur variable selon le contenu, avec les notions importantes mises en avant. Le mini-quiz qui l'accompagne reprend le format de l'examen (QCM), avec correction immédiate et explication renvoyant à la fiche. La complétion est enregistrée.

### 5.5 Répétition espacée

Les notions vues en début de parcours réapparaissent en quiz vers la fin, pour ancrer la mémoire avant l'examen. Vu l'horizon court et fixe (de 15 à 45 jours), un système de boîtes à la Leitner convient mieux qu'un espacement long de type SM-2. Le principe : chaque notion vérifiée par quiz avance d'une boîte quand la réponse est juste et recule quand elle est fausse, et plus la boîte est haute, plus l'intervalle avant la prochaine révision s'allonge. Une notion ratée revient vite, une notion maîtrisée revient rarement mais au moins une fois avant l'examen. Dans les derniers jours du parcours, l'application bascule en mode révision et fait repasser en priorité les notions des boîtes basses et les plus anciennes. Tout cela tient dans la table ReviewItem (boîte courante, prochaine échéance, historique).

### 5.6 Questions-réponses

Un champ permet de poser une question sur le cours. La réponse s'appuie d'abord sur les sections ingérées (recherche par mots-clés ou par embeddings, au choix de l'implémentation). Si l'information n'est pas dans le cours, le modèle complète avec le web ou ses connaissances. Chaque réponse indique sa source : tiré du cours, ou complément extérieur. Ainsi l'utilisateur sait toujours ce qui relève du périmètre de l'examen.

### 5.7 Examen blanc

20 QCM dans le style du vrai examen, une seule bonne réponse par question, présentation en grille A/B/C/D. Le résultat s'affiche sur 100 (et sur 20), avec indication de réussite ou d'échec au seuil de 80 %. La correction détaille chaque question et renvoie à la section du cours concernée.

### 5.8 Import du corrigé officiel

Après la remise, l'utilisateur importe le corrigé envoyé par l'école. L'application compare ce corrigé aux réponses déduites par l'IA, corrige les écarts et les journalise. Ce corrigé devient une vérité de référence qui fiabilise les cours suivants.

## 6. Modèle de données (proposition)

- **Course** : id, titre, code, délai_jours, date_début, statut, chemin_pdf_cours, chemin_pdf_examen.
- **Section** : id, course_id, titre, niveau, ordre, texte, type (notion, tableau, diathèse, méta).
- **StudyUnit** : id, course_id, ordre, jour_cible, titre, sections_liées.
- **Fiche** : id, study_unit_id, contenu_markdown, notions_clés.
- **Question** : id, course_id, type (quiz_verif, examen_blanc, examen_officiel), énoncé, options, bonne_réponse, justification, section_source_id, statut_validation.
- **Progress** : study_unit_id, complété_le, score_quiz.
- **ReviewItem** : question_id, prochaine_échéance, historique_réponses.
- **OfficialKey** : course_id, réponses_importées, écarts_détectés.

## 7. Architecture technique recommandée

Stack : Next.js avec l'App Router, en full-stack. Le front est une PWA installable sur téléphone et utilisable via le tunnel. Tous les appels IA passent par des routes API côté serveur, ce qui garde la clé API hors du navigateur. L'utilisateur connaît déjà Next.js, ce qui facilite la maintenance.

Base de données : SQLite via Prisma, soit un simple fichier local, largement suffisant pour un usage mono-utilisateur. Les PDF sont stockés sur le disque local.

Extraction PDF : une bibliothèque Node côté serveur (pdf-parse ou pdfjs-dist). Le texte des documents CMDQ est propre, aucun OCR n'est nécessaire.

Déploiement : un processus Node lancé sur la machine serveur de l'utilisateur, exposé par le tunnel Cloudflare existant. Pas d'hébergement tiers, pas de base distante.

## 8. Intégration IA

Fournisseur : API Anthropic (Claude). Les traitements lourds (découpage adaptatif, hiérarchisation des notions, correspondance examen vers sections, déduction des réponses, génération des fiches et des quiz) ont lieu une seule fois par cours, à l'ingestion. Comme ces tâches demandent du jugement, en particulier pour décider quelles notions sont essentielles et pour fractionner un cours sans structure évidente, le modèle recommandé à l'ingestion est Opus (`claude-opus-4-8`), qui juge mieux ces cas nuancés. Le traitement étant ponctuel, son coût reste maîtrisé. Une variante avec Sonnet (`claude-sonnet-4-6`) mérite d'être testée pour voir si la qualité reste suffisante à moindre coût, donc le modèle d'ingestion doit être configurable. Pour l'agent de vérification, un modèle distinct sert de contre-regard (Opus ou Sonnet selon le budget). Pour le Q&A en direct, plus fréquent, un modèle léger comme Sonnet ou `claude-haiku-4-5` suffit.

L'ingestion se fait en deux passes : une passe de génération, puis une passe de vérification par un agent distinct qui valide l'unicité et l'ancrage de la bonne réponse et signale les éventuelles hallucinations. L'usage de l'API est journalisé pour le suivi. La clé API reste en variable d'environnement côté serveur.

## 9. Contraintes non fonctionnelles

Application mono-utilisateur, locale, pensée pour le mobile d'abord (PWA responsive). Le délai d'étude fixé n'est jamais dépassé. L'ingestion doit dégrader proprement si un cours présente une structure différente (découpage par longueur quand la table des matières est absente ou inexploitable). Le contenu généré n'est pas modifiable à la main, choix assumé, mais chaque fiche et chaque question renvoient à leur section source, ce qui permet une vérification rapide contre le cours officiel.

## 10. Hypothèses et points de vigilance

Avant la remise, aucun corrigé n'existe : les bonnes réponses sont déduites par l'IA, d'où l'agent de vérification et la traçabilité systématique vers les sections. Les cours CMDQ suivent en général la même structure (table des matières, gabarits réguliers), mais l'ingestion doit rester tolérante. Les tableaux importants (besoins particuliers, aliments riches) figurent dans la couche texte et doivent se retrouver dans les fiches, car plusieurs questions d'examen en dépendent directement.

## 11. Jalons de développement suggérés

- **M1** : socle technique (Next.js, Prisma et SQLite, PWA), écran d'import, extraction du texte des deux PDF, affichage des sections découpées.
- **M2** : pipeline d'ingestion IA (correspondance examen vers sections, déduction des réponses, génération des fiches et des quiz) avec l'agent de vérification.
- **M3** : plan d'étude (délai configurable, rythme non bloquant, recalage en cas de jours sautés) et étude quotidienne (fiche, mini-quiz, progression).
- **M4** : répétition espacée et examen blanc avec correction.
- **M5** : questions-réponses avec indication de source, import du corrigé officiel, suivi de l'usage API.

## 12. Critères d'acceptation

- À partir du cours 354 et de son examen, l'application produit un parcours d'au plus N jours.
- Chaque question générée a exactement une bonne réponse, validée par l'agent de vérification, avec renvoi à une section.
- Chaque question de l'examen officiel est rattachée à au moins une fiche du parcours.
- L'utilisateur peut compléter plusieurs fiches en une seule session et terminer avant l'échéance.
- L'examen blanc renvoie un score sur 100 et indique la réussite ou l'échec au seuil de 80 %.
- Les réponses du module questions-réponses affichent leur source (cours ou extérieur).
- Si des jours sont sautés, le plan se recompacte sans dépasser le plafond.
- Tout fonctionne en local derrière le tunnel, sans jamais exposer la clé API.
