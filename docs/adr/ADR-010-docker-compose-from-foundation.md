# ADR-010 - Docker Compose From Foundation

## Contexte

La stack cible inclut plusieurs services : backend ASGI, frontend, PostgreSQL, Redis, Celery, Celery Beat, Flower et Nginx.

## Decision

Prevoir Docker Compose des la Foundation.

## Alternatives considerees

- Installation manuelle locale uniquement.
- Orchestration reportee apres plusieurs lots applicatifs.

## Consequences

- La future Foundation devra fournir une orchestration coherente.
- Flower devra rester non expose publiquement.
- Aucun fichier Docker Compose operationnel n'est cree pendant la mission documentaire initiale.

## Statut

ACCEPTED

