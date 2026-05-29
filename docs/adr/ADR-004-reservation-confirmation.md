# ADR-004 - Reservation Confirmation

## Contexte

Un proforma ne confirme pas definitivement une reservation. La confirmation doit eviter les doubles allocations de materiels partages.

## Decision

Une reservation sera confirmee uniquement apres contrat signe, acompte recu et revalidation reussie des disponibilites. La confirmation et le controle des disponibilites devront etre transactionnels.

## Alternatives considerees

- Confirmation au moment du proforma.
- Confirmation sans revalidation de disponibilite.
- Controle non transactionnel.

## Consequences

- INV-001, INV-002 et INV-003 sont structurants.
- Les tests futurs devront couvrir les conflits de disponibilite.
- La conception devra privilegier les transactions autour de la confirmation.

## Statut

ACCEPTED

