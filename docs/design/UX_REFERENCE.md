# ERP Hahitantsoa/Titan — UX Reference

> Version : 6F-R5 — Juillet 2026
> Statut : référence UX canonique pour la finalisation du frontend

## 1. Statut du document

### Objectif
Ce document est la référence UX canonique pour finaliser le frontend de l’ERP Hahitantsoa/Titan. Il ne remplace pas les documents métier A/B ; il les traduit en parcours, écrans, actions, états, erreurs et règles d’interaction.

### Périmètre
- Partir de l’existant validé (Prototype 4, design system, frontend mocké avancé).
- Ne pas remplacer ou contredire les parcours stabilisés sauf écart explicite avec les sources de vérité.
- Documenter l’UX cible complète pour éviter les incohérences lors des prochaines intégrations.
- Cette mission est **documentation/UX uniquement** : aucun code React, backend, Docker ou migration n’est modifié.

### Règle de conservation UX

```text
Règle de conservation UX :
Le document UX part de l’existant validé et ne le remplace pas.
Les parcours déjà stabilisés doivent être documentés comme base de référence.
Si un écart existe entre le Prototype 4, les Documents A/B, le Guide de développement et le frontend actuel, ne pas trancher seul.
Documenter l’écart dans “Gaps UX restants / arbitrages nécessaires”.
Aucune UX déjà validée ne doit être contredite sans arbitrage explicite.
```

### Mises en garde
- Toute divergence constatée entre le prototype, le frontend mocké et les documents A/B est documentée dans la section [Gaps UX restants](#26-gaps-ux-restants--arbitrages-nécessaires) et ne modifie pas l’UX validée sans arbitrage métier explicite.
- Les écrans, flows et règles décrits ici sont l’état cible ; le prototype mocké actuel implémente déjà une grande partie de cette cible.

---

## 2. Sources de vérité

Les sources suivantes ont été consultées pour rédiger ce document :

1. **Prototype 4 validé client** : `docs/design/prototypes/client-approved/ERP Hahitantsoa - Prototype 4.html`.
2. **Design system canonique** : `docs/design/DESIGN.md`.
3. **Référence UI client approuvée** : `docs/design/CLIENT_APPROVED_UI_REFERENCE.md`.
4. **Contrat de migration UI** : `docs/design/UI_MIGRATION_CONTRACT.md`.
5. **Contrat light/dark** : `docs/design/THEME_AND_DARK_MODE_CONTRACT.md`.
6. **Documents métier** :
   - `docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf`
   - `docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf`
7. **Guide de développement** : `docs/references/source/Guide_Developpement_Hahitantsoa_Titan_v1.8.pdf`.
8. **Templates documentaires** : `docs/references/source/templates/` (contrats, proformas, factures, BL, casse, avenants, plan de masse, etc.).
9. **Assets de marque** : `docs/design/brand/assets/` et `frontend/public/brand/`.
10. **Frontend prototype actuel** :
    - `frontend/src/App.tsx`
    - `frontend/src/prototype/AppShell.tsx`
    - `frontend/src/prototype/mockData.ts`
    - `frontend/src/prototype/DocumentPreview.tsx`
    - `frontend/src/prototype/ReservationNewPage.tsx`
    - `frontend/src/prototype/ReservationDetailPage.tsx`
    - `frontend/src/prototype/PackageBuilderPage.tsx`
    - `frontend/src/prototype/ServicesPage.tsx`
    - `frontend/src/prototype/BlacklistPage.tsx`
    - `frontend/src/prototype/InventoryPage.tsx`, `InventoryItemPage.tsx`, `StockMovementsPage.tsx`, `StockPreparationPage.tsx`
    - `frontend/src/prototype/LogisticsDispatchPage.tsx`, `LogisticsReturnsPage.tsx`, `BreakageLossPage.tsx`, `CautionPage.tsx`
    - `frontend/src/prototype/DashboardPage.tsx`, `PlanningPage.tsx`, `CustomersPage.tsx`, `CustomerDetailPage.tsx`, `CommercialOpsPage.tsx`, `CashboxPage.tsx`, `ReportsPage.tsx`, `HelpPage.tsx`, `AuditPage.tsx`
11. **Styles** : `frontend/src/styles.css`.
12. **Rapports** : `REPORT_STEP5M.md` (mapping templates contrats). `REPORT_STEP6F_R4.md` n’était pas présent au moment de la rédaction.

### Ordre de priorité en cas de conflit
1. Décisions acceptées dans `docs/decisions/`.
2. ADRs acceptées dans `docs/adr/`.
3. Documents A/B et guide de développement v1.8.
4. Référence UI client approuvée et Prototype 4.
5. Frontend mocké existant et design system.

---

## 3. Principes UX globaux

### Valeurs fondamentales
- **Clarté opérationnelle avant esthétique** : chaque écran doit permettre de comprendre l’état, le risque et l’action suivante.
- **Rétroaction visible** : aucune action silencieuse. Tout bouton produit un feedback (toast, état, spinner, état vide, confirmation).
- **État explicite** : brouillon, proforma, contrat signé, acompte, confirmé, à préparer, en sortie, retourné, clôturé, annulé sont lisibles sans ambiguïté.
- **Progressive disclosure** : résumé puis détail, fiches puis tableaux, actions critiques isolées.
- **Accessibilité** : navigation clavier viable, labels liés, focus visible, contraste suffisant, couleur jamais seule indicateur.
- **Mobile/tablette viable** : empilement vertical, touches accessibles, pas de défilement horizontal obligatoire.
- **Thèmes lisibles** : light par défaut, dark supporté via `dark`/`theme-dark` et tokens CSS, documents PDF figés restent en light.

### Règles transversales
- **Navigation stable** : sidebar hiérarchique complète, breadcrumbs complémentaires, jamais remplacement de la sidebar par le breadcrumb.
- **Mock avant API** : pendant la phase prototype, les données sont mockées via `mockData.ts` et `localStorage` ; l’API arrive plus tard.
- **Données critiques confirmées** : toute validation sensible (confirmation, paiement, sortie, caution, annulation) passe par un récapitulatifs et/ou une confirmation.
- **Actions destructives** : confirmation explicite avec conséquence nommée et cible identifiée.
- **Documents juridiquement cohérents** : labels, numérotation, versions de template et PDF figés conservés.

### Contraintes métier UX
- **Titan** : location pure de matériels/articles/packs. Aucun local, salle, domaine, service ou prestation annexe.
- **Hahitantsoa** : événement complet incluant local, matériels, services, annexes contractuelles.
- **Frontière préservée** : les composants et listes partagées gardent leurs labels/filtres propres au domaine.

### Contraintes du Guide de développement v1.8 à intégrer en UX
- **Permissions granulaires au-dessus des rôles** (R020) : le masquage frontend n’est qu’un confort ; chaque action sensible doit être vérifiable côté backend. L’UX doit donc afficher l’action mais la rendre disabled/absente selon les permissions réelles, jamais inventer une autorisation frontend-only.
- **Documents sensibles privés** (R021) : CIN, NIF, STAT, RCS et justificatifs sont servis uniquement par endpoint autorisé. L’UX ne doit jamais exposer d’URL publique permanente pour ces fichiers.
- **Templates versionnés** (R022, R023) : chaque template a une version, une date d’activation et un validateur. Un PDF généré conserve la version exacte du template. L’UX doit afficher la version du template utilisée.
- **MVola asynchrone** : un paiement MVola n’est confirmé qu’après réconciliation officielle. L’UX doit afficher les statuts PENDING/CONFIRMED/FAILED/CANCELLED/RECONCILED et interdire de marquer un paiement comme reçu avant confirmation.
- **Import Excel historique** : chargement, mapping, prévisualisation, détection doublons, validation, commit transactionnel, rapport, rollback fonctionnel. L’UX doit montrer chaque étape avant écriture définitive.
- **Stock par dépôt/zone/rayon/rack** (R033) : le frontend actuel n’a qu’un stock global mocké ; l’UX cible prévoit la localisation physique.
- **Mouvements de stock immuables** (R034) : une correction se fait par mouvement inverse. L’UX doit donc proposer une « annulation » sous forme de nouveau mouvement, jamais d’édition directe.
- **Facture de casse/remise en état** (R055-R062) : lignes articles inventoriés, éléments de local (Hahitantsoa only), nettoyage, main-d’œuvre, frais exceptionnels. Dégâts locaux interdits pour Titan.

---

## 4. Décisions UX déjà validées à préserver

Les éléments ci-dessous sont déjà stabilisés dans le prototype mocké actuel et dans les références client. **Ils ne doivent pas être cassés ou remplacés sans arbitrage explicite.**

### 1. Dashboard proche du Prototype 4
- 4 cartes KPI actionnables (Hahitantsoa, Titan, Retours à contrôler, Reste à payer).
- Graphique d’activité des 7 derniers jours avec scope Hahitantsoa/Titan.
- Carte Alertes & Notifications cliquables.
- Tableau Dossiers en cours avec badges HAH/TIT, statut, RAP, action de ligne.
- Actions rapides depuis le dashboard : Nouvelle réservation, Planning, Rapports.

### 2. Sidebar Inventaire & Stocks complète
La sidebar expose déjà les 9 sous-pages cibles :
Stock, Mouvements, Préparation, Sortie / Livraison, Retour / Restitution, Casse & Perte, Packages, Services, Liste noire.

### 3. Breadcrumbs hiérarchiques corrects
- Inventaire & Stocks : racine puis sous-page.
- Détail réservation : Réservations > Hahitantsoa|Titan > référence.
- Le breadcrumb est complémentaire ; il ne remplace pas la sidebar.

### 4. Dark/light mode lisible
- Toggle dans la topbar (`AppShell.tsx`).
- `dark`/`theme-dark` sur `<html>`.
- Documents PDF figés (`doc-preview`, `contract-a4-page`) restent en light quelle que soit le thème (`styles.css`).

### 5. Wizard réservation progressif
- 9 étapes : Départ → Client/Volet → Détails → Catalogue → Services/Livraison → Résumé → Devis → Paiement → Contrat.
- Logique de saut (Hahitantsoa location nue saute le catalogue).
- Sauvegarde/restauration de brouillon via `localStorage`.

### 6. Deux entrées réservation
- **Client d’abord** (`client_first`).
- **Volet d’abord** (`domain_first`), y compris par hash `#reservation-new/hahitantsoa` ou `#reservation-new/titan`.

### 7. Parcours Hahitantsoa
- 3 types de location : nue, nue + logistique, avec package.
- Personnes concernées selon type d’événement.
- Options horaires avec pré-remplissage de l’heure de fin.
- Caution fixe 500 000 Ar.
- Annexes 1 à 4 obligatoires dans le contrat.

### 8. Parcours Titan
- Destination, adresse, contact, GPS, Google Maps.
- Articles matériels uniquement.
- Mode livraison/prélèvement.
- Caution 100 000 Ar (< 200k) ou 50% (> 200k).
- Pénalités retard 50%/jour, dommages +100%.
- Contrat Article 2 et Article 3 auto-remplis.

### 9. Documents proforma/facture/contrats
- Labels exacts préservés :
  - `CONTRAT DE LOCATION DE MATERIELS EVENEMENTIELS « TITAN RENTAL »`
  - `CONTRAT DE LOCATION « HAHITANTSOA »`
  - `P R O F O R M A`
  - `F A C T U R E`
- Aperçu A4 en light, filigrane, signatures, total.

### 10. Packages
- Liste + éditeur de composition.
- Prix forfaitaire, total articles indicatif, écart client.
- Actif/inactif ; désactivation plutôt que suppression si utilisé.

### 11. Services
- Liste, ajout, modification, désactivation, suppression.
- Services actifs disponibles dans le wizard Hahitantsoa.

### 12. Liste noire
- Intervenants non autorisés avec nom/note/état.
- Alimente l’Annexe 4 centrée du contrat Hahitantsoa.

### 13. Stock et logistique
- Stock catalogue, fiche article, mouvements, préparation, sortie, retour, casse.
- États initiaux/retour, photos, signatures, lien vers dossier.

### 14. Détails réservation Titan/Hahitantsoa
- Onglets : Contrat & Proforma, Préparation, Sortie, Retour, Casse, Caution (Titan).
- Résumé financier, étapes Proforma → Contrat → Acompte → Confirmée → Sortie → Retour.

### 15. Règle : aucun bouton visible ne doit rester silencieux
- Toute action produit un toast, un état, un spinner, une confirmation ou un état vide explicite.

### 16. Règle : prototype mocké uniquement pendant cette phase
- Données via `mockData.ts` et `localStorage`.
- Aucune mutation backend réelle.

### 17. Règle : pas d’appel API réel depuis les routes prototype
- `api.ts` existe mais le prototype reste autonome.
- Les appels API arriveront dans une phase ultérieure après stabilisation UX.

---

## 5. Rôles utilisateurs

### 1. Direction / Gérant
- **Objectifs** : vue consolidée, validation des dossiers, accès caisse/personnel, reporting.
- **Écrans principaux** : dashboard, rapports, caisse, audit, validation caution/casse, fiches clients, détails réservation.
- **Actions fréquentes** : ouvrir/fermer caisse, valider une remise en état, approuver un avenant, consulter KPIs.
- **Risques UX** : masquer une action sensible derrière un simple badge ; afficher des données non verrouillées.
- **Critique** : montants, statuts, nom du client, dates, alertes retard/échéance.

### 2. Commercial / Réservation (Responsable Accueil et Service)
- **Objectifs** : créer/modifier des prospects et clients, éditer proformas, confirmer réservations, relancer clients.
- **Écrans principaux** : Clients & Prospects, Planning, Nouvelle réservation, détails réservation, documents, commercial ops.
- **Actions fréquentes** : nouvelle réservation, générer proforma, enregistrer acompte, suivre échéances.
- **Risques UX** : confondre brouillon et confirmé, oublier l’enregistrement de pièces jointes.
- **Critique** : statut du dossier, reste à payer, dates, type client, pièces manquantes.

### 3. Caisse / Finance
- **Objectifs** : encaissements, dépenses, rapprochement MVola, reçus, clôture caisse.
- **Écrans principaux** : Caisse, détails réservation (paiement), rapports caisse.
- **Actions fréquentes** : enregistrer paiement, générer reçu, clôturer session, justifier écart.
- **Risques UX** : double enregistrement de paiement, paiement MVola non rapproché marqué confirmé.
- **Critique** : montant, moyen, statut, RAP, caution, restitution, retenue.

### 4. Responsable stock / Magasinier
- **Objectifs** : stock, mouvements, préparation, sortie, retour, casse.
- **Écrans principaux** : Inventaire & Stocks (Stock, Mouvements, Préparation, Sortie, Retour, Casse).
- **Actions fréquentes** : valider sortie, contrôler retour, déclarer casse, ajuster stock.
- **Risques UX** : quantités non bloquées, état matériel non enregistré, photos manquantes.
- **Critique** : disponibilité, état, quantités, références dossier, responsable.

### 5. Responsable logistique
- **Objectifs** : planifier livraisons, affecter véhicules, suivre retards.
- **Écrans principaux** : Sortie/Livraison, Retour/Restitution, Planning logistique.
- **Actions fréquentes** : affecter chauffeur/vehicule, valider BL, signaler retard.
- **Risques UX** : adresse GPS non visible, contact sur place manquant.
- **Critique** : adresse, GPS, contact, heures, mode mouvement, véhicule.

### 6. Agent préparation
- **Objectifs** : préparer les articles d’un dossier.
- **Écrans principaux** : Préparation (Inventaire & Stocks).
- **Actions fréquentes** : cocher qté préparée, marquer prêt/bloqué.
- **Risques UX** : permettre de marquer « prêt » sans avoir scanné/contrôlé.
- **Critique** : qté demandée, qté préparée, disponibilité, état.

### 7. Agent livraison / retour
- **Objectifs** : exécuter sorties/retours sur le terrain.
- **Écrans principaux** : Sortie/Livraison, Retour/Restitution (mode mobile/tablette favorisé).
- **Actions fréquentes** : prendre photos, signer, valider BL/BR.
- **Risques UX** : perte de connexion non gérée, signature non enregistrée.
- **Critique** : photos, signature, état initial/retour, heure réelle.

### 8. Administrateur
- **Objectifs** : utilisateurs, rôles, paramètres, templates, audit, sauvegardes.
- **Écrans principaux** : Paramètres, Audit & Sécurité, Administration.
- **Actions fréquentes** : créer utilisateur, modifier template, consulter audit.
- **Risques UX** : modification template sans version ni trace.
- **Critique** : attribution, dates, version, action, cible.

### 9. Client particulier
- **Objectifs** (futur portail) : consulter son dossier, signer, payer, télécharger documents.
- **UX actuelle** : non implémentée ; les fiches client en interne distinguent particulier et entreprise.
- **Critique interne** : nom/prénom, CIN/passeport, adresse, contact, pièces jointes.

### 10. Client entreprise
- **Objectifs** (futur portail) : même cas que particulier avec contacts/représentants.
- **Critique interne** : nom entreprise, NIF, STAT, RCS, représentant, qualité, pièces jointes.

### 11. Intervenant externe / Prestataire
- **Objectifs** : être référencé comme prestataire autorisé ou inscrit sur liste noire.
- **UX actuelle** : Liste noire (Inventaire & Stocks) alimente l’Annexe 4 du contrat Hahitantsoa.
- **Critique** : nom, note, actif/inactif, impact Annexe 4.

---

## 6. Architecture d’information

### Arborescence cible

```
Accueil
├── Tableau de bord
├── Connexion / Déconnexion

Commercial
├── Planning
├── Clients & Prospects
└── Agenda Visiteurs (cible 6G)

Réservations
├── Hahitantsoa (liste événements)
├── Titan (liste locations)
├── Nouvelle réservation
└── Détail réservation

Inventaire & Stocks
├── Stock
├── Mouvements
├── Préparation
├── Sortie / Livraison
├── Retour / Restitution
├── Casse & Perte
├── Packages
├── Services
└── Liste noire

Finance & Opérations
├── Opérations Commerciales
├── Caisse
└── Caution

Pilotage
├── Reporting
├── Audit & Sécurité
└── Aide & Onboarding
```

### Sidebar Inventaire & Stocks (confirmée)
La sidebar React actuelle (`AppShell.tsx`) expose déjà :
- Stock (`#inventory`)
- Mouvements (`#stock-movements`)
- Préparation (`#stock-preparation`)
- Sortie / Livraison (`#logistics-dispatch`)
- Retour / Restitution (`#logistics-returns`)
- Casse & Perte (`#breakage-loss`)
- Packages (`#packages`)
- Services (`#services`)
- Liste noire (`#blacklist-intervenants`)

Cette structure est l’architecture cible pour la phase prototype. Les éléments suivants restent documentés comme cible plus tard :
- Import Excel historique
- Catalogue public
- Locaux & Composants (Hahitantsoa only)
- Personnel & Paie
- Achats & Fournisseurs

---

## 7. Règles de navigation

### Hash routes
Le frontend utilise des hash routes gérées dans `frontend/src/App.tsx` :
- `#dashboard`
- `#planning`
- `#customers`
- `#hahitantsoa`
- `#titan`
- `#reservation-new` / `#reservation-new/hahitantsoa` / `#reservation-new/titan`
- `#reservation-detail/{id}`
- `#customer/{id}`
- `#inventory`, `#inventory-item/{id}`
- `#stock-movements`, `#stock-preparation`
- `#logistics-dispatch`, `#logistics-returns`
- `#breakage-loss`
- `#packages`
- `#services`
- `#blacklist-intervenants`
- `#commercial-ops`
- `#cashbox`
- `#caution`
- `#reports`
- `#audit`
- `#help`
- `#login`

### Navigation via sidebar
- Sidebar toujours visible sur desktop, réduite/empilée sur mobile/tablette.
- Lien actif souligné par une barre latérale (teal Hahitantsoa / indigo Titan).
- Badge de scope `Événement` / `Matériel` sur les volets Hahitantsoa/Titan.

### Breadcrumbs
- Gérés dans `AppShell.tsx`.
- Pour l’Inventaire & Stocks : `Inventaire & Stocks > Sous-page`.
- Pour les détails de réservation : `Réservations > Hahitantsoa|Titan > Référence`.
- Ne remplacent pas la sidebar ; ils fournissent un contexte de page et un retour rapide.

### Boutons métier et retour arrière
- Bouton « Nouvelle réservation » actif depuis le dashboard ; en haut à droille sur les autres pages, il est visible mais disabled avec tooltip indiquant qu’il est disponible depuis le dashboard.
- Bouton « Planning » toujours accessible dans la topbar.
- Bouton « Fermer » (×) sur les pages détail retourne au dashboard.
- Bouton « Retour » dans les wizards revient à l’étape précédente avec logique de saut (ex. Hahitantsoa location nue saute le catalogue).

### Pages liste vs détail vs modales
- **Listes** : tableaux avec statut, client, période, montant, actions de ligne.
- **Détail** : fiche résumé + onglets/actions spécifiques au domaine.
- **Modales/drawers** : réservées aux confirmations, paiements et actions secondaires. L’information critique ne doit pas être cachée dans une modale par défaut.

### Mobile / tablette
- Empilement vertical des cartes.
- Sidebar compressible en drawer.
- Boutons principaux accessibles sans scroll horizontal.
- Photos et signatures favorisées via capture native (`capture="environment"`).

---

## 8. Dashboard

### Rôle
Le dashboard est le point d’entrée opérationnel. Il doit répondre aux questions :
- Que faut-il traiter maintenant ?
- Qu’est-ce qui est bloqué ?
- Qu’est-ce qui est en retard ?
- Qu’est-ce qui est financièrement non résolu ?

### KPIs et cartes
Quatre cartes principales (Prototype 4 + frontend actuel) :
- Événements Hahitantsoa ce mois (teal).
- Locations Titan ce mois (indigo).
- Retours à contrôler aujourd’hui (amber).
- Reste à payer / échéances (blue).

### Alertes
Carte « Alertes & Notifications » avec :
- Stock bas.
- Échéance J-10.
- MVola en attente.
- Retour attendu.

Chaque alerte est cliquable et mène à l’écran correspondant.

### Actions rapides
Depuis le dashboard uniquement :
- `+ Nouvelle réservation`
- `Ouvrir le planning`
- `Importer inventaire` (future)
- `Voir les rapports` (future)

### Dossiers en cours
Tableau « Dossiers en cours » avec : client, type (badge HAH/TIT), date, statut, RAP, action « Voir dossier →».

### Transitions
- Dashboard → `Nouvelle réservation`
- Dashboard → `Planning`
- Dashboard → `Stock` / `Retours` / `Facturation` / `Dossiers`

---

## 9. Parcours Nouvelle réservation — vue globale

### Entrées
- Depuis le dashboard : bouton « Nouvelle réservation ».
- Depuis les listes Hahitantsoa/Titan : bouton d’ajout.
- Par hash direct : `#reservation-new`, `#reservation-new/hahitantsoa`, `#reservation-new/titan`.

### Écran d’accueil du wizard
Deux modes de départ :
1. **Client d’abord** (`client_first`) — le commercial identifie d’abord le client.
2. **Volet d’abord** (`domain_first`) — l’utilisateur sait déjà s’il s’agit de Hahitantsoa ou Titan.

Possibilité de reprendre un brouillon sauvegardé dans `localStorage` (`prototypeReservationDraft`).

### Étapes du wizard
| # | Intitulé | Contenu |
|---|----------|---------|
| 0 | Départ | Choix client_first / domain_first ; brouillon |
| 1 | Client / Volet | Selon le mode choisi |
| 2 | Volet / Client | Sélection Hahitantsoa/Titan |
| 3 | Détails | Informations spécifiques au domaine |
| 4 | Catalogue | Articles/packs (sauté si Hahitantsoa location nue) |
| 5 | Services (Hahitantsoa) / Livraison (Titan) | |
| 6 | Résumé | Recap total, remise |
| 7 | Devis / Proforma | Génération proforma |
| 8 | Paiement | Acompte/moyen |
| 9 | Contrat | Génération + signature mock |

### Logique de saut
- Si Hahitantsoa `Location nue` ou `Location nue + logistique`, l’étape Catalogue est sautée.
- Navigation avant/arrière possible jusqu’à la dernière étape atteinte (`maxReachedStep`).

### Sauvegarde locale mock
- Bouton « Sauvegarder brouillon » persiste dans `localStorage`.
- Bouton « Reprendre brouillon » lorsqu’un draft existe.
- Bouton « Effacer brouillon » recharge la page.

### Pièces jointes et photos
- Client : catégorie (CIN/NIF/STAT/RCS/Logo/Autre) + fichier + capture mobile (`capture="environment"`).
- Paiement : justificatif (reçu MVola, chèque scanné, etc.).

### Erreurs possibles
- Client non sélectionné → bouton Continuer disabled.
- Volet non choisi → disabled.
- Dates incohérentes → validation inline.
- Quantité supérieure au stock mocké → message d’avertissement.
- Paiement supérieur au total → message.

### États du dossier
Proforma → Contrat signé → Acompte → Confirmée → À préparer → En sortie → Terminée / Clôturée / Annulée.

---

## 10. Parcours Hahitantsoa

### Types de location Hahitantsoa
- **Location nue** : local uniquement.
- **Location nue + logistique** : local + accompagnement logistique.
- **Location avec package** : local + package forfaitaire + articles complémentaires si besoin.

### Données de l’événement
- Type d’événement (Mariage, Baptême, Anniversaire, Réception privée, Séminaire, Corporate, Conférence, Atelier/Formation, Fête familiale, Autre).
- Local / Lieu.
- Dates/heures de début et fin.
- Nombre d’invités.
- Remarques.

### Personnes concernées
- **Mariage** : Marié(e) 1, Marié(e) 2, référent.
- **Fiançailles** : Fiancé(e) 1, Fiancé(e) 2.
- **Baptême** : enfant, parent/tuteur, date de baptême optionnelle.
- **Autre** : référent(s).

### Options horaires
- Fête de jour : Sortie J-J à 20:00.
- Utilisation de nuit Option 1 : Arrêt 21:00 / Sortie J-J à 22:30.
- Utilisation de nuit Option 2 : Arrêt 00:00 / Sortie J+1 à 03:30.
- L’option sélectionnée pré-remplit l’heure de fin ; l’utilisateur peut la corriger.
- Tarif option horaire configurable (affiché si facturé en supplément).

### Tarifs de base
- Prix location local (modifiable).
- Tarif logistique (si location nue + logistique).
- Packages et articles complémentaires.
- Services complémentaires.

### Caution
- **Fixe 500 000 Ar** pour Hahitantsoa (`hahitantsoaDefaultDepositAmount`).
- Versée le jour du solde.
- Remboursable en fin de location sans casse.
- Déduction automatique en cas de casse/perturbation.

### Documents
- Proforma Hahitantsoa.
- Contrat Hahitantsoa (particulier/entreprise).
- Annexes obligatoires :
  - **Annexe 1** : Règlement intérieur.
  - **Annexe 2** : Plan de masse et évacuation incendie.
  - **Annexe 3** : Prix de casse.
  - **Annexe 4** : Liste des intervenants non autorisés.

### Règles métier UX
- Acompte : 1 000 000 Ar (location nue) ; 1 500 000 Ar (location nue + logistique).
- Solde en deux tranches : 50% à J-1 mois, 50% à J-10.
- Rallonge horaire facturée par tranche de 30 min (50 000 Ar) selon contrat.
- Toute modification post-contrat passe par un avenant.
- Photos, badges, passation, poubelles, portail : règles du règlement intérieur.

### États et transitions
Proforma → Contrat signé → Acompte → Confirmée → Préparation → Sortie/Passation → Retour/État des lieux → Clôturée.

### Erreurs
- Local non renseigné.
- Dates incohérentes.
- Acompte insuffisant pour confirmation.
- Caution non mentionnée.

### Boutons
- `Générer proforma`
- `Enregistrer acompte`
- `Générer contrat Hahitantsoa`
- `Marquer confirmée`
- `Passation / Sortie`
- `Retour / État des lieux`
- `Déclarer casse`
- `Clôturer`

---

## 11. Parcours Titan

### Période et destination
- Date/heure début et fin de location.
- Nom du lieu.
- Adresse complète.
- Commune / Ville.
- Contact sur place + téléphone.
- Note d’accès.
- Coordonnées GPS optionnelles.
- Lien Google Maps mocké basé sur GPS ou adresse.

### Type d’usage
Mariage, Anniversaire, Réception privée, Séminaire, Corporate, Autre.

### Articles loués
- Sélection dans le catalogue matériel.
- Packs matériels disponibles plus tard (phase catalogue).
- Quantités, prix unitaires, total.

### Mode mouvement
- **Livraison par Titan** : dates/heures livraison et récupération, type de véhicule, responsable.
- **Prélèvement par le client** : heure de prélèvement et heure de restitution client.
- Message de rappel : « Un véhicule fourgon est exigé pour le transport des matériels. »

### Caution
- **< 200 000 Ar** : caution fixe **100 000 Ar**.
- **> 200 000 Ar** : caution **50%** du montant total.
- Retenue en cas de casse/retard.
- Remboursement si retour sans dommage.

### Retard
- Pénalité **50% par jour** de non-remise des matériels.
- Rallonge de retour avec préjudice : **+100%** frais de démantèlement/réparation.

### Casse / Perte
- Déclaration en retour ou via écran dédié.
- Prix de casse appliqué selon liste.
- Imputation sur caution ou facturation complémentaire si dépassement.

### Sortie / Livraison
- Bon de sortie interne.
- Bon de livraison client (BL).
- État initial des articles.
- Photos avant départ.
- Signature client/livreur.

### Retour / Restitution
- Date/heure réelle.
- État au retour : Bon état / Cassé / Manquant / Sale non lavé.
- Calcul retard automatique.
- Photos constat.

### Contrat Titan
- **Article 2 (Destination)** et **Article 3 (Durée)** auto-remplis depuis le wizard.
- Labels exacts : `CONTRAT DE LOCATION DE MATERIELS EVENEMENTIELS « TITAN RENTAL »`.

### États et transitions
Proforma → Contrat signé → Acompte (25%) → Solde J-5 → Confirmée → Préparation → Sortie → Retour → Casse/Perte → Caution restituée/retenue → Clôturée.

### Erreurs
- Adresse/destination manquante.
- Période invalide.
- Acompte non reçu.
- Stock insuffisant au moment de la confirmation.
- Véhicule non précisé.

### Boutons
- `Générer proforma`
- `Générer contrat Titan`
- `Marquer acompte reçu`
- `Marquer solde reçu`
- `Préparer`
- `Valider sortie`
- `Valider retour`
- `Déclarer casse`
- `Restituer caution` / `Retenir caution`

---

## 12. Clients & Prospects — UX cible 6G

> Cette section documente la cible de l’étape 6G sans l’implémenter dans cette mission.

### Liste clients / prospects
- Tableau avec nom, type, contact, dernier dossier, statut (prospect / client).
- Filtres par type, date de dernier contact, statut.
- Recherche texte (nom, téléphone, email, référence).
- Bouton « Nouveau client/prospect ».

### Fiche particulier
- Civilité, nom, prénom.
- Email (facultatif).
- Contact.
- Adresse / demeurant à.
- Date/liueu de naissance.
- Type de pièce (CIN / Passeport), numéro, délivrance, duplicata.
- Photo/scannage de la pièce.
- Photo mobile/tablette.
- Historique des dossiers.
- Rendez-vous (Agenda visiteurs).

### Fiche entreprise
- Nom de l’entreprise.
- Email (facultatif).
- Contact.
- NIF, STAT, RCS.
- Représentant : nom/prénom + qualité.
- Pièces jointes NIF/STAT/RCS/logo/autres.
- Historique des dossiers.
- Contacts associés.

### Navigation transversale
Depuis la fiche client, accès rapide vers :
- Nouvelle réservation.
- Factures / proformas.
- Cautions.
- Documents.

### Cohérence contrats
- Les champs particulier/entreprise doivent correspondre exactement aux placeholders des modèles de contrat Hahitantsoa et Titan.
- Voir `REPORT_STEP5M.md` pour le mapping templates.

### Boutons
- `Créer client`
- `Convertir prospect`
- `Nouveau rendez-vous`
- `Nouvelle réservation`
- `Voir documents`
- `Modifier`
- `Archiver`

---

## 13. Inventaire & Stocks

### 12.1 Stock
- **Objectif** : consulter le catalogue et les quantités disponibles/réservées/sorties/cassées.
- **Données visibles** : code, désignation, famille, catégorie, stock total, disponible, réservé, sorti, retour attendu, cassé/perdu, prix location, prix casse, statut (OK/Bas/Rupture), photo.
- **Actions** : ajouter, modifier, activer/désactiver, ajuster stock, voir fiche, voir mouvements.
- **États** : OK, Bas, Rupture.
- **Erreurs** : quantité négative, prix nul, suppression d’un article utilisé dans un package ou une réservation.
- **Comportement mock** : `mockInventory` avec photos optionnelles via `imageUrl`.
- **Cible finale** : stock par dépôt/zone/rayon/rack, import Excel, alertes seuil.

### 12.2 Fiche article
- **Objectif** : détail d’un article.
- **Données** : nom, catégorie, stocks, prix, prix casse, description, image principale, galerie, mouvements liés.
- **Actions** : édition, ajustement, voir mouvements, désactiver.
- **Erreurs** : suppression si mouvements/réservations existants.

### 12.3 Mouvements
- **Objectif** : historique immuable des entrées/sorties/retours/casses/pertes/ajustements/réservations/annulations.
- **Données** : ID, type, date, opérateur, article, quantité, raison, référence dossier, pièces jointes.
- **Actions** : filtrer par type/article/date/dossier.
- **Règle** : les mouvements sont immuables ; une correction se fait par mouvement inverse.

### 12.4 Préparation
- **Objectif** : lister les dossiers à préparer et valider l’état de préparation.
- **Données** : référence dossier, client, date sortie, statut (À préparer/Partiel/Prêt/Bloqué), articles avec qté commandée/préparée/disponible.
- **Actions** : incrémenter qté préparée, marquer Prêt/Bloqué.
- **Erreur** : qté préparée > qté commandée ou > disponible.

### 12.5 Sortie / Livraison
- **Objectif** : valider la sortie physique des matériels.
- **Données** : dossier, mode (Livraison Titan/Prélèvement client/Livraison Hahitantsoa), responsable, dates prévues/réelles, véhicule, articles, état initial, photos, signature.
- **Actions** : enregistrer date/heure réelle, ajouter photos, signer, valider sortie/générer BL.
- **Erreur** : article manquant, quantité erronée, signature absente.

### 12.6 Retour / Restitution
- **Objectif** : contrôler les retours.
- **Données** : date prévue/réelle, articles (attendus/retournés), état (Bon état/Cassé/Manquant/Sale non lavé), photos, notes, statut retard.
- **Actions** : enregistrer retour, déclarer casse, aller à la facturation de casse.
- **Erreur** : quantité retournée > attendue, état non renseigné.

### 12.7 Casse & Perte
- **Objectif** : facturer les préjudices et imputer la caution.
- **Données** : dossier, article, qté cassée/perdue, prix de casse, total, caution disponible, retenue, différence à facturer, statut.
- **Actions** : valider retenue, facturer différence, clôturer.
- **Erreur** : total > caution sans validation gérant.

### 12.8 Caution
- **Objectif** : suivre les cautions par dossier.
- **Données** : type (Chèque/Espèces/Virement), montant, statut, montant retenu, montant remboursé.
- **Actions** : enregistrer caution, restituer, retenir, imputer casse.

### 12.9 Packages
- Voir [section 14](#14-packages).

### 12.10 Services
- Voir [section 15](#15-services-hahitantsoa).

### 12.11 Liste noire
- Voir [section 16](#16-liste-noire--intervenants-non-autorisés).

---

## 14. Packages

### Rôle
Les packages sont des offres forfaitaires Hahitantsoa regroupant local + articles pour un prix global. Ils simplifient la vente et permettent des ajustements par articles complémentaires.

### Composition
- Nom du package.
- Description.
- Prix forfaitaire appliqué.
- Liste d’articles avec P.U. location et quantité.
- Total ligne indicatif.
- Total indicatif articles (somme des P.U. × qté).
- Écart éventuel entre total indicatif et prix forfaitaire (économie client affichée si prix forfaitaire < total articles).

### Actif / Inactif
- Un package peut être **désactivé** (invisible dans le wizard, conservé en base).
- Un package ne doit pas être **supprimé** s’il est utilisé dans des réservations passées.

### Sélection dans le parcours client
- Seuls les packages **actifs** apparaissent dans le wizard Hahitantsoa.
- Si le client modifie les quantités d’articles du package, l’écart est calculé et ajouté au total.

### Image du package — besoin UX futur
L’ajout d’image ne doit pas dépendre uniquement d’un lien URL. L’UX cible prévoit **deux options** :
1. **Explorateur de fichiers** : sélection d’une image locale (JPG/PNG/WebP).
2. **Lien URL** : saisie d’une URL d’image externe ou interne.

> Actuellement le prototype mocké ne gère que l’URL (`imageUrl`). Le besoin est à documenter pour une future itération sans l’implémenter ici.

### Preview image
- Affichage miniature dans la liste des packages.
- Aperçu agrandi dans l’édition.
- Image par défaut (icône boîte) si aucune image.

### Erreurs fichier/URL
- Type non supporté.
- Fichier trop lourd.
- URL invalide ou image non chargeable.
- Image par défaut affichée en cas d’échec.

### État vide
- Message « Sélectionnez un package dans la liste pour le modifier ».

### Boutons
- `Nouveau Package`
- `Enregistrer`
- `Désactiver`
- `Supprimer` (si non utilisé)
- `Ajouter article`
- `Modifier quantité`

---

## 15. Services Hahitantsoa

### Rôle
Services complémentaires liés à l’événement (nettoyage, assistance logistique, mise en place, support décoration, support technique, autre).

### Liste et gestion
- Liste des services avec nom, description, prix, statut actif/inactif.
- Ajout / modification / désactivation / suppression.
- Services actifs disponibles dans le wizard de nouvelle réservation.
- Tarifs modifiables.

### États
- Actif.
- Inactif (non sélectionnable dans le wizard).

### Boutons
- `Nouveau service`
- `Modifier`
- `Désactiver`
- `Supprimer`

---

## 16. Liste noire / intervenants non autorisés

### Rôle métier
Référencence les prestataires/intervenants non autorisés sur le domaine Hahitantsoa. Alimente directement l’**Annexe 4** du contrat Hahitantsoa.

### Gestion
- Ajout : nom + note optionnelle.
- Modification.
- Désactivation (l’intervenant ne sort plus dans l’annexe mais reste en historique).
- Suppression (si jamais utilisé).

### Impact Annexe 4
- Seuls les intervenants **actifs** apparaissent dans l’Annexe 4.
- Le titre de l’Annexe 4 doit être **centré** dans le contrat.

### États
- Actif.
- Inactif.

### Boutons
- `Ajouter`
- `Modifier`
- `Désactiver`
- `Supprimer`

---

## 17. Documents

### Types de documents
- **Proforma** — estimation, ne confirme pas la réservation.
- **Facture** — exigible après règlement total.
- **Contrat Titan particulier** — `CONTRAT DE LOCATION DE MATERIELS EVENEMENTIELS « TITAN RENTAL »`.
- **Contrat Titan entreprise** — même titre avec bloc société.
- **Contrat Hahitantsoa particulier** — `CONTRAT DE LOCATION « HAHITANTSOA »`.
- **Contrat Hahitantsoa entreprise** — même titre avec bloc société.
- **Annexes Hahitantsoa** : règlement intérieur, plan de masse, prix de casse, liste noire.
- **Bon de livraison (BL)**, **Bon de sortie (BS)**, **Bon de retour (BR)**, **Reçu**, **Avenant**, **Facture de casse/remise en état**.

### Labels exacts à préserver
Les libellés suivants sont présents dans `DocumentPreview.tsx` et dans les tests ; ils ne doivent pas être modifiés sans décision explicite :

```
CONTRAT DE LOCATION DE MATERIELS EVENEMENTIELS « TITAN RENTAL »
CONTRAT DE LOCATION « HAHITANTSOA »
P R O F O R M A
F A C T U R E
```

### Aperçu document
- Rendu A4 dans la page avec fond blanc même en thème sombre (`styles.css` protège `.doc-preview` et `.contract-a4-page`).
- Filigrane logo, en-têtes Ergon, informations client, lignes, total, signatures.

### Génération mock
- `DocumentPreview.tsx` génère un aperçu React ; le PDF réel viendra du backend.
- La version exacte du template utilisé doit être conservée avec le document généré.

### Impression / export futur
- Bouton `Imprimer` utilisant la media query `@media print` de `styles.css`.
- Export PDF backend à venir.

### Numérotation
Format cible : `{SCOPE}-{DOC_TYPE}-{YYYY}-{SEQ:05d}`.
Exemples : `HAH-PF-2026-00001`, `TIT-FAC-2026-00001`.

---

## 18. Caisse / Paiements / Caution

### Paiement acompte
- Enregistrement du montant et du moyen (Espèces/MVola/Chèque/Virement).
- Génération d’un reçu numéroté.
- Mise à jour du statut du dossier.

### Solde
- Paiement du reste à payer.
- Affichage du RAP (Reste À Payer).
- Alertes J-30 (50% RAP) et J-10 (solde + caution).

### Caution
- Enregistrement du montant et du type.
- Statut : Conservée / Restituée / Partiellement retenue / Totalement retenue.
- Calcul automatique des montants retenus/remboursés.

### Restitution / Retenue
- Restitution après retour sans casse.
- Retenue partielle/totale après casse/retard.
- Imputation sur facture de casse.

### Imputation casse/perte
- Montant de la caution affecté aux lignes de casse.
- Différence à facturer si caution insuffisante.

### Historique
- Liste des paiements/reçus par dossier.
- Filtre par moyen/date/statut.

### MVola
- Statuts : PENDING, CONFIRMED, FAILED, CANCELLED, RECONCILED.
- Un paiement MVola n’est confirmé qu’après réconciliation officielle.
- Idempotence : un même événement ne génère pas deux reçus.

### Erreurs
- Montant supérieur au RAP.
- Moyen non autorisé.
- MVola non confirmé marqué comme reçu.
- Caution déjà restituée.

### Boutons
- `Enregistrer paiement`
- `Générer reçu`
- `Restituer caution`
- `Retenir caution`
- `Facturer différence`

---

## 19. Commercial / Ops

### Vue commerciale
- Pipeline des dossiers (prospect → proforma → contrat → confirmé).
- Actions rapides : relance, transformation prospect/client, envoi proforma.

### Pipeline (kanban)
- Colonnes : Prospect, Proforma, Contrat signé, Confirmé, En cours, Clôturé, Annulé.
- Cartes déplaçables uniquement si l’action métier le permet.

### Relances
- Liste des échéances et proformas expirants.
- Bouton « Relancer client » générant un rappel/toast.

### Transformation prospect/client
- Depuis la fiche prospect, bouton « Convertir en client ».
- Historique des rendez-vous conservé.

### Transitions vers dossier
- Depuis Commercial Ops, clic sur un dossier ouvre `#reservation-detail/{id}`.

---

## 20. Planning

### Vue calendrier
- Affichage semaine/mois/jour.
- Événements Hahitantsoa (teal) et locations Titan (indigo).
- Conflits visibles en overlay rouge.

### Réservation
- Clic sur un créneau pour créer une nouvelle réservation (pré-remplit dates).
- Clic sur un événement existant pour ouvrir le détail.

### Disponibilité
- Indicateur de disponibilité stock/personnel/local.
- Avertissement si conflit.

### Filtres
- Hahitantsoa / Titan / Tous.
- Statut.
- Ressource / article.

### Affichage des statuts
- Badges colorés + libellés (Proforma, Confirmé, En sortie, etc.).

---

## 21. Rapports

### Rapports opérationnels
- Dossiers par statut.
- Retards et retours à contrôler.
- Stock bas et ruptures.

### Rapports commerciaux
- CA par période/volet.
- Conversion prospect/client.
- Échéances et RAP.

### Rapports caisse
- Recettes/dépenses par session.
- Écarts de clôture.
- Paiements par moyen.

### Rapports stock
- Mouvements par article.
- Valorisation stock.
- Inventaire physique vs théorique.

### Export futur
- Export Excel/PDF (future).
- États vides explicites.
- Filtres par date, volet, statut.

---

## 22. Aide

### Contenu
- Aide utilisateur par écran.
- FAQ métier.
- Procédures : nouvelle réservation, sortie, retour, casse, caisse.
- Support interne.
- Raccourcis clavier.
- Consignes terrain (photos, signatures, silence, badges, portail).

### Navigation
- Accessible via `#help` dans la sidebar.
- Recherche simple dans la page.
- Liens vers les procédures pertinentes depuis les écrans (future).

---

## 23. États UX transversaux

| État | Affichage attendu | Action associée |
|------|-------------------|-----------------|
| **Loading mock** | Skeleton ou placeholder structurel stable ; texte « Chargement… » | Attendre, pas de blocage total |
| **Empty state** | Icône + message explicite + action utile (créer, importer, effacer filtres) | Selon contexte |
| **Erreur** | Message actionnable, cause probable, étape suivante safe | Retry, retour, support |
| **Validation** | Message proche du champ, bordure/icone explicite | Corriger le champ |
| **Confirmation** | Dialog nommant l’action, la cible, les conséquences | Confirmer/Annuler |
| **Succès toast** | Toast non bloquant, visible 3s | Continuer |
| **Warning** | Bannière/alerte amber, action recommandée | Vérifier |
| **Disabled avec raison** | Bouton grisé + tooltip ou texte expliquant pourquoi | Comprendre la condition |
| **No-op volontaire** | Action désactivée avec explication (ex. « Disponible depuis le tableau de bord ») | Retourner au dashboard |
| **Conflit métier** | Message rouge, détails du conflit, impossible de valider | Résoudre manuellement |
| **Indisponibilité stock** | Message + articles manquants + quantité disponible | Ajuster quantités |
| **Action irréversible** | Dialog fort, cible nommée, « Je comprends » explicite | Confirmer |

---

## 24. Matrice des boutons critiques

| Page | Bouton | Type d’action | Comportement mock actuel | Comportement cible final | État disabled éventuel | Risque métier | Test recommandé |
|------|--------|---------------|--------------------------|--------------------------|------------------------|---------------|-----------------|
| dashboard | Nouvelle réservation | Navigation | Active, ouvre `#reservation-new` | Idem | Jamais disabled | Aucun | Clic depuis dashboard |
| dashboard | Ouvrir le planning | Navigation | Active | Idem | — | Aucun | Clic planning |
| planning | Créer réservation | Navigation/Future | Placeholder / formulaire minimal | Pré-remplir dates depuis créneau | Si conflit | Double réservation | Clic créneau |
| reservation-new | Continuer | Wizard | Avance si conditions remplies | Idem | Si champ requis vide | Données incomplètes | Navigation étapes |
| reservation-new | Sauvegarder brouillon | Persistence | `localStorage` + alert | Toast + `localStorage` | — | Perte de saisie | Restauration draft |
| reservation-detail Titan | Valider sortie | Mutation | Toast succès | Bon de livraison + mouvement sortie | Si préparation non prête | Sortie sans contrôle | Sortie complète |
| reservation-detail Titan | Valider retour | Mutation | Toast + onglet casse | Mouvement retour + détection écart | Si sortie non faite | Retour sans sortie | Retour incomplet |
| reservation-detail Titan | Rembourser caution | Paiement | Toast | Paiement + reçu | Si caution déjà restituée | Double remboursement | Restitution partielle |
| reservation-detail Hahitantsoa | Générer contrat | Document | Aperçu React | PDF figé | Si proforma non généré | Contrat sans estimation | Aperçu multipage |
| inventory | Ajuster stock | Mutation | Formulaire local | Mouvement ajustement | Si mouvements en cours | Écrasement historique | Quantité négative |
| inventory-item | Désactiver article | Mutation | Toggle local | Statut inactif | Si article utilisé | Perte référentielle | Désactivation package |
| stock-movements | Filtrer | Read | Filtres en mémoire | Filtres URL/API | — | Aucun | Filtre type |
| stock-preparation | Marquer comme prêt | Mutation | Set state | Statut Prêt + notification | Si qté préparée < commandée | Préparation incomplète | Qté manquante |
| logistics-dispatch | Valider BL | Mutation | Toast | BL PDF + sortie | Si articles non préparés | BL sans préparation | Signature manquante |
| logistics-returns | Aller à Casse | Navigation | Onglet actif | Écran casse lié | — | Aucun | État retour cassé |
| breakage-loss | Retenir caution | Paiement | Calcul local | Transaction caution | Si caution < préjudice sans validation | Retenue non autorisée | Imputation casse |
| caution | Rembourser | Paiement | Toast | Paiement + reçu | Si statut != Conservée | Double remboursement | Remboursement total |
| packages | Nouveau Package | Création | Ajout liste mock | Création backend | — | Aucun | Création vide |
| packages | Enregistrer | Mutation | Toast info | Sauvegarde backend | — | Aucun | Modification prix |
| services | Désactiver | Mutation | Toast warning + toggle | Statut inactif | Si service utilisé | Service indisponible inattendu | Wizard filtre actif |
| blocked-intervenants | Désactiver | Mutation | Toast warning | Inactif + exclu Annexe 4 | — | Annexe 4 obsolète | Contrat Annexe 4 |
| commercial-ops | Convertir prospect | Mutation | Navigation future | Conversion CRM | Si prospect déjà client | Doublon client | Historique préservé |
| cashbox | Clôturer session | Mutation | Toast | Clôture avec écart | Si écart non justifié | Écart non expliqué | Comptage billets |
| reports | Exporter | Future | No-op / placeholder | Export PDF/Excel | Si pas de données | Export vide | État vide |
| help | Ouvrir procédure | Navigation | Onglet/ancre | Page procédure | — | Aucun | Recherche aide |
| clients/prospects cible 6G | Convertir en client | Mutation | Non implémenté | Conversion + historique | Si champs obligatoires manquants | Données incomplètes | Rendez-vous conservés |

---

## 25. Matrice des tests UX

| Parcours | Cas nominal | Cas erreur | Cas limite | Test manuel navigateur | Test automatisé recommandé |
|----------|-------------|------------|------------|------------------------|----------------------------|
| Nouvelle réservation client_first | Particulier → Hahitantsoa → location nue → proforma → acompte | Client non choisi, dates invalides | Acompte = 0, total = 0 | Wizard complet | `ReservationNewPage.test.tsx` |
| Nouvelle réservation domain_first | Titan → entreprise → matériels → livraison → caution | Stock insuffisant, adresse manquante | Caution seuil 200k | Wizard complet | Wizard steps + total |
| Parcours Hahitantsoa package | Package Standard 100 pax + articles complémentaires | Package inactif | Écart forfait/ articles | Sélection package | Calcul écart |
| Parcours Titan caution | Total > 200k → caution 50% | Total < 200k → 100k | Total exactement 200k | Détails Titan | Calcul caution |
| Génération documents | Proforma + contrat Hahitantsoa/Titan | Client sans adresse | Montant 0 | Aperçu document | Labels exacts (`DocumentPreview.test.tsx`) |
| Préparation stock | Marquer prêt avec qté = commandée | Qté préparée > commandée | Qté = 0 | Tableau préparation | Clamp quantité |
| Sortie / Livraison | Valider sortie avec photos + signature | Signature manquante | 0 article | Onglet sortie | Toast + état |
| Retour / Restitution | Retour complet bon état | Manquant + cassé | Retard > 0 | Onglet retour | Calcul retard |
| Casse & Perte | Retenue caution < préjudice | Caution déjà restituée | Préjudice = 0 | Onglet casse | Imputation |
| Caisse | Paiement espèces + reçu | Montant > RAP | Paiement partiel | Page caisse | Reçu généré |
| Clients & Prospects 6G | Créer particulier + CIN | Email invalide | Nom vide | Formulaire client | Conversion prospect |
| Packages | Ajouter URL image + composition | URL invalide | Prix 0 | Page packages | Image preview |
| Services | Désactiver service utilisé | Prix négatif | Nom vide | Page services | Filtre wizard |
| Liste noire | Désactiver intervenant | Nom vide | Doublon | Page liste noire | Annexe 4 centrée |
| Planning | Créer réservation depuis créneau | Conflit ressource | Créneau minuit | Vue calendrier | Filtres |

---

## 26. Gaps UX restants / arbitrages nécessaires

### Méthodologie de classement
Les écarts sont classés par priorité sans modifier l’UX validée existante.

### P0 — Bloquant pour la prochaine intégration
1. **Images packages** : le prototype mocké ne propose que l’URL. L’UX cible exige **explorateur de fichiers + URL**. À implémenter dans une future tâche frontend.
2. **Fiche client complète** : le wizard permet la saisie rapide, mais la fiche client dédiée (adresse complète, CIN, NIF, etc.) et l’agenda visiteurs ne sont pas finalisés. Cible 6G.
3. **Connexion API** : toutes les données restent mockées (`mockData.ts` + `localStorage`). L’UX cible suppose un backend Django/DRF ; cette mission ne l’aborde pas.

### P1 — Important
4. **Import Excel historique** : mentionné dans le Prototype 4 et Document A ; non intégré au prototype React actuel.
5. **Gestion des dépôts/emplacements** : Document A mentionne stock par dépôt/zone/rayon/rack ; le prototype React n’a qu’un stock global.
6. **MVola asynchrone** : statuts PENDING/CONFIRMED/FAILED doivent être visibles avant toute génération de reçu.
7. **Validation permission-aware** : le prototype ne gère pas encore le gating FE-A par rôle (tous les boutons sont visibles/activés).

### P2 — Amélioration
8. **Agenda visiteurs** : présent dans le Prototype 4 (`appointments`), absent du React actuel.
9. **Personnel & Paie** : présent dans le Prototype 4 (`hr`, `hr-payroll`) et Document A ; non implémenté.
10. **Achats & Fournisseurs** : idem.
11. **Notifications centralisées** : badge de notifications présent mais pas d’écran dédié.
12. **Export PDF/Excel** : boutons présents mais no-op.

### P3 — Confort
13. **Dark mode logos** : le contrat thème indique qu’il n’y a pas de variantes dark des logos ; à vérifier visuellement.
14. **Animations/transitions** : le prototype HTML a des animations fade ; le React actuel est plus sobre.
15. **Vue calendrier riche** : le planning actuel est une liste/agenda simple.

### Écarts spécifiques identifiés
| Source A/B / Guide | Prototype 4 / Frontend actuel | Écart | Priorité |
|--------------------|-------------------------------|-------|----------|
| Document A : Titan = matériels/articles/packs uniquement | Respecté | Aucun écart | — |
| Document A : stock par dépôt/zone/rayon/rack | Stock global mocké | Manque emplacement | P1 |
| Document A : import Excel historique | Non intégré | Manque | P1 |
| Guide v1.8 : permissions granulaires | Tous les boutons visibles | Manque gating rôle | P1 |
| Prototype 4 : `appointments` | Absent React | Agenda visiteurs manquant | P2 |
| Prototype 4 : `hr`, `procurement` | Absent React | Modules futurs | P2 |
| Brief 6F-R5 : image package via fichier + URL | Uniquement URL | UX future | P0 |

---

## 27. Recommandations pour prochaines étapes

1. **6G — Clients & Prospects** : finaliser la fiche client (particulier/entreprise), l’agenda visiteurs, la conversion prospect/client et la cohérence avec les contrats. C’est la suite logique car le wizard de réservation dépend déjà de la fiche client.
2. **Documents / Caisse / Rapports** : une fois les clients et le parcours réservation stabilisés, brancher la génération PDF backend, les paiements réels et les rapports.
3. **Reconnexion API progressive** : remplacer progressivement `mockData.ts` par les endpoints Django/DRF, en commençant par les données les plus stables (catalogue, clients, réservations).

> **Ne pas lancer ces étapes dans cette mission.** Ce document sert de référence UX pour les ordonnancer et les réaliser sans incohérence.

---

## Annexes

### A. Terminologie
- **RAP** : Reste À Payer.
- **MVola** : Moyen de paiement mobile (intégration future).
- **BL** : Bon de Livraison.
- **BS** : Bon de Sortie.
- **BR** : Bon de Retour.
- **Annexe 4** : Liste des intervenants non autorisés dans le contrat Hahitantsoa.

### B. Fichiers de référence frontend directement liés
- `frontend/src/App.tsx`
- `frontend/src/prototype/AppShell.tsx`
- `frontend/src/prototype/mockData.ts`
- `frontend/src/prototype/DocumentPreview.tsx`
- `frontend/src/prototype/ReservationNewPage.tsx`
- `frontend/src/prototype/ReservationDetailPage.tsx`
- `frontend/src/prototype/PackageBuilderPage.tsx`
- `frontend/src/prototype/ServicesPage.tsx`
- `frontend/src/prototype/BlacklistPage.tsx`
- `frontend/src/prototype/InventoryPage.tsx`
- `frontend/src/prototype/StockPreparationPage.tsx`
- `frontend/src/prototype/LogisticsDispatchPage.tsx`
- `frontend/src/prototype/LogisticsReturnsPage.tsx`
- `frontend/src/prototype/BreakageLossPage.tsx`
- `frontend/src/prototype/CautionPage.tsx`
- `frontend/src/styles.css`
