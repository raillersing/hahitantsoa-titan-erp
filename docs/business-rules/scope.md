# Perimetres Hahitantsoa et Titan

Source prioritaire : `docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf`
et `docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf`.
Voir aussi `docs/audits/F92_HAHITANTSOA_LIFECYCLE_SOURCE_TRACE.md`.

## Hahitantsoa

Hahitantsoa correspond a l'evenement complet. Le perimetre peut inclure local, materiels/articles, mobilier et services annexes eventuels.

Le premier scope MVP Hahitantsoa etait limite a une decouverte et une planification read-only :

- presenter Hahitantsoa comme un scope distinct de Titan ;
- presenter uniquement les categories de ressources et offres confirmees a haut niveau ;
- permettre les concepts local, lieu, salle et service uniquement dans Hahitantsoa lorsqu'ils sont justifies ;
- reutiliser les materiels et articles partages avec Titan ;
- documenter que les allocations confirmees futures devront rendre les materiels indisponibles dans les deux scopes.

La decision de planification MVP est detaillee dans
[`DEC-003-hahitantsoa-mvp-scope.md`](../decisions/DEC-003-hahitantsoa-mvp-scope.md).

Les Documents A/B confirment maintenant le workflow metier Hahitantsoa suivant :

1. creation du dossier client / dossier de reservation ;
2. verification calendrier et disponibilite ;
3. selection des offres Hahitantsoa ;
4. generation proforma ;
5. generation contrat ;
6. contrat signe + acompte recu ;
7. recontrole transactionnel des disponibilites ;
8. reservation confirmee ;
9. facture, logistique, bon de livraison, retour, casse/remise en etat ;
10. workflow d'avenant pour toute modification post-contrat.

Les points qui restent a definir au niveau implementation repository ne sont plus le workflow
metier de haut niveau, mais sa traduction technique :

- les noms exacts des statuts persistants ;
- les champs backend exacts pour le cycle de vie complet ;
- le sequencing fin des futures APIs et services ;
- les details non specifies dans Documents A/B.

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
- Le partage d'inventaire entre Hahitantsoa et Titan doit passer par des regles de disponibilite
  controlees.
- Un proforma n'est jamais une confirmation.
- Une reservation confirmee exige contrat signe, acompte recu et recontrole des disponibilites.
