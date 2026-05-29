# ADR-002 - Modular Django Monolith

## Contexte

Le systeme cible couvre reservations, facturation, paiements, stock, logistique, caisse, documents sensibles et audit.

## Decision

Construire le backend comme un monolithe Django modulaire.

## Alternatives considerees

- Microservices des la Foundation.
- Application monolithique non modulaire.

## Consequences

- Les transactions metier critiques restent centralisees.
- Les modules devront avoir des frontieres explicites.
- Les extractions futures resteront possibles si un besoin reel apparait.

## Statut

ACCEPTED

