# Rapport de Mission 6G-R1 : Clients & Prospects (Fondations Mockées)

## Objectif

Finaliser la base UX/frontend mockée du module **Clients & Prospects**, conformément aux règles de la phase 6G et sans modifier le backend. Ce module permet de centraliser la gestion des contacts (Particuliers / Entreprises) et leur suivi commercial, de l'état de Prospect à celui de Client.

## Travail accompli

### 1. Page `#customers` (Liste des Clients & Prospects)
- **Tableau de bord centralisé :** Affichage de tous les contacts mockés avec leur type (Particulier / Entreprise), statut (Prospect / Client), dernier dossier associé et solde restant.
- **Filtres et Recherche dynamique :** Implémentation d'une barre de recherche (par nom, email, téléphone, ID) et de filtres rapides (Tous, Prospects, Clients, Particuliers, Entreprises, Avec solde restant, etc.).
- **Création Rapide :** Ajout d'une modal "Nouveau client / Nouveau prospect" avec formulaire adapté au type de contact (Particulier : Nom/Prénom ; Entreprise : Raison sociale). La création ajoute le contact au `mockData` local.

### 2. Page `#customer/:id` (Fiche Client & Prospect Unifiée)
- **Entête et Actions Rapides :** Affichage du statut, type, et initiales. Bouton dynamique : "Nouvelle réservation" pour un Client, "Convertir en client" pour un Prospect.
- **Situation Financière :** Synthèse du total facturé, total payé, et reste à payer (calculée à partir des réservations mockées du client).
- **Pièces Jointes :** Affichage mocké adapté au type de contact (CIN/Passeport pour Particulier, NIF/STAT/RCS pour Entreprise).
- **Édition locale :** Possibilité de modifier et sauvegarder les coordonnées principales en mode mock.
- **Historique des Dossiers :** Tableau listant toutes les réservations liées, avec des liens vers le détail de chaque dossier (`#reservation-detail`).
- **Agenda & Relances :** Section listant les prochains rendez-vous et relances (ex: "Appel téléphonique prévu pour relance").

### 3. Conversion et Breadcrumbs
- La conversion d'un Prospect en Client se fait via un simple clic sur un bouton dans la fiche. Le statut est immédiatement mis à jour localement, débloquant le bouton "Nouvelle réservation".
- Les breadcrumbs (fil d'ariane) dans le `AppShell` ont été ajustés pour refléter la navigation :
  - `Clients & Prospects` > `Fiche client — [Nom du contact]`
  - Lors de la création d'une réservation depuis la fiche client, le chemin `Clients & Prospects` > `[Nom du contact]` > `Nouvelle réservation` est correctement construit.

### 4. Tests Unitaires
- Deux nouveaux fichiers de tests (`CustomersPage.test.tsx` et `CustomerDetailPage.test.tsx`) ont été créés pour valider le comportement (filtres, création, affichage dynamique des champs selon le type d'entité, et la conversion Prospect > Client).
- Une correction de collision d'ID pour la conversion a été réalisée (`handleConvert`).
- **État CI :** Tous les tests Vitest passent avec succès (317/317).

## Smoke Test (Validation)
1. **Accès au hub `#customers` :** La page s'affiche avec Ando Rakoto, Rasoa Nomena, et Jean Dupont (Prospect).
2. **Création d'un client :** La modale fonctionne, on peut choisir le type et valider, le contact est ajouté localement.
3. **Visite du Prospect (Jean Dupont) :** La fiche s'affiche correctement, le bouton "Convertir en client" est bien visible. Le clic met à jour le statut au vert et propose "Nouvelle réservation".
4. **Parcours Nouvelle réservation :** L'accès via le client (ex: Ando Rakoto) indique clairement "Quel volet pour ce client ?" dans la page `#reservation-new`.
5. **Breadcrumbs :** Tous les retours en arrière via le menu du haut sont fonctionnels.

## Prochaine étape
La fondation mockée 6G est en place et stable. La suite logique consisterait à implémenter les autres écrans prévus dans 6G (ex. Gestion des relances commerciales centralisée si requise) ou préparer la transition vers le backend.
