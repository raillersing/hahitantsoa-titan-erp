# Reservations

Source prioritaire : `docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf`
et `docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf`.
Voir aussi `docs/audits/F92_HAHITANTSOA_LIFECYCLE_SOURCE_TRACE.md`.

- INV-001 : un proforma est une estimation et ne confirme pas definitivement une reservation.
- INV-002 : une reservation est confirmee uniquement apres signature prealable du contrat officiel dans son delai de validite, encaissement du versement contractuel requis et revalidation reussie des disponibilites. Aucun paiement ne peut etre enregistre avant signature formelle du contrat. Voir [`DEC-009`](../decisions/DEC-009-reservation-contract-sequencing-and-access-rules.md).
- INV-003 : la confirmation et le controle des disponibilites devront etre transactionnels afin d'eviter les doubles allocations.
- INV-004 : les materiels sont partages entre Hahitantsoa et Titan.
- INV-005 : Titan autorise uniquement articles, materiels et packs materiels ; jamais local ni service.
- INV-006 : un contrat signe est immuable ; toute modification passe par proforma de modification puis avenant.
- INV-010 : le workflow Hahitantsoa suit : dossier client -> verification calendrier/disponibilite ->
  selection des offres -> emission proforma -> generation du contrat officiel (avec date de validite paramétrable, defaut 15 jours) ->
  signature du contrat par le client -> encaissement du versement contractuel de reservation (montant établi Article 5, pas d'« acompte » libre) ->
  recontrole transactionnel -> confirmation définitive, puis flux facture/logistique/BL/retour/casse.
- INV-011 : les materiels confirmes dans un scope deviennent indisponibles dans l'autre scope.
- INV-013 : des confirmation de l'evenement Hahitantsoa (100 % du versement contractuel encaisse), la date et le lieu sont verrouilles de maniere exclusive. Les options/brouillons concurrents sur la meme date sont automatiquement archives.
- INV-014 : un evenement Hahitantsoa confirme ne peut etre annule qu'en cas de force majeure, avec motif obligatoire, et sans aucun remboursement des sommes deja encaissees.
- INV-015 : les dossiers portent obligatoirement une référence canonique séquentielle sans trou (`T-{seq:03d}/{year}` pour Titan, `H-{seq:03d}/{year}` pour Hahitantsoa). Les documents dérivés héritent de cette référence avec leur suffixe normalisé (`-PF`, `-CT`, `-FP`, `-BL`, `-BR`, `-FA`, `-FC`, `-DR`, `-REC-xx`). Voir [`DEC-008`](../decisions/DEC-008-dossier-and-document-numbering-standards.md).
- INV-017 : dans le contrat Hahitantsoa, les horaires d'acces aux locaux pour les intervenants du client (Article 3) sont calcules dynamiquement selon l'occupation de la veille (J-1) :
  - Pas d'evenement la veille : « Les intervenants du client peuvent accéder aux locaux à 15 heures 30 »
  - Fete de jour la veille : « Les intervenants du client peuvent accéder aux locaux à 23 heures 30 »
  - Nuit option 1 ou option 2 la veille : « Les intervenants du client peuvent accéder aux locaux à le jour-J à 07 heures »
  Voir [`DEC-009`](../decisions/DEC-009-reservation-contract-sequencing-and-access-rules.md).

Une reservation confirmee dans Hahitantsoa rend le materiel indisponible dans Titan, et inversement.

Pour les montants officiels de versement contractuel, de caution, les pénalités et les règles détaillées, voir [`official-amounts.md`](official-amounts.md).

