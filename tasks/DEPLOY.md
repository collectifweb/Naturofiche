# Déploiement NaturoFiche — WHC cPanel (naturo.le-caribou.ca)

Doc de déploiement **autonome**. App = Next.js 16 standalone, process Node persistant
sous Passenger/LiteSpeed. **Ingestion faite en local** (job IA ~13 min, incompatible
mutualisé) ; le serveur ne fait que servir + Q&A/quiz/examen.

## Accès serveur

- Host **173.209.32.227**, SSH **port 27**, user **gdn73831**, clé `~/.ssh/id_rsa_cpanel`.
  `ssh -i ~/.ssh/id_rsa_cpanel -p 27 gdn73831@173.209.32.227`
- cPanel **CloudLinux/LiteSpeed**, kernel LVE el8, OpenSSL 1.1.1. CageFS actif.
- **Node 20.20.2** via sélecteur CloudLinux (`/opt/alt/alt-nodejs20/root/usr/bin/`).
- App root : **`/home/gdn73831/public_html/naturo`**, sous-domaine `naturo.le-caribou.ca`
  (DNS → 173.209.32.227 OK, SSL AutoSSL OK, HTTPS sert déjà).
- Gestion de l'app Node : `cloudlinux-selector` (équiv. « Setup Node.js App »).

## Déjà fait ✅

- `next.config.ts` → `output: "standalone"`.
- App Node créée :
  `cloudlinux-selector create --json --interpreter nodejs --version 20 --app-root public_html/naturo --app-uri "/" --domain naturo.le-caribou.ca --app-mode production`
  → venv `~/nodevenv/public_html/naturo/20/`, `.htaccess` Passenger (startup `app.js`).
- Bundle uploadé (rsync, ssh -p 27) dans `public_html/naturo/` :
  `.next/standalone/` (server.js + node_modules), `.next/static/`, `public/`.
- `cloudlinux-selector set ... --startup-file server.js --env-vars '{...}'` + `restart`.
- HTTPS répond, Next tourne. **Mais 500** sur la couche DB → voir blocage.

## ⛔ Blocage : moteur Prisma incompatible CageFS

Avec `provider = "sqlite"`, le **moteur Rust de Prisma ne peut ouvrir AUCUN fichier
SQLite** sur cet hôte (`Error code 14: Unable to open the database file`, même pour une
base neuve dans `/tmp`), alors que **python `sqlite3` lit la base sans problème**. Ce
n'est ni un chemin ni des permissions (tous les chemins échouent, fichier valide,
dossier inscriptible) : c'est l'I/O fichier du moteur Prisma bloquée sous CageFS.

## ✅ Fix retenu : MySQL du serveur + driver adapter pur-JS

MySQL managé (cPanel + phpMyAdmin) : Prisma s'y connecte **par le réseau**, pas par des
syscalls fichier → contourne CageFS. Avec **`@prisma/adapter-mariadb` (pur JS)** on
**n'utilise plus le moteur Rust** ni aucun module natif à compiler. C'est aussi le
pattern de l'app `caboche` déjà en place sur ce compte.

### 1. Créer la base MySQL (cPanel)
```bash
S='ssh -i ~/.ssh/id_rsa_cpanel -p 27 gdn73831@173.209.32.227'
$S "uapi Mysql create_database name=gdn73831_naturo"
$S "uapi Mysql create_user name=gdn73831_naturo password='<MDP_FORT>'"
$S "uapi Mysql set_privileges_on_database user=gdn73831_naturo database=gdn73831_naturo privileges=ALL"
```
(ou via l'UI cPanel « Bases de données MySQL ». Noter user/db = `gdn73831_naturo`.)

### 2. Code (local)
- `npm i @prisma/adapter-mariadb mariadb`
- `prisma/schema.prisma` : `datasource db { provider = "mysql"; url = env("DATABASE_URL") }`.
  Retirer `binaryTargets` (inutile avec un adapter). `driverAdapters` est GA en Prisma
  6.19 ; si une version l'exige : `generator client { previewFeatures = ["driverAdapters"] }`.
  Les listes restent du **String JSON** (TEXT MySQL) ; les "enums" restent des String. RAS.
- `src/lib/prisma.ts` : instancier avec l'adapter
  ```ts
  import { PrismaClient } from "@prisma/client";
  import { PrismaMariaDb } from "@prisma/adapter-mariadb";
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!); // mysql://user:pw@host:3306/db
  export const prisma = global.prismaGlobal ?? new PrismaClient({ adapter });
  ```
  (garder le singleton hot-reload existant.)

### 3. Créer le schéma sur MySQL (via tunnel SSH)
```bash
ssh -i ~/.ssh/id_rsa_cpanel -p 27 -N -L 3307:localhost:3306 gdn73831@173.209.32.227 &  # tunnel
DATABASE_URL="mysql://gdn73831_naturo:<MDP>@127.0.0.1:3307/gdn73831_naturo" npx prisma db push
```

### 4. Migrer les données SQLite → MySQL (le plus rapide)
Le client Prisma SQLite **marche en local**. Script jetable (racine projet,
`node --env-file`), 2 clients Prisma (un SQLite source, un MySQL via tunnel), copie dans
l'ordre des FK : `Course → Section, StudyUnit → (Fiche, Progress), Question → ReviewItem,
OfficialKey, ApiUsageLog, QaMessage`. Conserver les `id` (cuid) à l'identique.
*Alternative* : re-ingérer en local en pointant `DATABASE_URL` sur le tunnel MySQL
(~13 min, ~8 $) — plus cher mais zéro script de copie.

### 5. Rebuild + redeploy
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run build
RSH='ssh -i ~/.ssh/id_rsa_cpanel -p 27 -o BatchMode=yes'; D='gdn73831@173.209.32.227:public_html/naturo'
rsync -a --no-perms --omit-dir-times -e "$RSH" .next/standalone/ "$D/"
rsync -a --no-perms --omit-dir-times -e "$RSH" .next/static/   "$D/.next/static/"
rsync -a --no-perms --omit-dir-times -e "$RSH" public/         "$D/public/"
# plus besoin d'uploader prisma/dev.db
```
Mettre à jour l'env serveur (DATABASE_URL MySQL en **localhost socket**, pas le tunnel) :
```bash
EV='{"DATABASE_URL":"mysql://gdn73831_naturo:<MDP>@localhost:3306/gdn73831_naturo","NODE_ENV":"production","ANTHROPIC_API_KEY":"<clé>","INGEST_MODEL":"claude-opus-4-8","VERIFY_MODEL":"claude-sonnet-5","QA_MODEL":"claude-haiku-4-5-20251001","ACCESS_PASSWORD":"<METTRE_UN_MDP>"}'
B64=$(printf '%s' "$EV" | base64 -w0)
ssh -i ~/.ssh/id_rsa_cpanel -p 27 gdn73831@173.209.32.227 \
  "EV=\$(echo $B64 | base64 -d); cloudlinux-selector set --json --interpreter nodejs --app-root public_html/naturo --startup-file server.js --skip-web-check --env-vars \"\$EV\"; cloudlinux-selector restart --json --interpreter nodejs --app-root public_html/naturo"
```

### 6. Vérifications
- `curl -I https://naturo.le-caribou.ca/` → **200**, home affiche « L'oligothérapie ».
- Ouvrir une fiche (markdown + tableaux), faire un mini-quiz, poser une question Q&A
  (réponse + source), lancer l'examen blanc.
- En cas d'erreur : `tail -n 40 ~/public_html/naturo/stderr.log`.

## ⚠️ À ne pas oublier

- **ACCESS_PASSWORD est VIDE** actuellement → le site est **public/ouvert**. Mettre un
  mot de passe dans l'env serveur (le proxy `src/proxy.ts` active la garde si défini).
- **Pas d'ingestion sur le serveur** : pour un nouveau cours, ingérer en local puis
  recopier les données vers MySQL (script §4) — ou ingérer en pointant le tunnel.
- **Dev local** après bascule MySQL : `provider=mysql` → utiliser un MariaDB local **ou**
  le tunnel SSH vers le MySQL serveur comme base de dev.
- Commits **sans attribution Claude**.

## Prompt de reprise (session fraîche / Codex)

> Repo NaturoFiche (~/Apps-coding/Naturofiche), à déployer sur cPanel WHC. Lis
> `tasks/DEPLOY.md` EN ENTIER : l'app Next.js standalone est déjà uploadée et tourne sous
> Passenger sur `naturo.le-caribou.ca` (HTTPS OK), mais la couche DB est bloquée (moteur
> Rust de Prisma incompatible CageFS sur SQLite). Applique le fix documenté : basculer sur
> **MySQL du serveur via `@prisma/adapter-mariadb`** (provider mysql, adapter dans
> `src/lib/prisma.ts`, créer la base cPanel `gdn73831_naturo`, `prisma db push` via tunnel
> SSH port 27, migrer les données de `prisma/dev.db` vers MySQL, rebuild standalone,
> re-rsync, mettre `DATABASE_URL` MySQL + un `ACCESS_PASSWORD` dans l'env serveur,
> restart, vérifier HTTPS 200). SSH : `-i ~/.ssh/id_rsa_cpanel -p 27 gdn73831@173.209.32.227`.
> Node 20 local : `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`. Commits sans
> attribution Claude. Plan validé avant d'exécuter.
