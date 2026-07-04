# Rapport de Mission : 6G-R2-R1

## 1. Objectif
Finaliser l'implémentation du flux de conversion mock d'un Prospect vers un Client via le paiement d'un acompte et la complétion des informations légales, sans modifier le backend ni reconnecter l'API.

## 2. Parcours conversion Prospect → Client
Le parcours a été mis à jour pour interdire la conversion directe en un clic. La proforma seule ne convertit jamais un prospect en client. La conversion passe désormais par un assistant de conversion en 3 étapes.

## 3. Assistant informations légales
L'assistant recueille les informations nécessaires selon le type de client (Particulier ou Entreprise). Les champs obligatoires sont validés nativement par le navigateur.

## 4. Assistant acompte mock
L'étape d'acompte mock s'affiche avec la proforma associée. Le montant de l'acompte est ajustable et validé pour ne pas dépasser le montant de la proforma ni être inférieur ou égal à 0. Les modes de paiement sont configurables.

## 5. Conversion finale
La dernière étape résume les actions (statut changé en client, dossier confirmé, paiement d'acompte enregistré). Au succès, le badge du prospect devient vert ("Client") et le toast de succès apparaît.

## 6. Documents après conversion
La génération du contrat est bloquée tant que le client reste un "Prospect". Après conversion, les boutons pour accéder au contrat et à la gestion des paiements sont débloqués sur le dossier confirmé.

## 7. Non-régressions 6G-R1
Les fonctionnalités de 6G-R1 restent intactes. L'affichage et la navigation (menus, onglets, création client/entreprise, proformas et dashboards) ont été validés par les tests.

## 8. Fichiers modifiés
- `frontend/src/prototype/ProspectConversionAssistant.tsx`
- `frontend/src/prototype/CustomerDetailPage.tsx`
- `frontend/src/prototype/CustomerDetailPage.test.tsx`
- `frontend/src/prototype/ReservationDetailPage.tsx`
- `frontend/src/prototype/ReservationDetailPage.test.tsx`
- `frontend/src/prototype/DocumentPreview.tsx`

## 9. Résultat build
- built in 2.75s
- Un warning chunk Vite `Some chunks are larger than 500 kB after minification` (non bloquant) a été observé.

## 10. Résultat tests
- 37 fichiers passés
- 320 tests passés
- durée 46.56s

## 11. Confirmations
- **Frontend-only** : Oui.
- **Mock-only** : Oui.
- **Aucun backend/Docker/migration/.env/secrets** : Confirmé.
- **Aucun PDF source ajouté** : Confirmé.
- **Aucun commit/push/PR** : Confirmé (jusqu'à cette étape de préparation).
- **API non reconnectée** : Confirmé.

## 12. Recommandation
- Exécuter un smoke test manuel final par l'utilisateur si nécessaire.
- Procéder au commit/PR selon les validations habituelles.
