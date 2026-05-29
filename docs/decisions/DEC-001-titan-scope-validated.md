# DEC-001 - Périmètre Titan validé

## Décision validée

Titan correspond exclusivement à une activité de location pure de matériels physiques, d’articles physiques, de mobilier traité comme matériel louable et de packs composés exclusivement d’éléments autorisés.

Titan autorise uniquement :

- les matériels physiques ;
- les articles physiques ;
- le mobilier traité comme matériel louable ;
- les packs composés exclusivement de matériels physiques, d’articles physiques ou de mobilier traité comme matériel louable.

Titan exclut définitivement :

- les locaux ;
- les salles ;
- les lieux ;
- les services annexes ;
- les services événementiels.

Un pack Titan ne peut contenir, directement ou indirectement, aucun local, salle, lieu, service annexe ou service événementiel.

Cette décision est définitive, non configurable et prioritaire sur toute ambiguïté ou formulation antérieure.

## Impacts obligatoires

- Aucune configuration, aucun champ, aucun paramètre, aucun feature flag, aucune variable d’environnement et aucune logique conditionnelle ne devra permettre d’ajouter un local, une salle, un lieu, un service annexe ou un service événementiel dans Titan.
- L’API future devra refuser toute tentative de créer ou d’ajouter une ligne Titan correspondant à un local, une salle, un lieu, un service annexe ou un service événementiel.
- L’API future devra également refuser tout pack Titan contenant directement ou indirectement une catégorie interdite.
- Le frontend ne devra jamais présenter une catégorie interdite comme offre sélectionnable dans un parcours, devis, réservation ou contrat Titan.
- Cette interdiction ne remet pas en cause l’utilisation autorisée des locaux, salles, lieux, services annexes et services événementiels dans le périmètre Hahitantsoa.
- Les tests d’interdiction sont obligatoires.

## Documents concernés

Cette décision doit être reflétée dans :

- `AGENTS.md` ;
- `PLANS.md` ;
- les règles métier versionnées dans `docs/business-rules/` ;
- les ADR applicables ;
- les futurs modèles, services backend, endpoints API, interfaces frontend et tests automatisés.

## Statut

VALIDATED
