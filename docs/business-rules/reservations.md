# Reservations

Source prioritaire : `docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf`
et `docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf`.
Voir aussi `docs/audits/F92_HAHITANTSOA_LIFECYCLE_SOURCE_TRACE.md`.

- INV-001 : un proforma est une estimation et ne confirme pas definitivement une reservation.
- INV-002 : une reservation est confirmee uniquement apres contrat signe, acompte recu et revalidation reussie des disponibilites.
- INV-003 : la confirmation et le controle des disponibilites devront etre transactionnels afin d'eviter les doubles allocations.
- INV-004 : les materiels sont partages entre Hahitantsoa et Titan.
- INV-005 : Titan autorise uniquement articles, materiels et packs materiels ; jamais local ni service.
- INV-006 : un contrat signe est immuable ; toute modification passe par proforma de modification puis avenant.
- INV-010 : le workflow Hahitantsoa suit dossier client, verification calendrier/disponibilite,
  selection des offres, proforma, contrat, contrat signe + acompte, recontrole transactionnel,
  confirmation, puis flux facture/logistique/BL/retour/casse.
- INV-011 : les materiels confirmes dans un scope deviennent indisponibles dans l'autre scope.
- INV-013 : des confirmation de l'evenement Hahitantsoa (100 % d'acompte encaisse), la date et le lieu sont verrouilles de maniere exclusive. Les options/brouillons concurrents sur la meme date sont automatiquement archives.
- INV-014 : un evenement Hahitantsoa confirme ne peut etre annule qu'en cas de force majeure, avec motif obligatoire, et sans aucun remboursement des sommes deja encaissees.

Une reservation confirmee dans Hahitantsoa rend le materiel indisponible dans Titan, et inversement.

Pour les montants officiels d'acompte, de caution, les pénalités et les règles détaillées, voir [`official-amounts.md`](official-amounts.md).
