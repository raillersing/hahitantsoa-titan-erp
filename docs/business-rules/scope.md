# Perimetres Hahitantsoa et Titan

## Hahitantsoa

Hahitantsoa correspond a l'evenement complet. Le perimetre peut inclure local, materiels/articles, mobilier et services annexes eventuels.

Le premier scope MVP Hahitantsoa est limite a une decouverte et une planification read-only :

- presenter Hahitantsoa comme un scope distinct de Titan ;
- presenter uniquement les categories de ressources et offres confirmees a haut niveau ;
- permettre les concepts local, lieu, salle et service uniquement dans Hahitantsoa lorsqu'ils sont justifies ;
- reutiliser les materiels et articles partages avec Titan ;
- documenter que les allocations confirmees futures devront rendre les materiels indisponibles dans les deux scopes.

La decision de planification MVP est detaillee dans
[`DEC-003-hahitantsoa-mvp-scope.md`](../decisions/DEC-003-hahitantsoa-mvp-scope.md).

Restent a valider avant implementation :

- le cycle de vie exact d'un evenement Hahitantsoa ;
- les statuts et champs exacts ;
- la necessite de gerer lieux ou services dans le premier ecran ;
- le niveau suffisant du premier catalogue read-only ;
- tout workflow de persistence ou d'ecriture.

## Titan

Titan correspond uniquement a la location pure de materiels/articles et de packs materiels.

Titan n'inclut jamais :

- local ;
- salle ;
- lieu ;
- service evenementiel annexe.

Aucune configuration alternative ne peut autoriser local ou service dans Titan.

## Consequences obligatoires

- L'API devra refuser toute ligne Titan de type local ou service.
- Le frontend Titan ne devra jamais presenter local ni service.
- Les tests devront verifier qu'une tentative d'ajouter local ou service dans Titan echoue.
- Les materiels sont partages entre Hahitantsoa et Titan.
- Le premier slice Hahitantsoa reste read-only tant qu'une persistence ou une ecriture n'est pas explicitement approuvee.
