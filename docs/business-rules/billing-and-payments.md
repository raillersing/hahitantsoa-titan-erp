# Facturation et paiements

Source prioritaire : `docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf`
et `docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf`.
Voir aussi `docs/audits/F92_HAHITANTSOA_LIFECYCLE_SOURCE_TRACE.md`.

- INV-007 : moyens de paiement acceptes : Cash, MVola, Cheque et Virement.
- INV-008 : chaque paiement valide genere un recu.
- INV-009 : echeances : 50 % du reste a payer a J-30, puis solde final et caution a J-10.
- INV-012 : les statuts MVola/paiement `PENDING`, `CONFIRMED`, `FAILED`, `CANCELLED` et
  `RECONCILED` sont des statuts de paiement et ne doivent pas etre reutilises comme statuts de
  cycle de vie de reservation Hahitantsoa.

Un proforma reste une estimation. Un contrat signe est immuable ; toute modification passe par proforma de modification puis avenant.
