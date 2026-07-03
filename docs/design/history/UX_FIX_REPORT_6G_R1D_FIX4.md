# Rapport de correction UX : 6G-R1d-fix4 (Proforma prospect non confirmée)

## Résumé
La mission a permis de corriger la distinction stricte entre les étapes préliminaires (Prospect/Proforma) et la contractualisation réelle.

## Corrections apportées
1. **Suppression des champs inutiles** : 
   - Dans le volet de création "Demande commerciale" du prospect, les champs *Date souhaitée* et *Budget estimatif* ont été supprimés pour éviter toute redondance avec la suite du parcours (proforma ou calendrier).
2. **Vue Proforma Prospect (Non confirmée)** :
   - L'ouverture d'un détail de réservation (`ReservationDetailPage`) concernant une proforma issue d'un prospect (ex: ID `PROF-PROS-...`) affiche désormais une vue spécialisée.
   - Cette vue indique explicitement "Prospect non confirmé" et affiche uniquement le résumé du besoin et le document de proforma.
3. **Masquage des modules post-validation** :
   - Sur cette même vue, les formulaires de paiements en tranches, le contrat, la facture, et la gestion logistique (livraison/retour/casses) sont intégralement masqués.
4. **Correction du rapport précédent** :
   - L'artefact erroné `REPORT_STEP6F_R5.md` a été déplacé vers `docs/design/UX_FIX_REPORT_6G_R1D_FIX3.md`.

## Règle métier future : Proforma Prospect → Contrat
- Un prospect disposant d'une proforma ne bascule en "Client" (et sa proforma en contrat) **que lorsqu'il effectue un premier paiement/acompte** ou procède à une confirmation explicite et formelle.
- **Prérequis légaux** : Avant toute contractualisation, les informations légales obligatoires doivent être renseignées :
  - **Particuliers** : Numéro CIN/Passeport, date/lieu de délivrance, données éventuelles de duplicata, adresse, et téléphone.
  - **Entreprises** : NIF, STAT, RCS (si applicable), nom et qualité du représentant légal, et coordonnées complètes.
- **Actions post-paiement** : 
  - La conversion s'opère.
  - Le contrat est émis, et le dossier passe en "Confirmé", débloquant ainsi la gestion des stocks, des factures et du planning.
- **Cette mécanique devra être développée lors de 6G-R2 ou d'une phase dédiée, et reste conditionnée à un bouton "Passer à la contractualisation" actuellement en état inactif (disabled).**
