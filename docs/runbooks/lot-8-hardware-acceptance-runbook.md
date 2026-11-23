# Lot 8 — Runbook de recette physique LAN, Raspberry Pi et imprimante Xprinter 80×104 mm

- **Date de révision :** 23 novembre 2026
- **Statut global du Lot 8 :** **PRÉPARATION DOCUMENTAIRE — `NON TESTÉ`** *(aucune exécution physique, aucun déploiement et aucune modification des comptes réels n'ont été réalisés à la date de ce document)*
- **Version candidate vérifiée sur `main` :** `11dcd39dcacec051de695d908e3d036e4cf70d0f` (CI `main` verte — run `45158380375`, PR `#941`)

> [!IMPORTANT]
> **Séparation stricte des responsabilités et des étapes :**
> Ce runbook est un protocole exécutable par un opérateur humain. Il sépare explicitement quatre phases qui ne doivent jamais être confondues :
> 1. **Préparation** (inventaire non sensible, prérequis, sauvegarde et contrôle de restauration isolé) ;
> 2. **Autorisation de déploiement** (feu vert écrit explicite de l'autorité humaine) ;
> 3. **Exécution** (mise à jour contrôlée et déroulement de la recette physique sur comptes de test) ;
> 4. **Réception** (décision Go/No-Go consignée sur preuves réelles ; aucune étape n'est déclarée réussie sans exécution réelle).

---

## Documents de référence (ne pas dupliquer)

Consulter les documents existants du dépôt pour les procédures déjà établies :

- Installation Linux ARM64/AMD64, scripts de sauvegarde et de test de restauration : [`deploy/linux/README.md`](../../deploy/linux/README.md), [`deploy/linux/compose.yaml`](../../deploy/linux/compose.yaml), [`deploy/linux/backup.sh`](../../deploy/linux/backup.sh), [`deploy/linux/restore-verify.sh`](../../deploy/linux/restore-verify.sh).
- Pile cliente locale (si utilisée sur le site) : [`deploy/client/README.md`](../../deploy/client/README.md), [`deploy/client/compose.yaml`](../../deploy/client/compose.yaml).
- Guide d'installation matériel Raspberry Pi 5 & XPrinter 80 mm : [`docs/deployment/DEPLOIEMENT_RASPBERRY_PI_5.html`](../deployment/DEPLOIEMENT_RASPBERRY_PI_5.html).
- Matrice de santé et readiness (`/healthz/` et `/readyz/`) : [`docs/runbooks/health-readiness-matrix.md`](health-readiness-matrix.md).
- Roadmap programme et historique des fusions : [`docs/ai-agents/macro-goals/prototype-to-production-roadmap.md`](../ai-agents/macro-goals/prototype-to-production-roadmap.md).
- Matrice normative d'accès et plan d'implémentation : [`docs/audits/USER_ACCESS_NORMATIVE_MATRIX_LOT_A0_2026_11_16.md`](../audits/USER_ACCESS_NORMATIVE_MATRIX_LOT_A0_2026_11_16.md) et [`docs/ai-agents/implementation-plans/access-and-shared-dossiers-2026-11-16.md`](../ai-agents/implementation-plans/access-and-shared-dossiers-2026-11-16.md).

---

## 1. Préparation (non mutative)

### 1.1. Version actuellement installée vs version candidate

Avant toute opération, relever la version actuellement en service sur le Raspberry Pi et la comparer à la version candidate approuvée :

| Élément | Valeur / Constat | Statut |
|---|---|---|
| **Version candidate (`main`)** | `11dcd39dcacec051de695d908e3d036e4cf70d0f` (PRs `#897`–`#901`, `#910`–`#913`, `#918`–`#923`, `#925`–`#941`, CI `main` `45158380375` verte) | Confirmé dépôt |
| **Chemin du dépôt sur le Raspberry Pi** | *À renseigner par l'humain (ex. répertoire où se trouve le clone Git actif)* | Non confirmé |
| **SHA actuellement installé sur le Raspberry Pi** | *À relever via `git rev-parse HEAD` dans le répertoire actif* | Non confirmé |
| **Fichier Compose actif sur le Raspberry Pi** | *À confirmer : `deploy/linux/compose.yaml`, `deploy/client/compose.yaml`, ou autre fichier local* | Non confirmé |
| **Migrations en attente par rapport à la version installée** | *À relever avant migration via `python backend/manage.py showmigrations --plan` (les lots A0–A6, B1–B4 et `#941` n'ajoutent aucune nouvelle migration)* | Non confirmé |

Commandes de relevé en lecture seule (à exécuter dans le répertoire d'installation du Raspberry Pi, en adaptant `<COMPOSE_FILE>` et `<ENV_FILE>` sans jamais afficher le contenu de `<ENV_FILE>`) :

```sh
git rev-parse HEAD
git status --short
docker compose --env-file <ENV_FILE> -f <COMPOSE_FILE> ps
docker compose --env-file <ENV_FILE> -f <COMPOSE_FILE> exec -T backend \
  python backend/manage.py showmigrations --plan | tail -n 30
```

### 1.2. Inventaire matériel, logiciel et réseau (non sensible)

Compléter ce tableau sur site **sans y consigner aucun mot de passe, clé, token ni fichier `.env`** :

| Catégorie | Champ | Valeur relevée sur site | Statut |
|---|---|---|---|
| **Raspberry Pi** | Modèle exact, architecture (`uname -m`), RAM (`free -h`) | *À renseigner par l'humain* | Non confirmé |
| **Raspberry Pi** | OS et noyau (`cat /etc/os-release`, `uname -r`), espace disque libre (`df -h`) | *À renseigner par l'humain* | Non confirmé |
| **Raspberry Pi** | Versions Docker (`docker --version`, `docker compose version`) | *À renseigner par l'humain* | Non confirmé |
| **Raspberry Pi** | Volumes Docker actifs (`docker volume ls`, sans les supprimer) | *À renseigner par l'humain* | Non confirmé |
| **Services coexistants** | Autres conteneurs ou services sur la machine (ex. `n8n`, services système) à préserver impérativement | *À renseigner par l'humain* | Non confirmé |
| **Réseau LAN** | Sous-réseau LAN, adresse IP locale fixe / nom mDNS, ports ouverts (`ss -tulpn`) | *À renseigner par l'humain* | Non confirmé |
| **Réseau LAN** | Confirmation qu'aucune exposition publique Internet n'existe sur l'application ni sur PostgreSQL/Redis | *À confirmer par l'humain* | Non confirmé |
| **Terminal LAN A** | Type d'appareil (PC/tablette), OS, navigateur et version exacte | *À renseigner par l'humain* | Non confirmé |
| **Terminal LAN B** | Type d'appareil (PC/tablette), OS, navigateur et version exacte | *À renseigner par l'humain* | Non confirmé |
| **Imprimante Xprinter** | Modèle exact Xprinter 80 mm, mode de liaison (USB ou Ethernet LAN), adresse/file d'impression (CUPS ou pilote OS) | *À renseigner par l'humain* | Non confirmé |
| **Imprimante Xprinter** | Rouleau installé (80 mm thermique), format papier configuré (`80 mm × 104 mm`), découpe automatique ou arrachage manuel | *À renseigner par l'humain* | Non confirmé |

### 1.3. Prérequis et informations manquantes à fournir par l'humain

Les éléments suivants ne peuvent pas être déduits du dépôt Git et doivent être confirmés avant la porte d'autorisation de déploiement :

1. **Topologie réelle du serveur :** fichier Compose effectivement en production (`deploy/linux/compose.yaml` vs `deploy/client/compose.yaml` vs surcharge locale) et nom exact du fichier d'environnement sur le serveur.
2. **Emplacement de sauvegarde hors serveur chiffré :** disque externe chiffré, NAS LAN ou stockage distant destiné à recevoir la copie du dump PostgreSQL et de l'archive médias privés.
3. **Fenêtre de maintenance et comptes de test dédiés :** créneau sans saisie commerciale simultanée pour la mise à jour, et liste des comptes de test temporaires (`recette_*`) isolés des comptes réels.
4. **Spécifications réelles de l'imprimante Xprinter sur site :** référence matérielle exacte, mode de connexion effectif (USB sur poste/Pi ou IP LAN) et pilote/profil papier disponible sur les terminaux A et B.
5. **Inventaire non sensible des comptes réels actuels** (voir section 4).

### 1.4. Préservation des données, services tiers et cloisonnement réseau

- **Aucune exposition publique :** PostgreSQL (`db`) et Redis (`redis`) doivent rester confinés au réseau Docker interne (`internal: true` dans `deploy/linux/compose.yaml`, `client_internal` dans `deploy/client/compose.yaml`) sans aucun port publié sur `0.0.0.0`. Le serveur ERP lui-même reste limité au réseau LAN (vérifier l'absence de redirection de port routeur / exposition publique).
- **Préservation des données et services existants :**
  - Ne **jamais** exécuter `docker compose down -v`, `docker volume rm` ou `docker system prune --volumes`.
  - Ne toucher à aucun conteneur, réseau ou volume non ERP présent sur le Raspberry Pi (ex. `n8n` ou tout autre service tiers).
- **Hygiène stricte des secrets :** ne jamais lire, afficher (`cat`, `env`, `printenv`), copier dans un ticket/capture ou journaliser un fichier `.env`, `production.env`, `.env.client`, `.env.rpi5`, mot de passe, clé privée ou jeton.

---

## 2. Sauvegarde et retour arrière

### 2.1. Sauvegarde cohérente (base PostgreSQL + médias privés)

Avant toute mise à jour ou migration, créer une sauvegarde **horodatée et cohérente** des deux sources de données persistantes :

1. **Base de données PostgreSQL :**
   - **Cas `deploy/linux/compose.yaml` :** exécuter depuis `deploy/linux/` le script existant documenté dans [`deploy/linux/README.md`](../../deploy/linux/README.md), puis récupérer l'horodatage exact du fichier créé dans `STAMP` (le script `backup.sh` calcule son propre horodatage interne et ne l'exporte pas dans le shell parent) :
     ```sh
     cd deploy/linux
     ./backup.sh
     # Relever le nom exact affiché (backups/postgres-<UTC_STAMP>.dump) et renseigner :
     STAMP="<UTC_STAMP_DU_DUMP>"
     BACKUP_DIR="backups"
     COMPOSE_FILE="compose.yaml"
     ENV_FILE="production.env"
     ```
     Ce script produit `deploy/linux/backups/postgres-<UTC_STAMP>.dump` (`pg_dump --format=custom`, `umask 077`).
   - **Cas `deploy/client/compose.yaml` (ou autre pile Compose à la racine du dépôt) :** exécuter depuis la racine du dépôt sans exposer aucune variable sensible :
     ```sh
     umask 077
     BACKUP_DIR="backups"
     COMPOSE_FILE="<COMPOSE_FILE>"
     ENV_FILE="<ENV_FILE>"
     mkdir -p "$BACKUP_DIR"
     STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
     docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
       sh -c 'pg_dump --format=custom -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
       > "${BACKUP_DIR}/postgres-${STAMP}.dump"
     ```
2. **Médias privés (`/app/backend/media` — pièces jointes privées `CIN`, artefacts HTML/PDF générés) :**
   - *Point de vigilance vérifié dans le dépôt :* [`deploy/linux/backup.sh`](../../deploy/linux/backup.sh) sauvegarde uniquement PostgreSQL et **ne sauvegarde pas le volume média** (`production_media_data` ou `client_media_data`).
   - Depuis le même répertoire de travail (avec `STAMP`, `BACKUP_DIR`, `COMPOSE_FILE` et `ENV_FILE` définis à l'étape 1), archiver les médias privés et calculer les empreintes SHA-256 :
     ```sh
     umask 077
     docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend \
       tar -czf - -C /app/backend media > "${BACKUP_DIR}/media-${STAMP}.tar.gz"
     sha256sum "${BACKUP_DIR}/postgres-${STAMP}.dump" "${BACKUP_DIR}/media-${STAMP}.tar.gz" \
       > "${BACKUP_DIR}/checksums-${STAMP}.sha256"
     ```
3. **Copie hors serveur :** copier immédiatement le `.dump`, le `.tar.gz` et le `.sha256` sur le support chiffré hors du Raspberry Pi, et vérifier `sha256sum -c "${BACKUP_DIR}/checksums-${STAMP}.sha256"` sur la copie.

### 2.2. Contrôle de restauration dans un environnement isolé

Ne **jamais** tester une restauration sur la base ou le volume de production.

1. **Restauration PostgreSQL isolée :**
   - Pour `deploy/linux/` (depuis `deploy/linux/`, avec le même `STAMP`), exécuter le script officiel [`deploy/linux/restore-verify.sh`](../../deploy/linux/restore-verify.sh) :
     ```sh
     ./restore-verify.sh "${BACKUP_DIR}/postgres-${STAMP}.dump"
     ```
     Ce script lance un conteneur `postgres:17.10-bookworm` éphémère (`--network none`, aucun port publié, aucun volume de production), exécute `pg_restore --exit-on-error`, vérifie `SELECT 1 FROM django_migrations LIMIT 1`, puis détruit le conteneur.
   - Si le serveur n'utilise pas `deploy/linux/production.env`, reproduire exactement la même vérification isolée (`--network none`, conteneur éphémère détruit en fin de contrôle) en passant le fichier d'environnement actif via `--env-file` sans jamais l'afficher.
2. **Contrôle de l'archive médias privés :**
   - Depuis le même répertoire de travail, vérifier les empreintes et la lisibilité de l'archive dans un répertoire temporaire isolé, puis supprimer ce répertoire :
     ```sh
     VERIFY_DIR="$(mktemp -d)"
     sha256sum -c "${BACKUP_DIR}/checksums-${STAMP}.sha256"
     tar -tzf "${BACKUP_DIR}/media-${STAMP}.tar.gz" | head -n 20
     tar -xzf "${BACKUP_DIR}/media-${STAMP}.tar.gz" -C "$VERIFY_DIR"
     rm -rf "$VERIFY_DIR"
     ```
3. **Condition de passage :** la mise à jour est **interdite (No-Go)** tant que le contrôle de restauration isolé de la base et le contrôle d'intégrité de l'archive médias ne sont pas tous deux `PASS`.

### 2.3. Procédure de retour arrière (rollback) et traitement des écritures post-bascule

#### Conditions de déclenchement du rollback

Déclencher le rollback immédiatement si l'un des événements suivants survient après bascule :
- `GET /healthz/` (`200` `{"status": "ok"}`) ou `GET /readyz/` (`200` `{"status": "ready", "checks": {"database": "ok", "migrations": "ok", "redis": "ok"}}` — contrôle réel de `backend/config/health.py`, qui renvoie `503` si une migration reste non appliquée) ne répond pas `200` après redémarrage ;
- `python backend/manage.py check --deploy` remonte une erreur bloquante ;
- une migration échoue ou laisse la base dans un état incohérent ;
- une régression bloquante est constatée sur l'authentification, les droits d'accès (fuite de document privé ou action interdite acceptée), l'intégrité financière/stock ou l'impression des reçus.

#### Étapes de retour à la version précédente

1. **Geler immédiatement les écritures :** arrêter le point d'entrée HTTP selon la pile Compose active afin d'empêcher toute nouvelle saisie pendant l'incident :
   - Pile `deploy/linux/compose.yaml` (inclut `caddy` et `frontend`, depuis la racine du dépôt) :
     ```sh
     docker compose --env-file deploy/linux/production.env -f deploy/linux/compose.yaml stop caddy frontend
     ```
   - Pile `deploy/client/compose.yaml` (sans service `caddy`) :
     ```sh
     docker compose --env-file <ENV_FILE> -f deploy/client/compose.yaml stop frontend
     ```
2. **Prendre une sauvegarde de l'état au moment de l'incident** (même procédure qu'en §2.1 avec suffixe `pre-rollback`) afin de ne perdre aucune trace des écritures intervenues après la bascule.
3. **Traitement des écritures intervenues après la bascule :**
   - Relever dans PostgreSQL / l'audit applicatif la liste horodatée de toutes les créations/modifications survenues depuis l'heure de bascule (clients, devis, signatures, paiements, reçus émis, mouvements de caisse/stock, événements d'audit).
   - **Cas A — Aucune migration destructive / schéma rétrocompatible** *(cas nominal si la version installée possédait déjà les migrations antérieures aux lots A0–A6 / B1–B4 / `#941`, qui n'ajoutent aucune migration)* : revenir uniquement au SHA applicatif précédent (`git checkout <SHA_PRECEDENT>` puis `docker compose ... up -d --build`) en **conservant** la base et les médias intacts, puis revérifier `/healthz/` et `/readyz/`.
   - **Cas B — Migration incompatible imposant une restauration de la sauvegarde pré-bascule :**
     - Ne restaurer qu'après **validation écrite de l'autorité humaine** et archivage du dump `pre-rollback` ;
     - Restaurer le dump PostgreSQL et l'archive médias pré-bascule dans les volumes (sans `docker compose down -v` non maîtrisé), redémarrer sur `<SHA_PRECEDENT>`, puis **réconcilier / ressaisir manuellement et de manière tracée** chaque écriture métier légitime intervenue après bascule dans le registre d'incident (avec justificatifs reçus/paiements).
4. **Clôture de l'incident :** vérifier `/healthz/`, `/readyz/`, les journaux (`docker compose ... logs --tail=100 backend`) et consigner la cause, le SHA restauré et le sort des écritures post-bascule.

---

## 3. Recette physique sur site (LAN, 2 terminaux, Xprinter 80×104 mm)

### 3.1. Conditions d'exécution

- **Contrôles de santé préalables (voir [`health-readiness-matrix.md`](health-readiness-matrix.md) et `backend/config/health.py`) :**
  - `GET /healthz/` → `200` `{"status": "ok"}`
  - `GET /readyz/` → `200` `{"status": "ready", "checks": {"database": "ok", "migrations": "ok", "redis": "ok"}}` *(le contrôle live `"migrations": "ok"` prévaut sur l'exemple historique F45 de `health-readiness-matrix.md`)*
  - `docker compose --env-file <ENV_FILE> -f <COMPOSE_FILE> exec -T backend python backend/manage.py check --deploy` → 0 erreur bloquante.
- **Deux terminaux physiques distincts** (Terminal A et Terminal B) sur le LAN, avec sessions navigateur indépendantes (aucun partage de profil navigateur).
- **Comptes de test dédiés uniquement** (ex. `recette_gerant`, `recette_comm_a`, `recette_comm_b`, `recette_compta`, `recette_magasinier`, `recette_livreur`, `recette_admin_tech`), créés explicitement pour la recette et **supprimés ou désactivés après réception**. Ne **jamais** exécuter les scénarios de révocation ou suspension sur un compte réel d'exploitation.
- **Rappel des profils réellement implémentés sur `11dcd39` :**
  - `owner_manager` (`is_staff=False`) : `canManageIdentity`, `canSensitiveWrite`, `canViewAudit`, `canManageFinance`, `canManageInventory`, `canOperateLogistics`, `canOperateCashbox`, `canSuperviseCashbox`, `canOverrideLogistics`, `canViewPayroll`, `canEditPayroll`, `canActivatePayroll`, réglages commerciaux D02 (`HasCommercialTermsSettingsAccess`), 7 catégories de rapports.
  - `reservation_sensitive_operator` (Commercial) : `canSensitiveWrite`, `canViewAudit`, `canOperateLogistics`, `canOperateCashbox`, accès banque préservé (`HasFinancialOperationAccess`), dossiers partagés & documents privés (`CIN`, contrats, factures), enregistrement d'acompte en interface dossier (`POST /api/v1/payments/deposits/record/` soumis à INV-SEQ-01), 7 catégories de rapports ; refus réglages D02 (`403`).
  - `accountant` (Comptable) : `canManageFinance`, `canViewPayroll`, `canActivatePayroll`, banque (`#bank-settings`), règlement de facture ouverte dans `#commercial-ops` (`Régler` → `POST /api/v1/billing/invoices/<id>/settle/`), paiements directs via `POST /api/v1/payments/` sur contrat signé uniquement (`400` `contract_signature_required_before_payment` avant signature), factures (`/artifact/` `200`), rapports `["payments", "sales_billing"]` ; refus `CIN` & contrats privés (`403`), refus réserves D01 (signature, confirmation, enregistrement d'acompte `/api/v1/payments/deposits/record/`, avoirs, annulation paiement `403`).
  - `storekeeper` (Magasinier) : `canManageInventory`, `canOperateLogistics`, emplacements de stockage (`HasInventoryManagementAccess`), BL (`delivery_note` `200`), rapport `["inventory"]` uniquement ; refus banque, factures, contrats, `CIN`, rapports autres (`403`).
  - `delivery_driver` (Livreur — catalogue existant) : toutes capacités privilégiées à `False`, `reportCategories=[]`, refus stock/banque/docs/rapports (`403`).

---

### 3.2. Scénarios de recette physique (tous initialisés à `NON TESTÉ`)

#### R8-01 — Connexion, déconnexion et bascule de compte sur deux terminaux LAN
- **Prérequis :** Terminal A et Terminal B connectés au LAN, URL ERP accessible, comptes de test `recette_comm_a` et `recette_comm_b` actifs.
- **Étapes :**
  1. Sur Terminal A, ouvrir l'ERP, se connecter avec `recette_comm_a`, puis recharger la page (`F5`).
  2. Sur Terminal B, ouvrir l'ERP, se connecter avec `recette_comm_b`, puis recharger la page (`F5`).
  3. Sur Terminal B, ouvrir le menu utilisateur → cliquer **Déconnexion**, recharger (`F5`), puis se reconnecter avec `recette_compta`.
- **Résultat attendu :** Chaque terminal conserve sa propre session après rechargement sans interférence ; après déconnexion sur Terminal B, l'écran `Connexion opérateur` est affiché même après rechargement ; après reconnexion avec `recette_compta`, l'identité, les menus et les capacités affichées reflètent strictement `recette_compta`.
- **Preuve à conserver :** Captures datées des deux terminaux (session active, écran après déconnexion, session après bascule) + horodatage dans `Connexions & Appareils`.
- **Statut :** `[ ] PASS` / `[ ] FAIL` / `[x] NON TESTÉ`

#### R8-02 — Reprise d'un dossier créé par un collègue et paiement avant/après signature (Commercial A → Commercial B)
- **Prérequis :** Terminal A connecté en `recette_comm_a`, Terminal B connecté en `recette_comm_b` ; client de test avec pièce d'identité privée (`CIN`) et devis Titan généré (contrat généré **non signé**).
- **Étapes :**
  1. Sur Terminal A (`recette_comm_a`), créer un dossier Titan (client de test + articles + contrat généré + pièce `CIN`), relever la référence et vérifier l'accès à `#bank-settings` (`Paramètres bancaires`) et le refus de modification sur `#hahitantsoa-settings`.
  2. Sur Terminal B (`recette_comm_b`), ouvrir ce même dossier depuis la liste ou son lien direct.
  3. Sur Terminal B, consulter les documents (facture/proforma, contrat et pièce `CIN`), puis vérifier qu'aucun enregistrement d'acompte n'est accepté **avant signature** du contrat (règle INV-SEQ-01).
  4. Toujours sur Terminal B, marquer le contrat comme signé (**Marquer contrat signé**), puis enregistrer un acompte de test depuis l'interface dossier (`POST /api/v1/payments/deposits/record/`).
  5. Recharger la page (`F5`) sur **Terminal A et Terminal B**.
- **Résultat attendu :** Terminal B ouvre le dossier du collègue et accède aux documents privés autorisés ; le créateur initial affiché reste **`recette_comm_a`** (non écrasé) ; le paiement avant signature est bloqué (aucune ligne de paiement créée) ; après signature, la signature et l'acompte sont persistés en PostgreSQL et visibles après rechargement sur les deux terminaux ; l'accès commercial à `#bank-settings` est préservé ; la modification de `#hahitantsoa-settings` est refusée (`Accès non autorisé` / `403`).
- **Preuve à conserver :** Captures écran Terminal A et Terminal B après rechargement montrant la référence, l'auteur initial `recette_comm_a`, le refus avant signature, l'état signé et l'acompte enregistré.
- **Statut :** `[ ] PASS` / `[ ] FAIL` / `[x] NON TESTÉ`

#### R8-03 — Parcours Comptable (`accountant`) : D01, D05, banque, règlement et séquencement contrat
- **Prérequis :** Terminal B connecté en `recette_compta` ; un dossier signé (`R8-02`), une facture **ouverte** de test, une facture **réglée** de test et un second devis **non signé** disponibles.
- **Étapes :**
  1. Ouvrir `#bank-settings` (`Paramètres bancaires`) et consulter/enregistrer un profil bancaire de test (`200`/`201`).
  2. Ouvrir `#commercial-ops` :
     - sur une facture **ouverte**, vérifier que **`Régler`** est visible (exécuter un règlement de test → `POST /api/v1/billing/invoices/<id>/settle/` `200`, puis recharger `F5`) et que l'action **`Annuler`** (icône d'annulation) est masquée ;
     - sur une facture **réglée**, vérifier que **`Avoir`** est masqué pour le Comptable.
  3. Ouvrir le dossier partagé de `R8-02` : télécharger/prévisualiser la facture (autorisé `200`), puis tenter d'ouvrir le contrat privé et la pièce `CIN` (y compris par accès direct si lien connu).
  4. Contrôle du séquencement contrat (INV-SEQ-01) et de la réserve D01 en session authentifiée `recette_compta` (onglet DevTools / requête authentifiée avec jeton CSRF de session) :
     - appeler `POST /api/v1/payments/` sur le devis **non signé** ;
     - appeler `POST /api/v1/payments/` sur le dossier **signé**, puis recharger le dossier (`F5`) ;
     - vérifier qu'un appel à `POST /api/v1/payments/deposits/record/` (action d'acompte UI réservée D01 `HasReservationSensitiveAccess`) est refusé en `403`.
  5. Tenter l'accès direct à `#admin` et `#hahitantsoa-settings` ; vérifier le refus `403` sur les actions réservées D01 (signature de contrat, confirmation de réservation, avoir, annulation de paiement).
- **Résultat attendu :** Banque accessible (`200`/`201`) ; règlement de facture ouverte persisté (`200`) sans accès à `Annuler` ni `Avoir` ; facture accessible (`200`), contrat et `CIN` refusés (`403`, aucune fuite de fichier) ; `POST /api/v1/payments/` avant signature refusé (`400`, code `contract_signature_required_before_payment`, aucune ligne créée) ; `POST /api/v1/payments/` sur contrat signé persisté (`201`) et visible après rechargement ; `POST /api/v1/payments/deposits/record/` refusé (`403`, D01) ; `#admin` et `#hahitantsoa-settings` affichent `Accès non autorisé` ; toute action réservée D01 appelée en direct renvoie `403` sans écriture en base.
- **Preuve à conserver :** Captures `#bank-settings`, `#commercial-ops` (facture ouverte et facture réglée), preuves HTTP DevTools Réseau (`200` facture/règlement, `400` paiement avant signature, `201` paiement signé, `403` sur `CIN`/contrat/`deposits/record`/D01, sans données sensibles).
- **Statut :** `[ ] PASS` / `[ ] FAIL` / `[x] NON TESTÉ`

#### R8-04 — Parcours Gérant Métier (`owner_manager`, non staff)
- **Prérequis :** Terminal A connecté en `recette_gerant` (`is_staff=False`) ; compte de test `recette_admin_tech` (`is_staff=True`) présent.
- **Étapes :**
  1. Ouvrir `#admin` et vérifier la liste des collaborateurs, la synthèse en français des droits, les règles de cumul et le badge distinct **`Admin Technique`** sur `recette_admin_tech` (sans aucun lien vers Django admin `/admin/`).
  2. Ouvrir `#hahitantsoa-settings` (`Conditions commerciales`), modifier une valeur de test (ex. délai de validité), enregistrer, puis recharger (`F5`).
  3. Vérifier qu'un document/contrat déjà émis ou signé avant cette modification conserve ses valeurs historiques intactes (non-rétroactivité D02).
  4. Ouvrir `#reports` et vérifier l'accès aux 7 catégories.
- **Résultat attendu :** Le Gérant pilote les utilisateurs métier et les réglages commerciaux sans être `is_staff` ; la modification D02 persiste après rechargement sans altérer l'historique ; le libellé d'en-tête affiche `Conditions commerciales` ; aucune balise `<main>` imbriquée ni erreur console.
- **Preuve à conserver :** Captures `#admin` (distinction `Admin Technique`), `#hahitantsoa-settings` après rechargement, et contrôle d'un document historique inchangé.
- **Statut :** `[ ] PASS` / `[ ] FAIL` / `[x] NON TESTÉ`

#### R8-05 — Parcours Magasinier (`storekeeper`) et Livreur (`delivery_driver`)
- **Prérequis :** Terminal B utilisé successivement avec `recette_magasinier` puis `recette_livreur` ; dossier partagé de `R8-02` avec bon de livraison, facture et pièce `CIN`.
- **Étapes :**
  1. Connecter `recette_magasinier` : créer un emplacement de stockage de test dans l'inventaire ; ouvrir un bon de livraison ; tenter d'ouvrir `#bank-settings`, `#admin`, la facture financière et la pièce `CIN`.
  2. Déconnecter, puis connecter `recette_livreur` : vérifier les menus disponibles, tenter `#reports`, `#bank-settings`, `#admin`, la création d'emplacement de stockage et l'ouverture des documents privés.
- **Résultat attendu :**
  - **Magasinier :** emplacement de stockage créé (`201`) et persisté, BL accessible (`200`), `#bank-settings` et `#admin` bloqués (`Accès non autorisé`), facture/`CIN`/banque refusés (`403`).
  - **Livreur :** 0 capacité privilégiée, `#reports` (`Accès restreint`), `#bank-settings` et `#admin` (`Accès non autorisé`), appels directs stock/banque/documents refusés (`403`).
- **Preuve à conserver :** Captures des écrans autorisés/refusés et relevés HTTP `201`/`200`/`403` dans DevTools.
- **Statut :** `[ ] PASS` / `[ ] FAIL` / `[x] NON TESTÉ`

#### R8-06 — Révocation de rôle et suspension en direct (comptes de test uniquement)
- **Prérequis :** Terminal A connecté en `recette_gerant` sur `#admin` ; Terminal B connecté en `recette_compta` sur `#bank-settings` (accès banque confirmé `200`).
- **Étapes :**
  1. Sur Terminal A, retirer le rôle `accountant` au compte de test `recette_compta`.
  2. Sur Terminal B (sans déconnexion préalable), tenter une action ou rafraîchir les banques, puis recharger la page (`F5`).
  3. Sur Terminal A, suspendre le compte de test `recette_compta` (`Suspendre`).
  4. Sur Terminal B, déclencher une requête ou recharger la page (`F5`), puis tenter de se reconnecter avec `recette_compta`.
  5. Toujours sur Terminal B, se connecter avec `recette_comm_b` et ouvrir le dossier partagé de `R8-02`.
- **Résultat attendu :** Après retrait du rôle, l'API renvoie immédiatement `403` et le rechargement affiche `Accès non autorisé` sur `#bank-settings` ; après suspension, l'API rejette la session, le rechargement expulse immédiatement vers `Connexion opérateur` et toute reconnexion de `recette_compta` échoue avec une alerte explicite ; la bascule vers `recette_comm_b` rétablit proprement l'accès.
- **Preuve à conserver :** Captures Terminal B (écran `Accès non autorisé` après révocation, expulsion vers `Connexion opérateur` après suspension, alerte de reconnexion refusée, session active `recette_comm_b`).
- **Statut :** `[ ] PASS` / `[ ] FAIL` / `[x] NON TESTÉ`

#### R8-07 — Rapports (`#reports`) : 0 requête initiale non autorisée, anti-course et messages français (PR `#941`)
- **Prérequis :** Onglet **Réseau (Network)** des outils développeur ouvert sur Terminal B ; comptes de test `recette_compta`, `recette_magasinier` et `recette_comm_a`.
- **Étapes :**
  1. Connecter `recette_compta` et ouvrir `#reports` : inspecter les requêtes `/api/v1/reports/*` émises au chargement initial, puis basculer entre `Ventes & Facturation` et `Paiements`, et changer rapidement de période (`Mois` → `Semaine` → `Année`).
  2. Déconnecter et connecter `recette_magasinier`, ouvrir `#reports` : inspecter les requêtes `/api/v1/reports/*` émises.
  3. Connecter `recette_comm_a` et ouvrir `#reports` : vérifier le chargement des 7 catégories.
- **Résultat attendu :**
  - **Comptable :** seuls `Ventes & Facturation` et `Paiements` apparaissent ; **aucune requête** `/api/v1/reports/reservations/` (ni aucune autre catégorie interdite) n'est émise ; **aucun bandeau rouge d'erreur** n'apparaît ; les KPI chargent en `200`.
  - **Magasinier :** seul `Inventaire` apparaît ; **uniquement** `/api/v1/reports/inventory/` (`200`) est appelé ; aucune donnée du Comptable précédent ne subsiste.
  - **Commercial :** `reservations` charge en `200` sans erreur.
  - Si un refus `403` survient sur un clic d'export (ex. `storekeeper`), le message affiché est en français (`Vous n'avez pas l'autorisation d'exporter ce document.`).
- **Preuve à conserver :** Captures écran `#reports` + capture de l'onglet Réseau filtré sur `/api/v1/reports/` pour Comptable et Magasinier.
- **Statut :** `[ ] PASS` / `[ ] FAIL` / `[x] NON TESTÉ`

#### R8-08 — Continuité multi-terminaux LAN (reprise wizard R5, conflit `409`, live refresh R8, stock R9)
- **Prérequis :** Terminal A et Terminal B connectés sur le LAN avec comptes commerciaux de test (`recette_comm_a`, `recette_comm_b`).
- **Étapes :**
  1. **Reprise wizard (R5) :** Sur Terminal A, démarrer `Nouvelle réservation`, saisir client + dates + articles jusqu'à l'étape 2, puis fermer l'onglet sans confirmer ; sur Terminal B, reprendre la session en cours et vérifier que les données saisies sont conservées.
  2. **Conflit optimiste (HTTP `409`) :** Ouvrir la même session wizard sur les deux terminaux à la même révision ; enregistrer une modification sur Terminal A, puis tenter d'enregistrer une modification concurrente depuis Terminal B.
  3. **Rafraîchissement live (R8) & Stock (R9) :** Sur Terminal A, laisser `Planning` ou `Inventaire` ouvert ; sur Terminal B, confirmer une réservation consommant le stock disponible d'un article de test ; vérifier la mise à jour sur Terminal A (au focus ou à l'intervalle de rafraîchissement) et l'affichage du badge `Rupture` (et non `Inactif`) lorsque le stock disponible atteint `0`.
- **Résultat attendu :** Reprise sans perte ; conflit concurrent signalé proprement (`409` sans écrasement silencieux) ; propagation visible sur Terminal A et état stock cohérent (`Rupture` distinct d'`Inactif`).
- **Preuve à conserver :** Captures écran Terminal A et Terminal B (reprise wizard, bannière de conflit `409`, mise à jour planning/stock `Rupture`).
- **Statut :** `[ ] PASS` / `[ ] FAIL` / `[x] NON TESTÉ`

#### R8-09 — Impression physique Xprinter 80×104 mm (reçus & réimpression)
- **Prérequis :** Imprimante Xprinter 80 mm reliée et prête (rouleau 80 mm chargé) ; paramètres d'impression navigateur réglés sur : format papier `80 mm × 104 mm`, **Marges : Aucune** (gérées par le CSS `@page { size: 80mm 104mm; margin: 5mm 4mm 6mm; }` dans `titan.payment_receipt.v1` / `hahitantsoa.payment_receipt.v1`), **En-têtes et pieds de page : Désactivés**, **Échelle : 100 %**.
- **Étapes :**
  1. Depuis Terminal A (puis si pertinent depuis Terminal B), imprimer un reçu de paiement 80×104 mm court (1 page) sur un dossier de test.
  2. Imprimer un reçu long dépassant une hauteur de 104 mm (multi-pages) et un **`Journal Z (80mm / A4)`** depuis la Caisse (`80mm`).
  3. Rouvrir le même reçu depuis l'historique du dossier/caisse et lancer une **réimpression**.
  4. Mesurer les tickets physiques à la règle et contrôler les critères ci-dessous.
- **Résultat attendu (grille physique) :**
  - **Dimensions :** largeur 80 mm, hauteur de page 104 mm conforme au gabarit sans déformation d'échelle.
  - **Marges & alignement :** en-tête, référence officielle, date, désignations et montants centrés/alignés dans la zone imprimable sans rognage gauche/droite.
  - **Lisibilité :** contraste net, montants et libellés parfaitement lisibles ; QR code / code-barres (si présent sur le modèle) scannable par téléphone.
  - **Pagination & absence de troncature :** sur reçu multi-pages, numérotation de page présente et aucun montant ni ligne financière coupé en deux entre deux pages.
  - **Découpe / arrachage :** la ligne de coupe/arrachage tombe sous le pied de ticket sans couper le texte final.
  - **Réimpression :** la réimpression produit un ticket identique (mêmes référence, montants et mise en page, sans erreur ni doublon comptable).
- **Preuve à conserver :** Photos nettes des tickets imprimés (1 page, multi-pages, `Journal Z (80mm / A4)`, réimpression) à côté d'une règle millimétrée + paramètres exacts du dialogue d'impression retenus.
- **Statut :** `[ ] PASS` / `[ ] FAIL` / `[x] NON TESTÉ`

#### R8-10 — Préservation intégrale de l'interface commerciale validée et hygiène navigateur
- **Prérequis :** Parcours R8-01 à R8-09 exécutés sur Terminal A et Terminal B avec console navigateur ouverte.
- **Étapes :**
  1. Parcourir les écrans commerciaux validés (Tableau de bord, Planning, Clients & Prospects, Titan, Hahitantsoa, Documents, Opérations commerciales, Caisse, Paramètres bancaires, Conditions commerciales) avec un profil habilité (`recette_gerant` et `recette_comm_a`).
  2. Vérifier l'affichage sur desktop et tablette/largeur réduite, ainsi que la console développeur (erreurs JS / avertissements React `key`).
- **Résultat attendu :** Aucun écran, champ, filtre ou action commercial validé n'est supprimé ou dégradé ; les avertissements contractuels Titan s'affichent en français sans erreur console React `key` ; 0 exception JavaScript non rattrapée (`pageerror`).
- **Preuve à conserver :** Checklist signée + capture console propre sur les écrans clés.
- **Statut :** `[ ] PASS` / `[ ] FAIL` / `[x] NON TESTÉ`

---

## 4. Comptes réels : inventaire et proposition de réaffectation (gouvernance non mutative)

> [!CAUTION]
> **Interdiction formelle :** ne collecter **aucun mot de passe**, ne réaliser **aucune réaffectation automatique ou silencieuse**, et ne modifier **aucun compte réel** avant validation écrite ligne par ligne par l'autorité humaine.

### 4.1. Principes à respecter (R04 / R07 / R08)

- **Séparation stricte rôles métier vs administration technique :** le gérant métier utilise `owner_manager` (`is_staff=False`, `is_superuser=False`). Ne **jamais** activer `is_staff` ou `is_superuser` pour contourner un refus métier.
- **Rôles métier supportés dans le catalogue réel :** `owner_manager`, `manager`, `reservation_sensitive_operator`, `accountant`, `storekeeper`, `logistics_manager`, `logistics_override`, `cashbox_operator`, `cashbox_supervisor`, `hr_manager`, `delivery_driver`, `cleaner` ; rôle distinct d'administration des accès applicatifs : `identity_admin`.
- **Comptes inactifs :** tout compte `is_active=False` ne possède aucune capacité et ne peut plus se connecter.

### 4.2. Trame d'inventaire minimal non sensible (à renseigner par l'humain)

Relever uniquement des informations non sensibles depuis `#admin` (onglet *Utilisateurs*) ou une requête d'inventaire en lecture seule ne retournant aucun hash de mot de passe :

| # | Identifiant (`username`) | Fonction réelle dans l'entreprise | Actif (`Oui`/`Non`) | Admin technique (`is_staff` / `is_superuser`) | Rôle(s) / groupe(s) actuels | Observations |
|---|---|---|---|---|---|---|
| 1 | *À renseigner* | *À renseigner* | *Oui/Non* | *Non / Non* | *À renseigner* | *Aucune donnée sensible* |
| 2 | *À renseigner* | *À renseigner* | *Oui/Non* | *Non / Non* | *À renseigner* | *Aucune donnée sensible* |
| 3 | *À renseigner* | *À renseigner* | *Oui/Non* | *Non / Non* | *À renseigner* | *Aucune donnée sensible* |

### 4.3. Trame de proposition utilisateur par utilisateur (validation humaine obligatoire)

| Identifiant (`username`) | Rôle(s) actuels | Rôle(s) métier proposés | `is_staff` cible | Impact fonctionnel attendu | Décision humaine (`APPROUVÉ` / `REFUSÉ` / `À DIFFÉRER`) | Date & Visa |
|---|---|---|---|---|---|---|
| *À renseigner* | *Actuel* | *Cible(s)* | `False` *(sauf admin technique justifié)* | *Ex. accès banque + paiements sur contrat signé, sans confirmation* | `[ ] APPROUVÉ  [ ] REFUSÉ  [ ] À DIFFÉRER` | `____ / ____` |
| *À renseigner* | *Actuel* | *Cible(s)* | `False` | *À préciser* | `[ ] APPROUVÉ  [ ] REFUSÉ  [ ] À DIFFÉRER` | `____ / ____` |

*(Si des comptes réels doivent être réaffectés après réception, appliquer uniquement les lignes marquées `APPROUVÉ`, une par une via `#admin`, puis contrôler la session réelle de chaque collaborateur concerné.)*

---

## 5. Critères de décision, Go/No-Go et procès-verbal

### 5.1. Tableau de suivi des scénarios

| ID | Scénario | Criticité | Statut actuel |
|---|---|---|---|
| **R8-01** | Connexion, déconnexion et bascule de compte (2 terminaux LAN) | Bloquant | `NON TESTÉ` |
| **R8-02** | Reprise dossier collègue, attribution initiale, acompte avant/après signature | Bloquant | `NON TESTÉ` |
| **R8-03** | Parcours Comptable (D01, D05, banque, règlement, séquencement contrat) | Bloquant | `NON TESTÉ` |
| **R8-04** | Parcours Gérant Métier non staff (`#admin`, réglages D02, rapports) | Bloquant | `NON TESTÉ` |
| **R8-05** | Parcours Magasinier et Livreur (autorisations et refus directs) | Bloquant | `NON TESTÉ` |
| **R8-06** | Révocation de rôle et suspension en direct (comptes de test uniquement) | Bloquant | `NON TESTÉ` |
| **R8-07** | Rapports `#reports` sans requête initiale non autorisée ni bandeau erroné | Bloquant | `NON TESTÉ` |
| **R8-08** | Continuité LAN (wizard R5, conflit `409`, live refresh R8, stock R9) | Majeur | `NON TESTÉ` |
| **R8-09** | Impression physique Xprinter 80×104 mm (dimensions, découpe, réimpression) | Bloquant | `NON TESTÉ` |
| **R8-10** | Préservation interface commerciale validée et hygiène console | Bloquant | `NON TESTÉ` |

### 5.2. Critères Go / No-Go et conduite à tenir en cas d'échec

- **Critères GO (tous obligatoires pour prononcer la réception) :**
  1. Inventaire §1.1–§1.2 complété, aucune exposition publique du serveur ni de PostgreSQL/Redis, services tiers préservés.
  2. Sauvegarde cohérente PostgreSQL + médias privés réalisée, copiée hors serveur et validée par contrôle de restauration isolé (§2.2 = `PASS`).
  3. `/healthz/`, `/readyz/` et `manage.py check --deploy` tous verts sur le SHA exact déployé (`11dcd39dcacec051de695d908e3d036e4cf70d0f`).
  4. Tous les scénarios **Bloquants** (`R8-01` à `R8-07`, `R8-09`, `R8-10`) sont `PASS` avec preuves archivées ; tout écart mineur non bloquant sur `R8-08` est documenté avec plan d'action.
  5. Aucune mutation non autorisée sur les comptes réels ; comptes de test `recette_*` nettoyés ou désactivés après validation.
- **Critères NO-GO (arrêt immédiat de la mise en service) :**
  - Échec de sauvegarde ou de contrôle de restauration isolé ;
  - Échec `/healthz/`, `/readyz/` ou `check --deploy` ;
  - Toute faille d'autorisation (accès `CIN`/contrat non autorisé, paiement accepté avant signature, action D01 exécutée par Comptable, session suspendue non rejetée) ;
  - Perte de données, écrasement de créateur initial ou troncature de montants sur ticket Xprinter 80×104 mm ;
  - Dégradation ou suppression d'un écran commercial validé.
- **Action en cas de NO-GO :** stopper la recette, consigner les preuves (horodatage, capture sans secret, statut HTTP, logs backend), exécuter le protocole de gel / rollback (§2.3) si une bascule a déjà eu lieu, et ouvrir un lot correctif dédié avant nouvelle tentative.

### 5.3. Écart connu et besoin de contrat backend séparé (hors périmètre Lot 8)

- **Boutons d'exports tabulaires dans `#reports` :** à la baseline `11dcd39dcacec051de695d908e3d036e4cf70d0f`, `GET /api/v1/auth/session/` (`backend/apps/identity/auth_serializers.py`) expose uniquement `reportCategories` (consultation) et **n'expose pas** les catégories exportables (`export_categories_for_user_roles`). Conformément à la gouvernance, le frontend ne déduit pas les droits d'export des rôles ni de `reportCategories` : les 4 cartes d'export restent visibles dans `#reports` et le backend refuse en `403` les profils sans droit d'export (ex. `storekeeper`) avec affichage du message français côté interface.
- **Traitement :** cet écart est **connu, non bloquant pour la sécurité** (contrôle serveur actif) et conservé comme **besoin de contrat backend séparé** (aucune extension backend n'est réalisée ni requise dans le cadre de ce runbook Lot 8).

### 5.4. Procès-verbal par porte (4 validations distinctes)

| Porte | Condition de validation | Responsable | Date | Décision / Visa |
|---|---|---|---|---|
| **1. Préparation** | Inventaire §1 complété, sauvegarde DB + médias copiée hors serveur, restauration isolée §2.2 `PASS` | Opérateur / Infra | `____/____/____` | `[ ] VALIDÉE  [ ] BLOQUÉE` |
| **2. Autorisation de déploiement** | Feu vert écrit de bascule vers `11dcd39dcacec051de695d908e3d036e4cf70d0f` (hors comptes réels) | Autorité humaine | `____/____/____` | `[ ] AUTORISÉE  [ ] REFUSÉE` |
| **3. Exécution** | Mise à jour appliquée, `/healthz/` & `/readyz/` verts, scénarios `R8-01` à `R8-10` déroulés sur comptes de test et preuves archivées | Opérateur / QA | `____/____/____` | `[ ] TERMINÉE  [ ] ROLLBACK` |
| **4. Réception Lot 8** | Décision Go/No-Go finale sur preuves physiques (LAN + Raspberry Pi + Xprinter 80×104 mm) ; réaffectation comptes réels décidée séparément (§4.3) | Product Owner / Client | `____/____/____` | `[ ] GO (REÇU)  [ ] NO-GO` |
