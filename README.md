# Hahitantsoa / Titan ERP

Ce repository contient le futur ERP evenementiel pour les activites Hahitantsoa et Titan.

Statut actuel : **Foundation documentaire terminee**.

Aucun composant applicatif n'est encore cree. Il n'existe pas encore de backend Django, de frontend React, de CI executable, de dependance logicielle, de migration ou d'endpoint API.

La premiere infrastructure locale PostgreSQL/Redis est en cours d'implementation sur une branche dediee. Elle ne demarre aucun service applicatif et ne publie pas les ports PostgreSQL ou Redis sur l'hote.

Le runbook local est disponible dans [docs/runbooks/local-development.md](docs/runbooks/local-development.md).

## Documents a lire en priorite

1. [AGENTS.md](AGENTS.md)
2. [PLANS.md](PLANS.md)
3. [docs/decisions/DEC-001-titan-scope-validated.md](docs/decisions/DEC-001-titan-scope-validated.md)
4. [docs/adr/ADR-006-titan-excludes-venues-and-services.md](docs/adr/ADR-006-titan-excludes-venues-and-services.md)
5. [docs/business-rules/scope.md](docs/business-rules/scope.md)
6. [docs/architecture/foundation-plan.md](docs/architecture/foundation-plan.md)
7. [docs/runbooks/local-development.md](docs/runbooks/local-development.md)

## Perimetre fonctionnel cible

Hahitantsoa couvre l'evenement complet et peut inclure local, materiels/articles, mobilier et services annexes eventuels.

Titan couvre uniquement la location pure de materiels/articles et de packs materiels. Titan exclut definitivement les locaux et les services annexes.

Les materiels sont partages entre Hahitantsoa et Titan : une reservation confirmee dans un volet rend le materiel indisponible dans l'autre.
