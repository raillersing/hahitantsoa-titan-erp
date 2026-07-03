# UX Phase 6G-R1 - Clients & Prospects : Clôture Finale

## 1. Statut final 6G-R1
La phase 6G-R1 officiellement clôturée après la validation des correctifs successifs (jusqu'à 6G-R1d-fix5). 

## 2. Périmètre livré Clients & Prospects
La fondation logicielle du module Clients & Prospects est en place dans le prototype UI. Le système permet la création, la sélection et l'intégration de prospects ou clients dans un parcours de demande de devis/réservation.

## 3. Parcours Prospect
La distinction des demandes commerciales pour un prospect a été clarifiée et fonctionnelle :
- Proforma demandée ;
- Disponibilité demandée ;
- Visite demandée ;
- Autre.

## 4. Règle métier : Conversion Prospect
- Prospect = pas encore payé / pas encore confirmé.
- Proforma seule ne convertit pas en client.
- Paiement/acompte en 6G-R2 déclenchera la conversion Prospect → Client.

## 5. Proforma prospect
- La sélection "Proforma demandée" crée une vraie proforma mock.
- Aucun affichage prématuré de paiement, contrat, facture, ou documents logistiques tant que le dossier n'est pas confirmé.

## 6. Titan : Location matériels
- Titan est strictement confiné à la location pure matériel.
- Les champs Type d’usage et Nom du lieu ont été restaurés (6G-R1d-fix5).
- ces champs figurent dans le contrat Titan.
- aucun local/service Hahitantsoa dans Titan.

## 7. Hahitantsoa : Événementiel
- local modifiable ;
- calendrier (mois/année fonctionnel) ;
- packages/services ;
- durée/horaires (option horaire sélectionnée après les dates).

## 8. Locaux & Dépôts
- Les domaines distinguent clairement :
  - locaux louables (Hahitantsoa) ;
  - dépôts internes non louables.

## 9. Validation technique
- build OK ;
- tests OK : 319 ;
- frontend-only ;
- mock-only ;
- aucun backend/API/Docker/migration/.env/secrets.

## 10. Risques restants
- Les données reposent sur des mocks / localStorage ;
- pas encore backend ;
- pas encore contrat serveur/PDF réel ;
- pas encore paiement réel ;
- conversion Prospect → Client reportée à 6G-R2.

## 11. Prochaine étape
- 6G-R2 : conversion Prospect → Client via acompte/paiement + informations légales + contrat.

## Addendum final — Audit global des documents générés et correction fix6

- **Date / mission** : 6G-R1d-fix6
- **Documents audités** :
  - Titan : Proforma, Contrat, Facture
  - Hahitantsoa : Proforma, Contrat, Facture, Annexes
  - Prospect : Proforma prospect Titan et Hahitantsoa
- **Anomalies corrigées** :
  - a. Fallback renforcé des dates Titan Article 3 (prévention du "non renseigné" si `startDate`/`endDate` absents localement).
  - b. Mention contractuelle ajoutée dans la proforma prospect ("Ce document est une proforma émise à titre informatif...").
- **Fichiers corrigés lors de fix6** :
  - `frontend/src/prototype/DocumentPreview.tsx`
  - `frontend/src/prototype/DocumentPreview.test.tsx`
- **Résultat final tests** :
  - 37 fichiers passés
  - 320 tests passés
- **Verdict** :
  - 6G-R1 clôturable après validation manuelle utilisateur.

## Décisions métier finales à préserver

- Prospect reste Prospect tant qu’aucun acompte/paiement n’est enregistré.
- Proforma prospect ne crée pas de contrat, facture ou réservation confirmée.
- Conversion Prospect → Client prévue pour 6G-R2 via paiement/acompte et complétion des informations légales.
- Titan conserve strictement Type d’usage et Nom du lieu dans le wizard, résumé et contrat.
- Hahitantsoa conserve local/lieu Hahitantsoa, option horaire et annexes contractuelles séparées.
- Les dépôts internes ne sont pas proposés à la location.
