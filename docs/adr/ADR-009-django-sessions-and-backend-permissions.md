# ADR-009 - Django Sessions And Backend Permissions

## Contexte

L'ERP manipulera des actions sensibles, des documents prives et des operations financieres.

## Decision

Utiliser les sessions Django et des permissions backend comme socle de controle d'acces.

## Alternatives considerees

- Permissions uniquement cote frontend.
- Absence de controle centralise.

## Consequences

- Les droits devront etre verifies cote backend.
- Les actions sensibles devront etre auditees.
- Les interfaces ne devront pas etre considerees comme barriere de securite suffisante.

## Statut

ACCEPTED

