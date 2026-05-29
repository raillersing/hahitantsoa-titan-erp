# ADR-008 - Secure LAN And Internet Access

## Contexte

Le mode d'acces cible doit couvrir les usages locaux et eventuellement distants, sans exposer inutilement les services internes.

## Decision

Documenter une approche securisee pour le LAN et l'acces Internet avant exposition publique. Flower ne doit pas etre expose publiquement.

## Alternatives considerees

- Exposition directe de tous les services.
- Acces LAN uniquement sans decision client.

## Consequences

- Le perimetre d'acces Internet reste une decision client ouverte.
- Le proxy HTTPS cible est Nginx.
- Les services internes devront rester proteges.

## Statut

ACCEPTED

