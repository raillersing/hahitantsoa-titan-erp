# ADR-006 - Titan exclut les locaux et les services

## Statut

ACCEPTED

## Décision métier source

Cette ADR applique explicitement la décision validée dans `docs/decisions/DEC-001-titan-scope-validated.md`.

## Contexte

L’application ERP comporte deux périmètres métier distincts :

- **Hahitantsoa**, qui couvre la gestion événementielle complète et peut inclure locaux, salles, lieux, matériels physiques, articles physiques, mobilier, packs matériels, services annexes et services événementiels ;
- **Titan**, qui correspond exclusivement à une activité de location pure de matériels physiques, d’articles physiques, de mobilier traité comme matériel louable et de packs composés exclusivement d’éléments autorisés.

Une ambiguïté historique pouvait laisser penser que Titan pouvait être configuré pour autoriser des locaux, salles, lieux ou services. Cette possibilité est définitivement rejetée.

## Décision

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

Aucun feature flag, paramètre, champ, variable d’environnement, permission conditionnelle ou configuration alternative ne devra permettre d’autoriser une catégorie interdite dans Titan.

Les locaux, salles, lieux, services annexes et services événementiels peuvent exister dans Hahitantsoa lorsque le besoin métier le justifie.

## Conséquences d’implémentation

Les futures implémentations devront respecter les obligations suivantes :

- toute tentative API de créer ou d’ajouter une ligne Titan de type local, salle, lieu, service annexe ou service événementiel devra être refusée ;
- toute tentative API de créer ou d’utiliser un pack Titan contenant directement ou indirectement une catégorie interdite devra être refusée ;
- le frontend ne devra jamais présenter une catégorie interdite comme offre sélectionnable dans un parcours, devis, réservation ou contrat Titan ;
- les locaux, salles, lieux, services annexes et services événementiels peuvent rester disponibles dans le périmètre Hahitantsoa lorsque le besoin métier le justifie ;
- les modèles, validations métier, services backend, endpoints API, formulaires frontend et tests automatisés devront encoder explicitement cette interdiction ;
- aucune logique de permission ou de configuration ne devra permettre de contourner la décision.

## Tests obligatoires associés

Lorsque les modules concernés seront implémentés, les tests devront démontrer au minimum que :

- Titan accepte un matériel physique autorisé ;
- Titan accepte un article physique autorisé ;
- Titan accepte du mobilier traité comme matériel louable ;
- Titan accepte un pack composé exclusivement d’éléments autorisés ;
- Titan refuse un local ;
- Titan refuse une salle ;
- Titan refuse un lieu ;
- Titan refuse un service annexe ;
- Titan refuse un service événementiel ;
- Titan refuse un pack contenant directement ou indirectement un local, une salle, un lieu, un service annexe ou un service événementiel ;
- aucune configuration ou permission ne permet de réactiver une catégorie interdite dans Titan.

## Alternatives considérées

### Alternative 1 - Autoriser les locaux, salles ou lieux dans Titan par configuration

Rejetée : cette option contredirait la séparation métier validée entre Hahitantsoa et Titan.

### Alternative 2 - Autoriser les services annexes ou services événementiels dans Titan par configuration

Rejetée : Titan correspond à une activité de location pure de matériels physiques, d’articles physiques, de mobilier traité comme matériel louable et de packs autorisés, non à une prestation événementielle complète.

### Alternative 3 - Partager les mêmes offres sélectionnables entre Hahitantsoa et Titan avec filtrage optionnel

Rejetée : un filtrage optionnel pourrait permettre une régression ou un contournement de la règle métier. Les catégories interdites ne doivent jamais être sélectionnables dans Titan.

## Conséquences

- La décision est prioritaire sur toute ambiguïté historique.
- Titan demeure un périmètre strictement limité à la location de matériels physiques, articles physiques, mobilier traité comme matériel louable et packs composés exclusivement d’éléments autorisés.
- Hahitantsoa conserve la possibilité de gérer les locaux, salles, lieux, services annexes et services événementiels lorsque le besoin métier le justifie.
- Les implémentations futures devront conserver une validation backend obligatoire, indépendamment des contrôles visuels du frontend.
