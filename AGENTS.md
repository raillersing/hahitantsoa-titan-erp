# Instructions agents - Hahitantsoa / Titan ERP

Ce fichier définit les règles de travail obligatoires pour tout agent intervenant sur le repository ERP Hahitantsoa / Titan.

Le repository est actuellement en phase **Foundation documentaire**. Cette phase sert à fixer les décisions, les règles métier et la structure documentaire. Elle ne doit pas introduire de code applicatif ni de configuration opérationnelle.

## 1. Sources de vérité et ordre de priorité

En cas de contradiction, appliquer l’ordre de priorité suivant :

1. Les décisions validées dans `docs/decisions/`.
2. Les ADR acceptées dans `docs/adr/`.
3. Le CDC fonctionnel et technique consolidé v3.2, lorsqu’il est fourni ou référencé dans `docs/references/source/`.
4. Les invariants métier listés dans ce fichier et dans `docs/business-rules/`.
5. La documentation d’architecture dans `docs/architecture/`.
6. `PLANS.md`.
7. Les runbooks dans `docs/runbooks/`.
8. Les notes de référence dans `docs/references/source/`.
9. Les demandes ponctuelles, uniquement si elles ne contredisent aucune source de priorité supérieure.

La décision Titan validée est prioritaire sur toute ambiguïté historique, tout ancien guide et toute interprétation contraire.

## 2. Périmètres métier
## Agent workflow harmonise

Le workflow multi-agent du projet est strict et homogène.

- une tâche = une branche = une PR ;
- chaque tranche est limitée à un périmètre contrôlé ;
- chaque changement modifie uniquement les fichiers autorisés ;
- valider localement avant push lorsqu'une validation locale est applicable ;
- vérifier la CI GitHub avant tout merge ;
- le merge reste toujours manuel ;
- après merge, vérifier l'état de `main` et les checks sur `main` ;
- utiliser systématiquement `scripts/dev/erp-logged-run` pour chaque commande terminale importante ;
- ne pas mélanger code applicatif et documentation sans décision explicite ;
- respecter en permanence les règles Hahitantsoa/Titan.

### Rôles des agents

- un agent peut implémenter, tester et corriger un échec de test dans le même périmètre ;
- un agent peut créer une branche, committer, pousser et ouvrir une PR quand cela est autorisé ;
- un agent doit s'arrêter et demander une intervention humaine si :
  - un changement d'architecture est nécessaire ;
  - le périmètre est incertain ou discutable ;
  - une migration risquée est requise ;
  - le travail implique une décision métier critique ou un conflit de scope ;
  - il faut modifier des fichiers hors périmètre approuvé.

### Rôle humain

- approuver le plan et le périmètre ;
- valider la PR, les résultats de validation et la conformité aux règles ;
- décider du merge ;
- conserver l'autorité finale ;
- préparer et protéger `.env` et tout secret local ;
- arbitrer les désaccords de scope ou d'architecture.

### Définition de done

- périmètre approuvé respecté ;
- diff limité et compréhensible ;
- validations locales et CI exécutées ou justifiées ;
- PR ouverte vers `main` ;
- pas de modification de fichiers interdits ;
- pas d'accès à `.env` ou à des secrets ;
- rapport de validation produit.

### Règles de PR

- une PR par tranche contrôlée ;
- titre et description explicites ;
- joindre les validations essentielles ;
- ne pas merger tant que la PR n'est pas revue et que la CI est verte.

### Command execution rule

Agents must run every important terminal command through `scripts/dev/erp-logged-run`.

This includes:
- Git status, diff, commit, push, PR and CI commands;
- test, lint, format, build and quality commands;
- repository inspection commands used as task evidence;
- recovery, fixer and validation commands.

Direct terminal commands are only allowed for trivial editor-only inspection that cannot affect the repository. If an agent accidentally runs a direct command, it must immediately run a journaled recovery/validation command through `scripts/dev/erp-logged-run` before continuing.

### Règles de validation

- `git branch --show-current`
- `git status --short`
- `git diff --name-status`
- vérifier les fichiers interdits
- utiliser `scripts/dev/erp-logged-run` pour les validations importantes
- exécuter les tests et checks pertinents
- pour le backend Django, utiliser `.venv/bin/python backend/manage.py check` et `.venv/bin/python -m pytest` quand approprié.

### Spécificités Hahitantsoa/Titan

- Titan autorise uniquement `material`, `article`, `material_pack` ;
- Titan interdit `venue`, `local`, `room`, `service`, `event_service`, `salle`, `lieu`, `service événementiel`, `service annexe` ;
- Titan n'expose jamais local, salle, lieu ou service ;
- l'API inventory reste read-only tant qu'une tâche ne valide pas explicitement le contraire.

### Interdictions strictes

- ne jamais lire, afficher, sourcer, inspecter ou modifier `.env` ;
- ne pas modifier backend/frontend hors périmètre explicite ;
- ne pas créer de Docker opérationnel pendant la phase documentaire ;
- ne pas créer `compose.yaml`, `compose.yml`, `compose.prod.yaml`, `Dockerfile`, `pyproject.toml`, `package.json`, `requirements.txt`, `manage.py`, migrations, endpoints API, admin ou frontend hors tâche explicitement autorisée.


### Hahitantsoa

Hahitantsoa correspond à l’événement complet.

Son périmètre peut inclure :

- local, salle ou lieu ;
- matériels et articles ;
- mobilier ;
- services événementiels annexes éventuels ;
- documents commerciaux, logistiques et financiers liés à l’événement.

### Titan

Titan correspond uniquement à la location pure de matériels/articles et de packs matériels.

Titan ne doit jamais permettre :

- local ;
- salle ;
- lieu ;
- service événementiel ;
- service annexe ;
- option commerciale ou technique qui rendrait ces catégories disponibles.

Aucun flag, paramètre, variable d’environnement, champ, permission, réglage d’administration, feature flag ou configuration ne doit permettre local, salle, lieu ou service dans Titan.

Conséquences obligatoires pour les futures implémentations :

- l’API devra refuser toute ligne Titan de type local, salle, lieu ou service ;
- le frontend Titan ne devra jamais présenter local, salle, lieu ou service ;
- les tests devront vérifier qu’une tentative d’ajouter local, salle, lieu ou service dans Titan échoue ;
- les matériels sont partagés entre Hahitantsoa et Titan : une réservation confirmée dans un volet rend le matériel indisponible dans l’autre.

## 3. Invariants métier

- INV-001 : un proforma est une estimation et ne confirme pas définitivement une réservation.
- INV-002 : une réservation est confirmée uniquement après contrat signé, acompte reçu et revalidation réussie des disponibilités.
- INV-003 : la confirmation et le contrôle des disponibilités devront être transactionnels afin d’éviter les doubles allocations.
- INV-004 : les matériels sont partagés entre Hahitantsoa et Titan.
- INV-005 : Titan autorise uniquement articles, matériels et packs matériels ; jamais local ni service.
- INV-006 : un contrat signé est immuable ; toute modification passe par proforma de modification puis avenant.
- INV-007 : moyens de paiement acceptés : Cash, MVola, Chèque et Virement.
- INV-008 : chaque paiement validé génère un reçu.
- INV-009 : échéances : 50 % du reste à payer à J-30, puis solde final et caution à J-10.
- INV-010 : le bon de sortie est un document interne de préparation.
- INV-011 : le bon de livraison est le document de passation destiné au client.
- INV-012 : les retours distinguent intact, cassé et manquant.
- INV-013 : casse ou perte imputable à la caution ; dépassement restant dû par le client.
- INV-014 : gestion des consommables, seuils bas, fournisseurs et bons de commande.
- INV-015 : caisse individualisée par utilisateur habilité avec ouverture, mouvements, comptage, clôture, justification et exports.
- INV-016 : agenda visiteurs/prospects et conversion en client.
- INV-017 : documents CIN, NIF, STAT, RCS et justificatifs conservés de manière privée avec accès contrôlé.
- INV-018 : audit obligatoire des actions sensibles.

## 4. Architecture cible

L’architecture cible documentée est la suivante :

- monorepo Git ;
- backend : Python 3.13, Django 5.2 LTS, Django REST Framework ;
- frontend : React, TypeScript strict, Vite ;
- base de données : PostgreSQL ;
- async : Celery, Redis et Celery Beat ;
- temps réel : Django Channels et Redis ;
- monitoring : Flower, non exposé publiquement ;
- proxy / HTTPS : Nginx ;
- exécution applicative : serveur ASGI ;
- déploiement retenu : Docker Compose ;
- API : OpenAPI avec drf-spectacular ;
- documentation : README, ADR, dossiers `business-rules`, `architecture`, `references/source` et `runbooks` ;
- tests prévus : pytest, pytest-django, factory_boy, Vitest, React Testing Library et Playwright ;
- qualité prévue : Black, Ruff, mypy, ESLint, Prettier et TypeScript strict.

Django + HTMX ne doit pas être proposé comme remplacement de React.

### Clarification Docker

La Foundation actuelle est documentaire uniquement.

Docker Compose est l’architecture de déploiement retenue, mais sa configuration ne doit être créée que lors d’une tâche d’implémentation explicitement approuvée après la Foundation documentaire.

Pendant la mission documentaire actuelle, ne pas créer de `compose.yaml`, `compose.yml`, `compose.prod.yaml`, `Dockerfile` ou fichier Docker opérationnel.

## 5. Règles backend

Les règles métier ne doivent pas être dispersées dans les vues, serializers ou composants frontend.

### Services

- Placer les écritures métier et transitions d’état dans des services applicatifs explicites.
- Les services doivent porter les règles de confirmation, paiement, logistique, caisse, audit et documents sensibles.
- Les services doivent refuser les états impossibles au plus près du backend.
- Les services liés à Titan doivent interdire local, salle, lieu et service sans option de contournement.

### Selectors

- Placer les lectures métier complexes dans des selectors dédiés.
- Les selectors doivent centraliser les règles de visibilité, disponibilité et filtrage métier.
- Les selectors Titan ne doivent jamais retourner local, salle, lieu ou service comme éléments disponibles.

### Transactions et verrouillage

- Toute confirmation de réservation doit utiliser `transaction.atomic()`.
- Le contrôle de disponibilité et l’allocation doivent être exécutés dans la même transaction.
- Les lignes représentant des stocks, allocations, réservations ou ressources critiques devront être verrouillées lorsque nécessaire, par exemple avec `select_for_update()`.
- Les doubles allocations entre Hahitantsoa et Titan doivent être empêchées au niveau transactionnel.
- Les effets externes ou différés après commit doivent passer par `transaction.on_commit()`.
- Aucun email, notification, tâche Celery ou génération documentaire définitive ne doit être déclenché avant la réussite effective du commit.

### API

- L’API devra refuser les mutations contraires aux invariants métier.
- Les erreurs métier devront être explicites, testables et stables.
- La documentation OpenAPI devra refléter les contraintes métier importantes.

## 6. Règles frontend

- Le frontend cible est React avec TypeScript strict et Vite.
- Le frontend ne doit pas être la seule barrière de sécurité.
- Les écrans Titan ne doivent jamais afficher local, salle, lieu, service événementiel ou service annexe.
- Les formulaires Titan ne doivent pas contenir de champ permettant de sélectionner ou injecter ces catégories.
- Les états d’erreur retournés par l’API doivent être affichés clairement lorsque l’utilisateur tente une action refusée.
- Les interfaces manipulant documents sensibles, caisse, paiements, contrats et audit doivent respecter les permissions reçues du backend.

## 7. Autorisation, sessions et audit

- Les permissions doivent être contrôlées côté backend.
- Les sessions Django sont le socle d’authentification retenu.
- Le frontend peut masquer des actions, mais ne remplace jamais une autorisation backend.
- Les actions sensibles doivent être auditées.
- Les journaux d’audit doivent permettre de comprendre qui a fait quoi, quand, sur quelle ressource et avec quel résultat.
- Les opérations de caisse, paiement, contrat, avenant, document sensible, confirmation de réservation, annulation, retour, casse et perte sont sensibles.

## 8. Sécurité des fichiers privés

Les documents CIN, NIF, STAT, RCS et justificatifs sont privés.

Règles obligatoires :

- ne jamais servir les fichiers sensibles depuis un stockage public non contrôlé ;
- ne jamais exposer d’URL publique permanente vers un document sensible ;
- vérifier les permissions backend avant tout accès, téléchargement ou aperçu ;
- journaliser les accès sensibles lorsque cela est pertinent ;
- séparer les métadonnées métier de l’objet fichier lorsque c’est utile ;
- prévoir une politique de conservation validée par le client ;
- ne jamais commiter de document réel, pièce d’identité, justificatif ou secret dans le repository ;
- utiliser des fixtures anonymisées ou synthétiques pour les tests futurs.

## 9. Tests métier critiques

Les futures implémentations devront couvrir au minimum les scénarios suivants :

- un proforma ne confirme pas une réservation ;
- une réservation ne peut être confirmée sans contrat signé ;
- une réservation ne peut être confirmée sans acompte reçu ;
- une réservation ne peut être confirmée sans revalidation réussie des disponibilités ;
- deux confirmations concurrentes ne peuvent pas allouer le même matériel ;
- une réservation Hahitantsoa confirmée rend le matériel indisponible dans Titan ;
- une réservation Titan confirmée rend le matériel indisponible dans Hahitantsoa ;
- Titan refuse toute ligne local, salle ou lieu ;
- Titan refuse toute ligne service événementiel ou service annexe ;
- le frontend Titan ne présente pas local, salle, lieu ou service ;
- un contrat signé ne peut pas être modifié directement ;
- une modification après signature passe par proforma de modification puis avenant ;
- seuls Cash, MVola, Chèque et Virement sont acceptés comme moyens de paiement ;
- chaque paiement validé génère un reçu ;
- les échéances J-30 et J-10 sont calculées selon les règles validées ;
- les retours distinguent intact, cassé et manquant ;
- casse et perte s’imputent à la caution, avec reste dû si dépassement ;
- les consommables déclenchent les contrôles de seuil bas ;
- les mouvements de caisse nécessitent un utilisateur habilité ;
- ouverture, mouvements, comptage, clôture et justification de caisse sont tracés ;
- les documents sensibles nécessitent des permissions ;
- les actions sensibles produisent un audit.

## 10. Qualité et review

Les changements futurs devront rester cohérents avec la stack cible et les conventions du repository.

Les reviews Codex doivent vérifier :

- respect des sources de vérité ;
- respect des invariants métier ;
- absence de contournement de la règle Titan ;
- transactionnalité des confirmations de réservation ;
- usage correct des services et selectors ;
- usage correct de `transaction.atomic()`, du verrouillage de lignes et de `transaction.on_commit()` ;
- couverture des tests métier critiques ;
- contrôle backend des permissions ;
- protection des fichiers privés ;
- audit des actions sensibles ;
- absence d’exposition publique de Flower ;
- absence de secret commité ;
- absence de dépendance ou configuration opérationnelle non approuvée.

## 11. Procédure obligatoire de travail Codex

### Regles permanentes Codex

- Une tache = une branche = une PR.
- Toujours verifier la branche active et l'etat Git avant modification.
- Toujours proposer un plan court avant modification lorsque la tache touche plusieurs fichiers ou une regle structurante.
- Attendre l'approbation explicite lorsque la tache le demande.
- Ne jamais afficher, modifier ou commiter `.env`.
- Respecter `docs/decisions/DEC-001-titan-scope-validated.md`.
- Respecter `docs/decisions/DEC-002-inventory-availability-domain.md` lorsque la disponibilite, les periodes ou les reservations sont concernees.
- Titan autorise uniquement `material`, `article` et `material_pack`.
- Titan interdit `venue`, `local`, `room`, `service` et `event_service`.
- L'API inventory reste read-only tant qu'une tache ne valide pas explicitement le contraire.
- Ne jamais creer de modele, migration, API, admin ou frontend hors portee explicite.
- Ne jamais faire `git add`, `git commit` ou `git push` sauf demande explicite.

### Workflow Codex en deux temps

Pour les taches sensibles, structurantes ou explicitement encadrees, utiliser un workflow en deux temps.

Mode 1 : `PLAN ONLY`

- Lire les fichiers necessaires.
- Analyser la tache et les sources de verite.
- Proposer un plan court.
- Lister les fichiers a creer ou modifier.
- Lister les validations prevues.
- Ne modifier aucun fichier.
- Ne pas faire `git add`, `git commit` ou `git push`.

Mode 2 : `IMPLEMENT APPROVED PLAN`

- Appliquer uniquement le plan approuve.
- Modifier uniquement les fichiers approuves.
- Executer uniquement les validations approuvees ou strictement pertinentes.
- Produire un rapport final avec fichiers, validations et points a verifier.
- Ne pas faire `git add`, `git commit` ou `git push`.

### Workflow terminal Codex

- Executer chaque commande terminal via `scripts/dev/erp-logged-run` avec stdin/heredoc :

  ```sh
  scripts/dev/erp-logged-run nom-de-tache <<'EOF'
  <commandes>
  EOF
  ```

- Ne pas utiliser `scripts/dev/erp-logged-run nom-de-tache bash -c '...'` : le wrapper lit deja
  les commandes depuis stdin et doit conserver leur vrai code retour.
- Pour les validations locales, utiliser les executables du virtualenv, notamment
  `.venv/bin/python` et `.venv/bin/pytest`.
- Pour un Django check dans un conteneur temporaire, utiliser
  `docker compose run --rm backend python backend/manage.py check`.
- Les tests DB Titan/reservations necessitent des services Docker `db` et `redis` healthy.
- Ne jamais lire, afficher, sourcer, inspecter ou modifier `.env`. Une commande Docker qui
  reference un environnement prepare par l'operateur ne donne jamais aux agents l'autorisation
  d'ouvrir ou d'inspecter `.env`.

Avant toute modification :

1. Inspecter le répertoire courant.
2. Vérifier l’état Git.
3. Identifier les fichiers concernés.
4. Présenter un plan court lorsque la demande implique plusieurs fichiers ou une décision structurante.
5. Attendre l’approbation si l’utilisateur l’a demandée ou si la tâche peut modifier des décisions métier.

Pendant la modification :

- limiter les changements au périmètre demandé ;
- ne pas réécrire des fichiers sans nécessité ;
- ne pas corriger des sujets non demandés ;
- ne pas supprimer des changements utilisateur ;
- privilégier les conventions déjà présentes ;
- documenter les décisions structurantes dans ADR ou `docs/decisions/` lorsque nécessaire.

Après la modification :

- afficher les fichiers modifiés ;
- résumer les changements ;
- exécuter les vérifications pertinentes ;
- signaler ce qui n’a pas pu être testé ;
- faire une auto-review du diff.

## 12. Interdictions pendant la Foundation documentaire

Pendant cette mission documentaire, il est interdit de créer :

- code Django ;
- code React ;
- projet Vite ;
- dépendance logicielle ;
- `package.json` ;
- `pyproject.toml` ;
- `requirements.txt` ;
- `manage.py` ;
- projet Django ;
- migration ;
- endpoint API ;
- fichier Docker ;
- fichier Docker Compose opérationnel ;
- configuration CI exécutable ;
- modèle métier applicatif ;
- tâche Celery ;
- configuration applicative opérationnelle.

La seule production autorisée pendant cette phase est documentaire et structurelle.

## 11. Local AI agent tooling - F84

F84 adds local/free AI agent tooling to the project workflow without replacing the existing Codex workflow.

### Tool roles

- Codex remains the recommended senior AI coding agent for complex implementation, architecture-sensitive changes, hard debugging and critical PR review.
- Aider may be used as a local implementer for small, scoped changes on the current Git branch.
- Gemini CLI may be used as a reviewer/QA assistant for second opinions on the current Git diff.
- Human validation remains mandatory before commits, PR creation and merges.

### Workflow compatibility

The existing Codex workflow remains valid.

Local/free tools must not:

- replace Codex for critical tasks unless explicitly approved;
- merge pull requests;
- push branches unless explicitly instructed;
- broaden the approved task scope;
- modify business rules without explicit approval;
- read, print, source or modify `.env`;
- expose credentials, tokens, cookies, passwords or secret values.

### Recommended usage

Use Aider when:

- the task is small;
- the expected diff is limited;
- the files to modify are known;
- the human operator can easily review the result.

Use Gemini CLI when:

- reviewing the current Git diff;
- checking scope compliance;
- checking tests and documentation;
- looking for business-rule violations.

Use Codex when:

- the task is complex;
- the implementation crosses backend/frontend/domain boundaries;
- the local/free tools produce uncertain results;
- a critical review is needed before merge.

### Required review sequence for agent-assisted changes

For any non-trivial agent-assisted change:

1. Confirm the current branch and Git status.
2. Run the implementing agent only on the approved scope.
3. Review `git diff`.
4. Run relevant tests or documentation checks.
5. Ask a separate reviewer agent when useful.
6. Commit only after human approval.
7. Create a PR.
8. Merge manually only after final human validation.

