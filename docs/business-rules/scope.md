# Perimetres Hahitantsoa et Titan

## Hahitantsoa

Hahitantsoa correspond a l'evenement complet. Le perimetre peut inclure local, materiels/articles, mobilier et services annexes eventuels.

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

