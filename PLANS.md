# PLANS.md — Hahitantsoa / Titan ERP

## 1. Objet du document

Ce document organise les phases de mise en œuvre du projet ERP Hahitantsoa / Titan.

La Foundation documentaire est terminee. La tache actuellement autorisee est **F5 - Initialisation backend Django minimal**.
Les phases techniques suivantes restent planifiees, mais ne doivent etre executees qu'apres validation explicite.

En cas de contradiction, appliquer la hiérarchie des sources définie dans `AGENTS.md`, les décisions validées, les ADR acceptées, les règles métier versionnées et le CDC fonctionnel et technique consolidé v3.2.

---

## 2. Phase 0 — Foundation documentaire

### 2.1 Objectif

Établir les règles, décisions, documents de référence et la structure minimale du repository avant toute production de code applicatif ou de configuration exécutable.

### 2.2 Éléments autorisés pendant cette phase

* création et stabilisation des dossiers du repository ;
* `README.md` ;
* `AGENTS.md` ;
* `PLANS.md` ;
* documents dans `docs/decisions/` ;
* ADR dans `docs/adr/` ;
* règles métier dans `docs/business-rules/` ;
* documents d’architecture dans `docs/architecture/` ;
* runbooks documentaires dans `docs/runbooks/` ;
* références sources dans `docs/references/source/` ;
* `.editorconfig` ;
* `.gitignore` ;
* fichiers `.gitkeep` nécessaires aux dossiers vides.

### 2.3 Éléments interdits pendant cette phase

* code Django ;
* code React ;
* installation de dépendances ;
* fichiers Dockerfile ;
* configuration Docker Compose exécutable ;
* modèles de données ;
* migrations ;
* endpoints API ;
* configuration CI exécutable ;
* configuration applicative opérationnelle.

### 2.4 Travaux documentaires attendus

1. Stabiliser la structure du monorepo :

   * `backend/` ;
   * `frontend/` ;
   * `infra/` ;
   * `scripts/` ;
   * `docs/` ;
   * `tests/`.

2. Maintenir les documents de gouvernance :

   * `README.md` ;
   * `AGENTS.md` ;
   * `PLANS.md`.

3. Formaliser les décisions et règles critiques :

   * décision définitive concernant le périmètre Titan ;
   * règles métier de réservation, disponibilité, paiement, stock, livraison, retour, caution, caisse, audit et fichiers privés ;
   * architecture cible ;
   * décisions techniques restant ouvertes.

4. Préparer les futurs runbooks documentaires :

   * installation locale future ;
   * variables d’environnement attendues sans valeur secrète ;
   * sauvegarde et restauration futures ;
   * exploitation future des services.

### 2.5 Gate de sortie de la Foundation documentaire

La Phase 0 est validable uniquement si :

* la règle Titan définitive est documentée sans ambiguïté ;
* la hiérarchie des sources de vérité est documentée ;
* les invariants métier critiques sont documentés ;
* les exigences de sécurité et d’audit sont documentées ;
* l’architecture cible est documentée ;
* les décisions ouvertes sont listées ;
* aucun code Django ou React n’a été généré ;
* aucune dépendance n’a été installée ;
* aucun service Docker ou workflow CI exécutable n’a été créé ;
* aucun secret n’a été ajouté au repository ;
* Codex liste précisément les fichiers créés ou modifiés et affiche le résultat réel de `git status --short`.

---

## 3. Phase 1 — Bootstrap technique

### Statut

Terminee.

Le checkpoint documentaire GitHub de la Foundation est termine. F4 a ajoute l'infrastructure Docker Compose locale PostgreSQL/Redis et les conteneurs ont ete valides comme fonctionnels.

### Objectifs futurs

* consigner les versions techniques retenues ;
* définir les prérequis locaux ;
* créer la configuration initiale de développement ;
* créer l’orchestration Docker Compose locale approuvée ;
* préparer les variables d’environnement sans commiter de secrets.

### Architecture Docker Compose future envisagée

* PostgreSQL ;
* Redis ;
* backend ASGI ;
* frontend de développement local ;
* Celery Worker ;
* Celery Beat ;
* Flower non exposé publiquement ;
* Nginx.

---

## 4. Phase 2 — Socle backend Django

### Statut

En cours avec F5 : initialisation d'un backend Django minimal, sans module metier, sans endpoint API metier et sans exposition publique du schema OpenAPI.

### Objectifs futurs

* créer le socle Python 3.14 / Django 5.2 LTS ;
* intégrer Django REST Framework ;
* intégrer drf-spectacular et le schéma OpenAPI ;
* préparer l’authentification, les sessions, les permissions backend et l’audit ;
* structurer le backend selon les règles services / selectors ;
* préparer les transactions et verrouillages nécessaires aux opérations critiques.

---

## 5. Phase 3 — Socle frontend React

### Statut

Planifiée uniquement après validation du socle backend initial.

### Objectifs futurs

* créer le frontend React, TypeScript strict et Vite ;
* organiser le code par fonctionnalité ;
* préparer le client API cohérent avec OpenAPI ;
* intégrer les règles d’autorisation d’interface sans remplacer les contrôles backend ;
* garantir que l’interface Titan ne présente jamais une catégorie interdite comme offre sélectionnable dans un parcours, devis, réservation ou contrat Titan.

---

## 6. Phase 4 — Qualité, tests et CI

### Statut

Planifiée uniquement après création des composants concernés.

### Objectifs futurs

* configurer Black, Ruff, mypy, pytest, pytest-django et factory_boy pour le backend ;
* configurer ESLint, Prettier, TypeScript strict, Vitest et React Testing Library pour le frontend ;
* préparer Playwright pour les parcours critiques ;
* créer les contrôles CI seulement après validation explicite ;
* vérifier les règles critiques de réservation, disponibilité, Titan, paiement, audit et fichiers privés.

---

## 7. Phase 5 — Health checks et lancement local

### Statut

Planifiée uniquement après création effective des services techniques.

### Objectifs futurs

* définir et implémenter les contrôles de santé ;
* vérifier PostgreSQL, Redis, backend, tâches asynchrones, frontend et proxy ;
* vérifier le lancement local documenté ;
* produire les runbooks d’exploitation correspondants.

---

## 8. Décisions client ouvertes

| Décision                                                     | Impact principal                            | Statut    |
| ------------------------------------------------------------ | ------------------------------------------- | --------- |
| Salle Hahitantsoa proposée par défaut                        | Catalogue et réservation Hahitantsoa        | À valider |
| Montant ou pourcentage exact d’acompte                       | Confirmation, contrat et paiement           | À valider |
| Mode d’accès réseau : LAN, exposition publique, VPN ou autre | Déploiement et sécurité réseau              | À valider |
| Hébergement cible                                            | Infrastructure, sauvegardes et exploitation | À valider |
| Politique de conservation des pièces et justificatifs        | Sécurité documentaire et archivage          | À valider |
| Solution SMTP                                                | Notifications et rappels                    | À valider |
| Modèles PDF officiels                                        | Contrats, reçus et documents logistiques    | À valider |

---

## 9. Décisions techniques à documenter avant implémentation

| Sujet                                 | Décision attendue                                   |
| ------------------------------------- | --------------------------------------------------- |
| Version Node.js                       | Version cible pour le frontend React/Vite           |
| Gestionnaire de paquets frontend      | Choix entre npm, pnpm ou yarn                       |
| Serveur ASGI                          | Serveur d’exécution backend retenu                  |
| Images de services                    | Versions PostgreSQL, Redis et Nginx                 |
| Gestion des variables d’environnement | Convention locale et production sans secret commité |
| Stratégie de sauvegarde               | Base de données et fichiers privés                  |
| Stratégie de déploiement              | Environnements et exposition réseau                 |

---

## 10. Décision non ouverte à arbitrage : règle Titan

La règle Titan est déjà validée et n’est pas configurable.

Titan autorise uniquement :

* les matériels physiques ;
* les articles physiques ;
* le mobilier traité comme matériel louable ;
* les packs composés exclusivement de matériels physiques, d’articles physiques ou de mobilier traité comme matériel louable.

Titan interdit définitivement :

* les locaux ;
* les salles ;
* les lieux ;
* les services annexes ;
* les services événementiels ;
* tout champ, paramètre, feature flag, variable d’environnement ou comportement conditionnel permettant d’autoriser ces catégories dans Titan.

Un pack Titan ne peut contenir, directement ou indirectement, aucun local, salle, lieu, service annexe ou service événementiel.

Les locaux, salles, lieux, services annexes et services événementiels peuvent exister dans Hahitantsoa lorsque le besoin métier le justifie.

Conséquences obligatoires pour les futures implémentations :

* le backend devra refuser toute ligne Titan de type local, salle, lieu, service annexe ou service événementiel ;
* le backend devra refuser tout pack Titan contenant directement ou indirectement une catégorie interdite ;
* le frontend ne devra jamais présenter une catégorie interdite comme offre sélectionnable dans un parcours, devis, réservation ou contrat Titan ;
* les tests devront démontrer les refus Titan ;
* les matériels partagés devront être indisponibles dans l’autre périmètre lorsqu’ils sont confirmés dans Hahitantsoa ou Titan.
