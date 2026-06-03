# PLANS.md — Hahitantsoa / Titan ERP

## 1. Objet du document

Ce document organise les phases de mise en œuvre du projet ERP Hahitantsoa / Titan.

La Foundation documentaire est terminee. La tache actuellement autorisee est **F31 - Smoke test seed demo inventory + availability helpers**.
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

F5 terminee : backend Django minimal initialise, sans module metier, sans endpoint API metier et sans exposition publique du schema OpenAPI.

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

F6 terminee : qualite backend minimale avec Ruff, pytest, pytest-django et test de demarrage Django Foundation.

F7 terminee : durcissement minimal des settings Django, sans module metier, sans endpoint API metier et sans objectif production-ready.

### Objectifs futurs

* configurer Black, Ruff, mypy, pytest, pytest-django et factory_boy pour le backend ;
* configurer ESLint, Prettier, TypeScript strict, Vitest et React Testing Library pour le frontend ;
* préparer Playwright pour les parcours critiques ;
* créer les contrôles CI seulement après validation explicite ;
* vérifier les règles critiques de réservation, disponibilité, Titan, paiement, audit et fichiers privés.

---

## 7. Phase 5 — Health checks et lancement local

### Statut

F8 terminee : endpoint backend de sante minimal `GET /healthz/`, sans acces PostgreSQL/Redis et sans readiness check complet.

F9 terminee : service backend Docker Compose local avec Django `runserver`, sans production hardening, sans migration et sans logique metier.

F10 terminee : healthcheck Docker Compose du service backend base sur `/healthz/`, sans changement applicatif et sans logique metier.

F11 terminee : application controlee des migrations Django standards locales pour `admin`, `auth`, `contenttypes` et `sessions`, sans migration metier.

F12 terminee : endpoint readiness PostgreSQL minimal `GET /readyz/`, sans test Redis et sans logique metier.

F13 terminee : structure de packages backend pour les futurs domaines applicatifs, sans activation Django, sans modele, sans migration et sans endpoint metier.

F14 terminee : activation minimale de l'app Django technique `common`, sans modele, sans migration, sans endpoint et sans logique metier.

F15 terminee : socle commun abstrait dans `apps.common`, sans modele concret, sans table, sans migration et sans endpoint metier.

F16 terminee : activation minimale de l'app Django `inventory`, sans modele, sans migration, sans endpoint et sans logique metier.

F17 terminee : garde-fou pur Python du perimetre Titan dans `inventory`, sans modele, sans table, sans migration et sans endpoint metier.

F18 terminee : premier modele concret minimal `InventoryItem` et migration initiale inventory controlee, sans endpoint API, serializer, viewset, admin, stock, reservation, facturation ou logistique.

F19 terminee : validation de persistance PostgreSQL pour `InventoryItem`, sans nouvelle migration, sans endpoint API, sans serializer, sans viewset et sans admin.

F20 terminee : serializer DRF minimal pour `InventoryItem`, sans endpoint API expose, sans URL, sans view, sans viewset, sans admin et sans migration.

F21 terminee : API read-only minimale pour `InventoryItem`, exposee en liste et detail uniquement, sans ecriture, sans viewset, sans router, sans admin, sans stock, reservation, facturation ou frontend.

F22 terminee : documentation OpenAPI minimale avec drf-spectacular, schema JSON, Swagger UI et ReDoc pour usage local/dev, sans migration, sans endpoint d'ecriture, sans viewset, sans router et sans admin.

F23 terminee : securisation minimale de l'API inventory read-only par `IsAuthenticated`, sans role metier avance, sans permission custom, sans migration, sans endpoint d'ecriture, sans viewset, sans router et sans admin.

F24 terminee : routes DRF session login/logout pour la Browsable API et les tests dev/local, sans JWT, sans token auth, sans role metier, sans migration et sans endpoint d'ecriture inventory.

F25 terminee : commande Django `seed_dev_user` pour creer ou mettre a jour un utilisateur standard local/dev depuis variables d'environnement, sans mot de passe commite ou affiche, sans migration, sans modele, sans endpoint, sans JWT/token et sans role metier.

F26 terminee : commande Django `seed_demo_inventory` pour creer ou mettre a jour des donnees `InventoryItem` de demonstration conformes Titan, sans migration, sans modification de modele, sans serializer, sans endpoint d'ecriture, sans JWT/token et sans role metier.

F27 terminee : smoke test authentifie du parcours inventory avec `seed_dev_user`, `seed_demo_inventory`, login session Django/DRF et lecture `GET /api/v1/inventory/items/`, sans migration, sans modele, sans serializer, sans endpoint d'ecriture, sans JWT/token et sans role metier.

F28 terminee : smoke test du detail inventory authentifie et read-only avec `seed_dev_user`, `seed_demo_inventory`, lecture liste, lecture detail et refus de POST, PUT, PATCH et DELETE, sans migration, sans modele, sans serializer, sans view, sans endpoint d'ecriture, sans JWT/token et sans role metier.

F29 terminee : socle de domaine `InventoryAvailability` pour preparer les futures periodes d'indisponibilite ou de reservation d'un `InventoryItem`, sans module complet de reservation, sans contrat, sans facture, sans paiement, sans client, sans serializer, sans view, sans endpoint d'ecriture et sans changement de l'API read-only.

F30 terminee : helpers internes de disponibilite inventory pour detecter les conflits sur une periode `[start_at, end_at)`, sans migration, sans modele, sans serializer, sans view, sans URL, sans endpoint d'ecriture, sans module complet de reservation, sans contrat, sans facture, sans paiement, sans client et sans frontend.

F31 en cours : smoke test interne validant que `seed_demo_inventory` fonctionne avec `InventoryAvailability` et les helpers de disponibilite F30, sans API, sans migration, sans modele, sans serializer, sans view, sans URL, sans endpoint d'ecriture, sans module complet de reservation, sans contrat, sans facture, sans paiement, sans client et sans frontend.

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
