# ADR-007 - Private Sensitive Documents

## Contexte

Le projet doit conserver des documents sensibles tels que CIN, NIF, STAT, RCS et justificatifs.

## Decision

Les documents sensibles seront conserves de maniere privee avec acces controle par le backend.

## Alternatives considerees

- Stockage public avec URLs difficiles a deviner.
- Gestion manuelle hors ERP.

## Consequences

- Les permissions backend sont obligatoires.
- Les acces devront etre audites.
- Les strategies de conservation devront etre validees avec le client.

## Statut

ACCEPTED

