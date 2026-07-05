# FRONTEND_PROTOTYPE_PARITY_R0B_REAL_FRONTEND_AUDIT

## 1. Résumé exécutif

L'audit révèle que le **prototype R1-R6 est complet, validé, et ne doit pas être refait**.
Le frontend réel, en revanche, a pris du retard par rapport aux flux validés dans le prototype. La plupart des composants réels (Panels) sont fonctionnels mais n'intègrent pas la nouvelle donne métier du prototype, en particulier l'introduction du concept de **"Prospect"** et le flux guidé de **conversion en Client**.
Les documents réels reposent sur le backend (qui est actuellement gelé) et n'affichent pas les nouvelles métadonnées validées (nom du lieu, type d'usage, packages, etc.).
**La mission prioritaire** est d'amorcer l'alignement de la gestion "Clients & Prospects" (R1) dans le frontend réel, en introduisant le concept de Prospect et la navigation associée.

## 2. Rappel : prototype validé

| Bloc | Prototype | Verdict |
|---|---|---|
| R1 | Shell / navigation / Clients & Prospects | FAIT — NE PAS REFAIRE |
| R2 | Réservations / Proformas / Conversion | FAIT — NE PAS REFAIRE |
| R3 | Documents / Contrats / Factures / Bons | FAIT — NE PAS REFAIRE |
| R4 | Disponibilité / Visites / Venues | FAIT — NE PAS REFAIRE |
| R5 | Logistique / Stock / Casse / Retour | FAIT — NE PAS REFAIRE |
| R6 | Paiements / Acomptes / Soldes | FAIT — NE PAS REFAIRE |

## 3. Matrice frontend réel vs prototype

| Bloc | Frontend réel existe ? | Alignement prototype | Tests | Verdict | Action recommandée |
|---|---|---|---|---|---|
| R1 | Oui (`CustomerPanel.tsx`) | Non (Pas de statut Prospect, pas de visites) | Oui | MANQUANT / NON CONFORME | Aligner le panel Client réel avec l'UX Prototype (Mock "Prospect") |
| R2 | Oui (`AvailabilityPanel.tsx`) | Non (Pas d'assistant de conversion `PROF-PROS`) | Oui | MANQUANT / NON CONFORME | Intégrer l'assistant de conversion (Mock/Local state) |
| R3 | Oui (`DocumentPdfPreviewPanel.tsx`) | Non (S'appuie sur le backend incomplet) | Oui | À REPORTER API | Attendre le dégel du backend pour implémenter les champs manquants |
| R4 | Oui (`PlanningPanel.tsx`) | Non (Absence de la gestion des Locaux/Dépôts et Visites) | Oui | MANQUANT / NON CONFORME | Ajouter le gestionnaire de `Venues` et `Visites` (Mock) |
| R5 | Oui (`BreakageLossPanel`, etc.) | Partiel (Manque `StockPreparationPanel`) | Oui | PARTIEL — COMPLÉTER UNIQUEMENT | Développer le panel de Préparation de stock |
| R6 | Oui (`PaymentWorkflowPanel`, etc.) | Partiel (Pas de blocage "Prospect") | Oui | PARTIEL — COMPLÉTER UNIQUEMENT | Intégrer le garde-fou Prospect sur le workflow de paiement |

## 4. Ce qu’il ne faut surtout pas refaire

- Le développement du prototype (tout est FAIT — NE PAS REFAIRE).
- La conception de la navigation et des flux métier (déjà validée).
- Les écrans réels de gestion logistique qui fonctionnent très bien (Retour, Casse, Ledger).
- Les tests du prototype (plus de 300 tests robustes existants).
- Ne pas tester manuellement les flux déjà certifiés dans le rapport 6G-R1 et 6G-R2-R1.

## 5. Écarts réels restants

**Écart 1 : Concept de Prospect absent**
- **Bloc concerné** : R1
- **Fichier réel concerné** : `frontend/src/CustomerPanel.tsx`
- **État actuel** : Seuls les clients existent. Pas de statut de conversion ni de qualification "Prospect".
- **État attendu d’après prototype** : Séparation claire Clients / Prospects avec filtres et distinction visuelle.
- **Preuve fichier** : Absence de la logique "Prospect" et du statut dans `frontend/src/CustomerPanel.tsx`.
- **Impact utilisateur** : Impossible de gérer les prospects avant signature (devis, proforma d'information).
- **Recommandation** : Introduire une logique mock de "Prospect" dans le frontend réel en se basant sur le comportement du prototype.
- **Priorité** : P0

**Écart 2 : Flux de conversion et Proforma Prospect inexistants**
- **Bloc concerné** : R2 / R6
- **Fichier réel concerné** : `frontend/src/AvailabilityPanel.tsx` / `PaymentWorkflowPanel.tsx`
- **État actuel** : Toute réservation est créée directement, le paiement est ouvert.
- **État attendu d’après prototype** : La proforma prospect (`PROF-PROS`) bloque le paiement et la facturation jusqu'à validation via un Assistant de conversion (infos légales + acompte).
- **Preuve fichier** : Pas de `ProspectConversionAssistant` dans les imports des panels réels.
- **Impact utilisateur** : Non-respect des règles métier validées pour la transition commerciale.
- **Recommandation** : Intégrer l'assistant de conversion dans les vues réelles des réservations/clients.
- **Priorité** : P0

**Écart 3 : Données contractuelles manquantes (Backend Freeze)**
- **Bloc concerné** : R3
- **Fichier réel concerné** : `frontend/src/DocumentPdfPreviewPanel.tsx`
- **État actuel** : Le frontend génère les PDF via le backend qui n'a pas les champs (Type d'usage, Options, Pack).
- **État attendu d’après prototype** : Affichage des champs détaillés dans le contrat.
- **Preuve fichier** : L'API `getDocumentInstancePdfBlob` retourne des PDF incomplets.
- **Impact utilisateur** : Contrats PDF générés non conformes au modèle légal validé dans le prototype.
- **Recommandation** : Différer cette mise à jour à la fin du gel fonctionnel backend (Backend Freeze).
- **Priorité** : P2 (À REPORTER API)

## 6. Prochaine mission unique recommandée

- **Nom mission** : 6G-R3-FE-CUSTOMER-REAL — Alignement du CustomerPanel réel avec le prototype Prospect/Client
- **Objectif** : Remplacer l'actuel `CustomerPanel.tsx` réel par une structure reprenant la distinction "Clients & Prospects" issue de `CustomersPage.tsx` (prototype). Adapter l'état local pour simuler le concept de Prospect si le backend ne le gère pas.
- **Pourquoi maintenant** : C'est la fondation du bloc R1, prérequis indispensable avant d'intégrer l'assistant de conversion (R2) et les blocages de paiement (R6).
- **Fichiers probables** : `frontend/src/CustomerPanel.tsx`, `frontend/src/CustomerPanel.test.tsx`
- **Ce qu’il ne faut pas toucher** : Le backend (gel strict), l'API, les modèles, Docker, `.env`. Ne pas effacer le code du prototype.
- **Tests ciblés** : Mettre à jour `CustomerPanel.test.tsx` pour s'assurer que le rendu filtre correctement les prospects.
- **Critère de fin** : Le `CustomerPanel.tsx` de l'application réelle affiche la liste et la fiche en différenciant les Prospects des Clients selon l'UX validée, sans aucun appel API backend non autorisé.

## 7. Confirmations

- **Audit uniquement** : Oui.
- **Aucun code modifié** : Oui.
- **Aucun backend/Docker/migration/.env/secrets** : Oui.
- **Aucun PDF source ajouté** : Oui.
- **Aucune API reconnectée** : Oui.
- **Aucun commit/push/PR** : Oui.
- **Aucun test manuel répété** : Oui.
