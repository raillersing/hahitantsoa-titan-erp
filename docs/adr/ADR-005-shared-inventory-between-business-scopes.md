# ADR-005 - Shared Inventory Between Business Scopes

## Contexte

Hahitantsoa et Titan utilisent des materiels communs.

## Decision

Les materiels sont partages entre Hahitantsoa et Titan. Une reservation confirmee dans un volet rend le materiel indisponible dans l'autre.

## Alternatives considerees

- Stocks separes par volet.
- Duplication des materiels entre Hahitantsoa et Titan.

## Consequences

- Les disponibilites devront etre calculees globalement.
- La confirmation devra empecher les doubles allocations cross-scope.
- Les tests devront couvrir les conflits entre Hahitantsoa et Titan.

## Statut

ACCEPTED

