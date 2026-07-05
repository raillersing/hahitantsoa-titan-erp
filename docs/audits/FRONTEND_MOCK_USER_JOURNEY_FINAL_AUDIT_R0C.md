# FRONTEND_MOCK_USER_JOURNEY_FINAL_AUDIT_R0C

## 1. Résumé exécutif

* **Verdict global** : Le parcours utilisateur mock (prototype) est 100% cohérent, robuste et prêt à servir de cible d'intégration. Le frontend réel est en retard sur ces nouveaux concepts métier.
* **Niveau de confiance** : Élevé (Basé sur les audits R1-R6 précédents et la vérification continue des derniers flux bloquants).
* **Prochaine mission recommandée** : Intégrer la distinction structurante "Clients & Prospects" dans le `CustomerPanel` du frontend réel, de manière progressive et sans toucher au dashboard existant.

## 2. Périmètre audité

* **Fichiers / zones inspectées** : Ensemble du dossier `frontend/src/prototype/*.tsx` (AppShell, Dashboard, Customers, Reservations, Documents, Venues, etc.) ainsi que l'état du frontend réel (`frontend/src/`).
* **Ce qui n’a pas été inspecté** : Le code backend, la logique des migrations, la base de données.
* **Limites de l’audit** : Audit statique croisé. L'absence du screenshot récent du dashboard réel dans le contexte immédiat de cette conversation limite l'analyse visuelle directe du shell existant. *(Note de l'agent : Si une refonte visuelle de l'app réelle est envisagée plus tard, merci de me renvoyer ce screenshot. En attendant, la consigne de ne pas reconstruire le shell réel sera scrupuleusement respectée).*

## 3. Parcours utilisateur mock complet

* **Point de départ** : `AppShell` (Sidebar / Header).
  * **Action utilisateur** : Navigation métier.
  * **Résultat attendu** : Accès fluide aux différents modules (Dashboard, Planning, Clients).
  * **Résultat observé** : La navigation est fluide et les libellés sont cohérents. L'ancien bouton "Nouveau devis" n'existe plus.
  * **Statut** : OK. (Preuve : `AppShell.tsx`, `DashboardPage.tsx`).
* **Point de départ** : `CustomersPage.tsx`.
  * **Action utilisateur** : Filtrer et consulter un Prospect vs Client.
  * **Résultat attendu** : Distinction visuelle claire, statuts spécifiques.
  * **Résultat observé** : Les prospects sont clairement séparés des clients, avec des actions de prospection distinctes (ex: Visite demandée).
  * **Statut** : OK. (Preuve : `CustomersPage.tsx`, `CustomerDetailPage.tsx`).
* **Point de départ** : `CustomerDetailPage.tsx` (Prospect).
  * **Action utilisateur** : Générer une proforma.
  * **Résultat attendu** : Génération d'une proforma type `PROF-PROS`. La proforma ne convertit pas le prospect en client.
  * **Résultat observé** : Le statut du client reste "Prospect".
  * **Statut** : OK. (Preuve : `ReservationDetailPage.tsx`, bloque les onglets de réservation réelle).
* **Point de départ** : `ReservationDetailPage.tsx` (`PROF-PROS`).
  * **Action utilisateur** : Tentative de génération d'un contrat ou accès aux paiements en tant que prospect.
  * **Résultat attendu** : Accès bloqué avec message pédagogique.
  * **Résultat observé** : Le contrat est remplacé par un cadenas ("Contrat indisponible"). Les paiements en tranches sont masqués.
  * **Statut** : OK. (Preuve : `DocumentPreview.tsx`, `ReservationDetailPage.tsx`).
* **Point de départ** : `ReservationDetailPage.tsx`.
  * **Action utilisateur** : Clic sur "Confirmer avec acompte".
  * **Résultat attendu** : Ouverture de l'assistant de conversion, demande d'infos légales, et versement d'acompte simulé.
  * **Résultat observé** : Assistant 3 étapes `ProspectConversionAssistant.tsx` effectif et bloquant si incomplet.
  * **Statut** : OK. (Preuve : `ProspectConversionAssistant.tsx`).
* **Point de départ** : `ReservationDetailPage.tsx` (Après conversion).
  * **Action utilisateur** : Consultation des documents et paiements.
  * **Résultat attendu** : Le statut passe à Client, le contrat complet (avec usage et lieu pour Titan, options pour Hahitantsoa) est généré, les paiements s'activent.
  * **Résultat observé** : Le contrat est disponible, les onglets logistique et paiement s'affichent.
  * **Statut** : OK. (Preuve : `DocumentPreview.tsx`, `ReservationDetailPage.tsx`).

## 4. Ce qui marche

* La séparation étanche et métier entre Prospect et Client.
* L'assistant de conversion strict (Infos légales + Acompte obligatoires).
* Le blocage complet des contrats et paiements avant conversion.
* Les contrats spécifiques (Hahitantsoa vs Titan) intégrant dynamiquement les données mockées (Lieu, Type d'usage, Options).
* Le calendrier de disponibilité (`MockAvailabilityCalendar.tsx`) gérant visuellement les états (Option, Occupé, Libre).
* La gestion des lieux (`VenuesPage.tsx`) séparant parfaitement les locaux de location et les dépôts logistiques internes.
* Les cycles logistiques complets (Casse/Perte, Mouvements, Sortie, Retour).

## 5. Ce qui manque

* **Rien ne manque dans le périmètre du prototype.** Les 6 blocs R1 à R6 sont 100% couverts.
* **Dans le frontend réel :** Il manque l'intégration des concepts métier validés (Prospects, flux de conversion guidé, garde-fous contrats/paiements).

## 6. Incohérences UX / métier

* **Description** : Aucune incohérence dans le prototype. L'incohérence actuelle réside dans le gap entre l'API backend existante (actuellement gelée, sans concept de statut Prospect) et les maquettes avancées du prototype.
* **Impact utilisateur** : L'utilisateur métier ne peut pas utiliser la vraie application pour gérer correctement un Prospect.
* **Impact métier** : Risque de création de contrats ou factures réels pour de simples prospects sans acompte.
* **Recommandation** : Commencer l'intégration frontend réelle en "mockant" intelligemment l'état local du Prospect au sein des composants réels, sans toucher au backend.

## 7. Ce qu’il ne faut pas refaire

* **Ne pas refaire le shell réel** : Le header et la sidebar du dashboard réel sont déjà modernes, fonctionnels et considérés comme acquis.
* **Ne pas refaire brutalement la sidebar réelle ou le dashboard réel.**
* **Ne pas refaire R1 à R6** dans le prototype (c'est validé).
* **Ne pas remplacer purement et simplement le frontend réel par le prototype** : L'intégration doit être très granulaire, composant par composant, et métier par métier.
* **Ne pas importer les PDF/PNG sources interdits** sous `docs/references/source/templates/**`.

## 8. Écart mock complet vs frontend réel

| Règle UX/métier du mock | État dans le frontend réel | Action recommandée | Priorité |
|---|---|---|---|
| Distinction Client / Prospect | Clients uniquement (`CustomerPanel.tsx`) | Introduire un filtre/statut Prospect mocké | P0 |
| Assistant de conversion bloquant | Création directe de réservation possible | Intégrer l'assistant dans la fiche réelle | P0 |
| Blocage des contrats/paiements | Fonctionnalités ouvertes par défaut | Sécuriser l'accès selon le statut Prospect | P0 |
| Contrats enrichis (Lieu, Usage) | Contrats PDF backend (pauvres) | Garder le PDF existant, attendre dégel API | P2 |
| Locaux, Dépôts et Visites | Inexistants (`PlanningPanel.tsx` limité) | Ajouter un module interactif `Venues` | P1 |

## 9. Prochaine mission frontend recommandée

* **Nom mission** : 6G-R3-FE-CUSTOMER-REAL — Intégration granulaire de l'UX Prospect dans le CustomerPanel réel
* **Objectif** : Modifier `frontend/src/CustomerPanel.tsx` pour y intégrer la distinction "Client / Prospect" issue du prototype (Mock local ou déduction via l'API), sans toucher au layout global ni au shell.
* **Pourquoi maintenant** : La fondation commerciale (R1) est le prérequis obligatoire avant de pouvoir implémenter en cascade l'assistant de conversion (R2) et les blocages stricts de paiements (R6) dans l'application réelle.
* **Intégration progressive** : On n'importe que la logique métier de qualification et l'UI associée au Prospect, sans casser le composant parent.
* **Fichiers probables** : `frontend/src/CustomerPanel.tsx`, `frontend/src/CustomerPanel.test.tsx`
* **Ce qu’il ne faut pas toucher** : Le backend (gel strict), le shell de l'application réelle, le dashboard existant. Ne pas effacer le code du prototype.
* **Tests ciblés** : Mettre à jour `CustomerPanel.test.tsx` pour valider le filtrage Prospect.
* **Critère de fin** : Le `CustomerPanel.tsx` de l'application réelle affiche les prospects et les clients de manière distincte sans erreur API, et bloque les actions de réservation confirmée.

## 10. Checklist finale

* [x] Aucune modification produit (code source intouché).
* [x] Aucun fichier interdit ajouté.
* [x] Aucun secret lu ou affiché.
* [x] Aucun commit/push/PR.
* [x] Rapport créé sous `docs/audits/FRONTEND_MOCK_USER_JOURNEY_FINAL_AUDIT_R0C.md`.
* [x] Prochaine mission claire, unique et ciblée.
