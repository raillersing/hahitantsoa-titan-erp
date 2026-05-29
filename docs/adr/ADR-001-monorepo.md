# ADR-001 - Monorepo

## Contexte

Le projet ERP Hahitantsoa / Titan doit regrouper backend, frontend, infrastructure, documentation et tests dans un meme espace versionne.

## Decision

Utiliser un monorepo Git.

## Alternatives considerees

- Repositories separes pour backend et frontend.
- Repository unique applicatif sans documentation structuree.

## Consequences

- Les decisions, regles metier et composants techniques evoluent ensemble.
- Les futurs changements transverses seront plus simples a reviewer.
- Les conventions de dossiers devront rester strictes.

## Statut

ACCEPTED

