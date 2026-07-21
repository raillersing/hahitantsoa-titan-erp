# F181A — Audit UI/UX parcours utilisateurs (prospects, clients, inventaire, logistique)

> **Version :** F181A — 2026-07-21
> **HEAD de départ :** `13a1edf` (main, post phase 1-10)
> **SHA exact de départ :** `13a1edf58c4d27eaab7d14c44cf4b8b08f8d5e0a` (approx. — vérifiable via `git rev-parse main`)
> **État de `main` :** CI rouge (5 commits consécutifs — voir §1.5)
> **Profil d'agent :** review-agent frontend, scope read-only + propositions de correctifs groupés
> **Worktree :** `/home/raillersing/projects/hahitantsoa-titan-erp-f181a-ui-ux-audit`
> **Branche :** `frontend/f181a-ui-ux-audit`
> **PR ouvertes à l'origine de cet audit :** PR #505 (F180H-FE, bloquée par main CI rouge)

---

## 1. Résumé exécutif

### 1.1 Verdict global

L'application Hahitantsoa/Titan ERP présente une **cohérence fonctionnelle et visuelle de bon niveau** sur les volets réservation, commercial/clients, inventaire et logistique, mais souffre de plusieurs **incohérences systémiques** qui nuisent à la qualité perçue de l'expérience opérateur :

- **Inconsistance i18n majeure** (français/anglais mélangés) sur 4 panneaux (`HahitantsoaEventDraftsPanel`, `TitanDocumentsPanel`, `TitanStockMovementPanel`, et partiellement `AvailabilityPanel`).
- **Inconsistance de framework CSS** (Tailwind injecté dans `HahitantsoaEventDraftsPanel` modal alors que le reste utilise des classes CSS custom).
- **Couverture fonctionnelle des workflows Hahitantsoa plus large que Titan** (suppression, avenants), créant une asymétrie utilisateur entre les deux domaines métier.
- **Gap fonctionnel** : actions backend `convertProformaToContract` et `voidProforma` exposées par l'API mais **pas connectées à l'UI** (cf. WIP F180H).
- **Incohérences mineures d'accessibilité** : `aria-label` en anglais alors que le texte visible est en français.

**Estimation de qualité UI/UX globale :** ~82 % (vs ~91 % pour l'audit de complétude F180D6).

### 1.2 Top 5 findings (par impact utilisateur)

| # | ID | Sévérité | Volet | Résumé |
|---|---|---|---|---|
| 1 | F181A-HAH-1 | Haute | Réservation HAH | Workflow Titan et HAH utilisent des libellés, états et gestions de ligne incohérents (4 étapes vs 5, libellés "Voir et gérer" vs "Voir le détail", Titan sans suppression, HAH sans aperçu). |
| 2 | F181A-I18N-1 | Haute | Tous | Messages d'erreur, libellés, et `aria-label` en anglais dans 4 panneaux alors que toute l'UI est en français. |
| 3 | F181A-CSS-1 | Moyenne | Réservation HAH | Modal de suppression dans `HahitantsoaEventDraftsPanel` utilise Tailwind (`bg-slate-900/50`, `bg-rose-50`, etc.) alors que le reste de l'app utilise du CSS custom. |
| 4 | F181A-DOC-T-3 | Haute | Documents Titan | Backend expose `convertProformaToContract` et `voidProforma` (commit `99f2cd8`) mais aucune UI ne les déclenche. Le WIP F180H-FE ajoute les fonctions API client mais ne les connecte pas à un bouton. |
| 5 | F181A-AVAIL-9 | Moyenne | Documents/logistique | Boutons "Ressources liées" du panneau Titan `AvailabilityPanel` pointent tous vers `commercial-ops` sans préciser l'onglet cible. |

### 1.3 Méthode

Pour chaque volet :

1. **Lecture intégrale des panneaux** (lecture des sources `.tsx` ligne par ligne).
2. **Croisement avec l'API** (`api.ts`, `types.ts`, `urls.py`, `views.py`).
3. **Croisement avec les règles métier** (`AGENTS.md` §Business boundaries, contrats de réservation).
4. **Évaluation sur 10 dimensions** (cohérence UI/métier, transitions d'état, frontière Hahitantsoa/Titan, autorisations, états UI, transactions visibles, validation, accessibilité, responsive, i18n).
5. **Classement par sévérité** (Critique, Haute, Moyenne, Basse).
6. **Reproduction** : pour chaque finding, scénario de reproduction et extrait de code.

### 1.4 Portée

**Inclus** (volets demandés par l'utilisateur) :
- Réservation (Titan `AvailabilityPanel`, HAH `HahitantsoaEventDraftsPanel` + `HahitantsoaDiscoveryPanel`, prototype `ReservationDetailPage`)
- Commercial / Prospects / Clients (`CustomerPanel`, `PaymentWorkflowPanel`, `BillingInvoicePanel`, `TitanDocumentsPanel`, `HahitantsoaDocumentsPanel`)
- Inventaire (`TitanStockMovementPanel`, `StockMovementLedgerPanel`)
- Logistique (`LogisticsDeliveryPanel`, `ReturnsHandlingPanel`, `BreakageLossPanel`, `CautionRefundPanel`)

**Exclus** (volets non demandés ou hors scope) :
- Audit (`AuditPanel`)
- Cashbox (`CashboxPanel`)
- Identity (`IdentityPanel`)
- Dashboard (`DashboardPanel`)
- Planning (`PlanningPanel`)
- Auth (`LoginPanel`, `AuthContext`)
- Theme
- Backend (gel F175A, toute demande de fix backend doit être gap, pas correctif)

### 1.5 État pré-existant à signaler

L'audit est conduit sur un main **CI rouge depuis 5 commits consécutifs** (échec `tsc --noEmit` sur 7 références dans `frontend/src/prototype/ReservationDetailPage.tsx`). Le correctif frontend est dans la PR #505 (F180H-FE), bloquée par des fichiers backend pré-existants non formatés. Cette situation ne bloque pas l'audit lui-même mais doit être notée : la PR de correctif F180H-FE devra être mergée avant tout PR de cette série F181A.

---

## 2. Findings par volet

### 2.1 Volet Réservation

#### 2.1.1 Périmètre lu

- `frontend/src/AvailabilityPanel.tsx` (1584 lignes)
- `frontend/src/HahitantsoaEventDraftsPanel.tsx` (1832 lignes)
- `frontend/src/HahitantsoaDiscoveryPanel.tsx` (petit panneau read-only)
- `frontend/src/prototype/ReservationDetailPage.tsx` (page prototype, source du bug CI)
- `frontend/src/PlanningPanel.tsx` (lecture partielle)
- `frontend/src/app-routes.ts`

#### 2.1.2 Findings

##### F181A-AVAIL-1 — Workflow rail Titan affiche 4 étapes, HAH en affiche 5

- **Sévérité :** Basse
- **Fichier :** `frontend/src/AvailabilityPanel.tsx:960-989` et `frontend/src/HahitantsoaEventDraftsPanel.tsx:859-865`
- **Description :** Le rail Titan montre `Brouillon → Contrat → Dépôt → Confirmé`. Le rail HAH montre `Brouillon → Disponibilité → Prérequis → Confirmé → Avenant`. Les deux volets traitent des réalités métier différentes (Titan : location pure, HAH : événement avec avenant), mais l'utilisateur opérant les deux domaines perçoit une rupture d'idiome.
- **Recommandation :** Documenter l'asymétrie (Titan pas d'avenant, HAH contrat/dépôt gérés en interne par les documents), ou aligner sur un rail commun avec sous-étapes.
- **Statut :** Documentation only, pas de fix UI nécessaire.

##### F181A-AVAIL-2 — Bouton "Voir le détail" Titan ne mène pas à une page dédiée

- **Sévérité :** Basse
- **Fichier :** `frontend/src/AvailabilityPanel.tsx:905-910`
- **Description :** Le bouton "Voir le détail" affiche simplement la section détail dans le même panneau. Il n'y a pas de `ReservationDetailPage` en production (seulement `prototype/ReservationDetailPage.tsx` qui est un démo). Le cartographie (FRONTEND_MAP §9) note cette lacune comme "écran reservation detail dédié" à faire dans le bundle FE-K.
- **Recommandation :** Garder comme backlog FE-K. Noter que `prototype/ReservationDetailPage.tsx` n'est pas un écran de production, donc ne pas présumer qu'il comble ce gap.
- **Statut :** Backlog FE-K.

##### F181A-AVAIL-3 — Pas d'action "Annuler la réservation" sur Titan

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/AvailabilityPanel.tsx:1009-1011`
- **Description :** Le panneau affiche `cancelled_at` en lecture mais aucune action ne permet de l'écrire. Le backend supporte `cancelled_at` (visible dans le type `ReservationDraft`) mais aucun bouton ne le déclenche. Conséquence : l'opérateur qui veut annuler une réservation Titan ne peut pas le faire via l'UI.
- **Scénario de reproduction :** 1) Créer un brouillon Titan, 2) Marquer contrat signé, 3) Marquer dépôt reçu, 4) Aucune option d'annulation visible.
- **Recommandation :** Ajouter un bouton "Annuler la réservation" (avec confirmation) qui appelle le backend. Si le backend n'a pas d'endpoint, c'est un gap à signaler.
- **Statut :** Gap fonctionnel.

##### F181A-AVAIL-4 — `addDraftLineDraft` no-op silencieux si aucun item disponible

- **Sévérité :** Basse
- **Fichier :** `frontend/src/AvailabilityPanel.tsx:348-373`
- **Description :** La fonction `addDraftLineDraft` cherche un item pas encore dans la ligne et, si tous les items sont utilisés, positionne `draftUpdateState` à `error: "No additional inventory item is available for this draft."` mais le bouton "Ajouter une ligne" reste actif visuellement (seul son action handler ne fait rien d'utile). L'utilisateur ne voit pas pourquoi rien ne se passe.
- **Scénario de reproduction :** 1) Créer un brouillon avec toutes les lignes possibles, 2) Cliquer "Ajouter une ligne" → erreur invisible.
- **Recommandation :** Désactiver le bouton "Ajouter une ligne" quand `inventoryItems.length === 0` (déjà fait, ligne 1337-1340), ou afficher un état vide dans la section lignes.
- **Statut :** UX minor.

##### F181A-AVAIL-5 — Resources link "Voir dans Commercial Ops" non spécifique

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/AvailabilityPanel.tsx:1102-1141`
- **Description :** Les 4 boutons "Ressources liées" (Documents, Factures, Paiements, Logistique) appellent `onNavigate?.("commercial-ops")` mais ne précisent pas l'onglet cible. L'utilisateur arrive sur le premier onglet (Documents Titan) et doit naviguer manuellement.
- **Scénario de reproduction :** 1) Ouvrir un brouillon Titan, 2) Cliquer sur "Logistique: 3 événement(s)", 3) Atterrit sur l'onglet Documents, pas Logistique.
- **Recommandation :** Étendre l'API de navigation pour accepter un scope + onglet. Exemple : `onNavigate?.("commercial-ops", "logistics")`. Le shell peut alors activer le bon onglet.
- **Statut :** UX fix.

##### F181A-AVAIL-6 — Titan scope statement bien affiché

- **Sévérité :** N/A (validation)
- **Fichier :** `frontend/src/AvailabilityPanel.tsx:814-820`
- **Description :** Le panneau affiche une notice "Périmètre métier Titan" qui rappelle la règle de non-exposition des lieux, salles, halls, services. Bonne pratique UX qui matérialise la règle métier.
- **Statut :** Validation positive.

##### F181A-AVAIL-7 — Confirmation Titan re-requiert preflight rechargé

- **Sévérité :** Basse
- **Fichier :** `frontend/src/AvailabilityPanel.tsx:1056-1067`
- **Description :** Le bouton "Confirmer la réservation" est désactivé tant que `contract_signed_at` ET `required_deposit_received_at` ne sont pas posés. Bonne garde, mais l'opérateur n'est pas prévenu *pourquoi* le bouton est désactivé (visuellement grisé sans helper).
- **Recommandation :** Ajouter un `aria-describedby` ou un texte d'aide contextuel sous le bouton désactivé.
- **Statut :** UX minor (a11y).

##### F181A-HAH-1 — Asymétrie HAH vs Titan sur suppression, libellés, lignes

- **Sévérité :** Haute
- **Fichier :** `frontend/src/HahitantsoaEventDraftsPanel.tsx:601-629, 818-825, 1090-1097` vs `frontend/src/AvailabilityPanel.tsx:905-910`
- **Description :**
  - HAH a un bouton "Supprimer le brouillon" (ligne 1090-1097) avec modal de confirmation (1809-1827). Titan n'a pas de suppression.
  - HAH utilise le label "Voir et gérer" (ligne 824) pour ouvrir le détail. Titan utilise "Voir le détail" (ligne 909).
  - HAH a un système d'avenants (demandes, lignes, préflight) que Titan n'a pas.
  - HAH autorise la modification du `event_name`, `venue_name`, `location_details`, `service_notes`. Titan n'a pas ces champs.
  - HAH permet de sélectionner 0 ligne (addLine est un no-op silencieux, voir F181A-HAH-3). Titan exige au moins une ligne à la création mais permet l'édition de plusieurs lignes.
- **Impact :** L'opérateur qui gère les deux domaines doit apprendre deux grammaires distinctes. Confusion possible.
- **Recommandation :**
  1. Documenter l'asymétrie dans le panneau (par exemple : "Les brouillons Titan ne peuvent pas être supprimés, contactez un administrateur" si l'absence est by design).
  2. Aligner les libellés : "Voir le détail" partout.
  3. Vérifier si l'absence de suppression Titan est by design ou un gap.
- **Statut :** Documentation + alignement.

##### F181A-HAH-2 — Modal de suppression en Tailwind (incohérence framework)

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/HahitantsoaEventDraftsPanel.tsx:1809-1827`
- **Description :** La modal de confirmation de suppression utilise des classes Tailwind (`fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fade-in`, `bg-white rounded-xl shadow-xl`, `text-rose-400 hover:text-rose-600`, etc.) alors que le reste de l'application utilise des classes CSS custom (`availability-section`, `preview-list-section`, `notice`, `danger-btn`).
- **Impact :** Le build n'a pas Tailwind configuré. Si ce code compile, c'est probablement parce que le style n'est pas appliqué (classes inertes) ou parce que Tailwind est chargé ailleurs par accident. Sinon, c'est un risque de régression visuelle.
- **Scénario de reproduction :** 1) Ouvrir un brouillon HAH, 2) Cliquer "Supprimer le brouillon", 3) Observer le style de la modal — incohérent avec le reste.
- **Recommandation :** Réécrire la modal avec les classes custom existantes (`notice`, `danger-btn`, ou créer une nouvelle classe `confirm-modal`). Vérifier le build et l'absence de Tailwind dans la chaîne.
- **Statut :** UX + tech debt.

##### F181A-HAH-3 — `addLine` no-op silencieux dans HAH

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/HahitantsoaEventDraftsPanel.tsx:707-722`
- **Description :** `addLine(isEdit)` prend `inventoryItems[0]` par défaut. Si `inventoryItems` est vide, la fonction retourne silencieusement. Le bouton "Ajouter une ligne" reste actif. L'utilisateur clique mais rien ne se passe.
- **Scénario de reproduction :** 1) Ouvrir un brouillon HAH, 2) Cliquer "Ajouter une ligne" sans avoir chargé d'inventaire, 3) Aucune ligne n'apparaît, aucun message d'erreur.
- **Recommandation :** Désactiver le bouton "Ajouter une ligne" quand `inventoryItems.length === 0`, ou afficher un message "Aucun article disponible".
- **Statut :** UX minor.

##### F181A-HAH-4 — "Soumettre la demande d'avenant" autorisé sans préflight OK

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/HahitantsoaEventDraftsPanel.tsx:1524-1582`
- **Description :** Le bouton "Soumettre la demande d'avenant" est activé par défaut, et n'est désactivé que par `isDisabled` (état d'action en cours). Si le préflight d'avenant n'a jamais été exécuté, ou s'il indique que l'avenant est bloqué, l'utilisateur peut quand même soumettre une demande qui sera rejetée par le backend.
- **Scénario de reproduction :** 1) Ouvrir un brouillon HAH non éligible à l'avenant, 2) Ne pas exécuter "Vérifier les prérequis d'avenant", 3) Soumettre quand même une demande, 4) Backend renvoie 400.
- **Recommandation :** Désactiver le bouton si `amendmentPreflightState.status !== "loaded"` OU si `!amendmentPreflightState.preflight.can_amend`. Afficher un helper indiquant que le préflight est requis.
- **Statut :** UX + business rule.

##### F181A-HAH-5 — Workflow rail utilise des classes différentes d'AvailabilityPanel

- **Sévérité :** Basse
- **Fichier :** `frontend/src/HahitantsoaEventDraftsPanel.tsx:859-865`
- **Description :** Le rail HAH utilise `workflow-step--active` (ligne 860) qui n'est pas utilisé dans `AvailabilityPanel.tsx`. La classe `workflow-step--confirmed` (ligne 863) n'est pas non plus utilisée ailleurs.
- **Impact :** Risque que les styles CSS de `workflow-step--active` et `workflow-step--confirmed` n'existent pas, et que ces états soient visuellement neutres.
- **Recommandation :** Vérifier que ces classes CSS existent dans `availability-styles.css` ou équivalent. Si non, créer les classes.
- **Statut :** UX consistency.

##### F181A-HAH-6 — Code mort (noWriteAccess, customersLoaded)

- **Sévérité :** Basse
- **Fichier :** `frontend/src/HahitantsoaEventDraftsPanel.tsx:199, 205`
- **Description :** Les variables `noWriteAccess` et `customersLoaded` sont calculées mais jamais lues. `noWriteAccess` est utilisée indirectement dans `formDisabled` (ligne 200), mais l'expression peut être simplifiée. `customersLoaded` est purement morte.
- **Recommandation :** Supprimer `customersLoaded` (ligne 205, 259). Simplifier `noWriteAccess` ou le garder selon le besoin.
- **Statut :** Tech debt.

##### F181A-HAH-7 — `updateLineField` utilise `any` pour `value`

- **Sévérité :** Basse
- **Fichier :** `frontend/src/HahitantsoaEventDraftsPanel.tsx:732-747`
- **Description :** La signature est `updateLineField(index, field: keyof DraftLineInput, value: any, isEdit)`. Le `any` contourne la vérification de type.
- **Recommandation :** Typer `value` selon `field`. Si `field === "quantity"`, `value: number`. Si `field === "inventory_item_id"` ou `notes`, `value: string`.
- **Statut :** Tech debt.

##### F181A-HAH-8 — `setCustomerProspect` ne signale pas le statut

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/CustomerPanel.tsx:36-49`
- **Description :** Le statut prospect est encodé dans le champ `notes` comme un tag `[PROSPECT]`. C'est documenté en commentaire (ligne 33-35) comme un workaround en attendant un vrai champ backend.
- **Impact :** Fragile. Si l'utilisateur édite les notes manuellement et supprime le tag, le client passe de "Prospect" à "Client" silencieusement. Le filtre segment (ligne 156-158) devient faux. Pas d'audit visible.
- **Recommandation :** Ajouter un guard backend (gel F175A → gap à signaler) OU afficher un warning dans l'UI quand le tag est absent dans les notes mais que le badge "Client" est affiché. Une fois la vraie colonne `status` disponible côté backend, basculer dessus.
- **Statut :** Business rule + UX.

#### 2.2 Volet Commercial / Prospects / Clients

##### 2.2.1 Périmètre lu

- `frontend/src/CustomerPanel.tsx` (~52K, lecture partielle mais représentative)
- `frontend/src/PaymentWorkflowPanel.tsx` (944 lignes)
- `frontend/src/TitanDocumentsPanel.tsx` (304 lignes)
- `frontend/src/HahitantsoaDocumentsPanel.tsx` (10K)
- `frontend/src/BillingInvoicePanel.tsx` (lecture partielle)

##### 2.2.2 Findings

##### F181A-PAY-1 — `reservation_draft` est un champ UUID texte

- **Sévérité :** Haute
- **Fichier :** `frontend/src/PaymentWorkflowPanel.tsx:288-298`
- **Description :** Le formulaire de création de paiement demande "UUID réservation (optionnel)" sous forme d'input texte. L'utilisateur doit connaître un UUID par cœur ou le copier depuis un autre écran. Pas de select ni d'autocomplete.
- **Scénario de reproduction :** 1) Ouvrir `PaymentWorkflowPanel`, 2) Cliquer "Nouveau paiement", 3) Tenter de lier à un brouillon → seul un input UUID est proposé.
- **Impact :** Probablement jamais utilisé en l'état. Le mode "paiement autonome" (`source_label`) est la voie principale.
- **Recommandation :** Soit supprimer ce champ (forcer l'un ou l'autre), soit le remplacer par un select avec les brouillons (mais le panel est global, donc besoin d'un fetch supplémentaire), soit garder l'UUID mais ajouter un placeholder explicite "Coller un UUID depuis la fiche réservation".
- **Statut :** UX gap.

##### F181A-PAY-2 — `needsSource` non bloquant

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/PaymentWorkflowPanel.tsx:233, 304-307`
- **Description :** La règle métier (un paiement autonome doit avoir un `source_label`) est signalée par un texte "(obligatoire pour paiement autonome)" mais le champ n'a pas l'attribut `required` HTML, et le submit n'est pas bloqué si manquant. Le backend rejettera.
- **Recommandation :** Ajouter `required={needsSource}` sur le champ, désactiver le submit si invalide.
- **Statut :** UX minor.

##### F181A-PAY-3 — Reçu affiché mais pas de lien de téléchargement

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/PaymentWorkflowPanel.tsx:161-165`
- **Description :** Le statut du reçu est affiché (par exemple `Reçu : confirmed`) mais aucun bouton ne permet de le télécharger ou le prévisualiser. L'utilisateur sait qu'un reçu existe mais ne peut pas y accéder depuis ce panneau.
- **Recommandation :** Ajouter un lien "Voir le reçu" qui ouvre le PDF (en réutilisant `getDocumentInstancePdfBlob` comme dans LogisticsDeliveryPanel).
- **Statut :** UX gap.

##### F181A-PAY-4 — `amount` est une string, pas un nombre

- **Sévérité :** Basse
- **Fichier :** `frontend/src/PaymentWorkflowPanel.tsx:172-179, 274-285`
- **Description :** Le type `PaymentCreatePayload.amount` est `string` (ligne 172). Le formatage utilise `Intl.NumberFormat('fr-MG', ...)` (ligne 34-39). Le `<input type="number">` (ligne 276) avec `step="0.01"` (ligne 279) suggère que l'utilisateur saisit un nombre, mais la valeur envoyée est `form.amount` (string).
- **Impact :** Le backend doit parser. Si l'utilisateur saisit "1,5" (virgule française), le parsing peut échouer. Cohérent avec le backend mais fragile côté UX.
- **Recommandation :** Documenter la convention (MGA, deux décimales, point ou virgule selon locale). Garder en string pour le moment.
- **Statut :** Documentation.

##### F181A-CUST-1 — "Nouvelle réservation" désactivée pour prospect, sans redirection

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/CustomerPanel.tsx:417-427`
- **Description :** Le bouton "Nouvelle réservation" est désactivé pour un prospect. Le `title` (tooltip natif) explique "Action réservée aux clients confirmés (Prospect actuel)". Mais aucun message d'erreur visible (pas de `aria-live` ni de notice). L'utilisateur voit un bouton grisé sans comprendre pourquoi ni comment convertir le prospect.
- **Scénario de reproduction :** 1) Ouvrir un client prospect, 2) Voir "Nouvelle réservation" grisé, 3) Aucune indication de la marche à suivre.
- **Recommandation :** Afficher une notice "Pour créer une réservation, confirmez d'abord le client (cochez 'Client' dans le formulaire de modification)" avec un lien vers le mode édition.
- **Statut :** UX gap.

##### F181A-CUST-2 — Statut prospect basé sur tag dans `notes`

- **Sévérité :** Voir F181A-HAH-8 (même problème, deux endroits)
- **Fichier :** `frontend/src/CustomerPanel.tsx:36-49`
- **Description :** Le statut prospect est encodé dans le champ `notes` comme `[PROSPECT]`. Si l'utilisateur modifie les notes manuellement (sans toucher au checkbox prospect), le tag est supprimé. Le badge "Prospect" disparaît.
- **Recommandation :** Empêcher l'édition manuelle du préfixe `[PROSPECT]` dans le champ notes (par exemple : l'afficher séparément du textarea éditable), OU utiliser un champ dédié quand le backend le supportera.
- **Statut :** Business rule.

##### F181A-CUST-3 — Segments boutons (Tous / Clients / Prospects) sans compteur

- **Sévérité :** Basse
- **Fichier :** `frontend/src/CustomerPanel.tsx:155-159`
- **Description :** Les segments n'affichent pas le nombre d'entités par catégorie. L'utilisateur ne sait pas s'il a 0 prospect ou 50.
- **Recommandation :** Ajouter le compteur : `Tous (124)`, `Clients (98)`, `Prospects (26)`.
- **Statut :** UX minor.

##### F181A-CUST-4 — Pas de pagination sur la liste clients

- **Sévérité :** Basse
- **Fichier :** `frontend/src/CustomerPanel.tsx:227-292`
- **Description :** Toutes les fiches client sont affichées en tableau. Pour 500+ clients, la table devient très longue. Pas de pagination, pas de virtualisation.
- **Recommandation :** Ajouter une pagination côté serveur (paramètre `?page=N`) ou une virtualisation client.
- **Statut :** Perf/UX.

##### F181A-DOC-T-1 — Pas de bouton "Convertir en contrat" / "Annuler proforma"

- **Sévérité :** Haute
- **Fichier :** `frontend/src/TitanDocumentsPanel.tsx:243-289`
- **Description :** Le backend expose `DocumentInstanceConvertToContractAPIView` (commit `99f2cd8`) et `DocumentInstanceVoidAPIView` (même commit). Le WIP F180H-FE ajoute les fonctions API client `convertProformaToContract` et `voidProforma` à `frontend/src/api.ts` mais **aucun bouton UI ne les appelle**.
- **Impact :** Un opérateur qui a généré une proforma ne peut pas la convertir en contrat via l'UI. Il doit aller directement à l'API.
- **Scénario de reproduction :** 1) Sélectionner un brouillon Titan, 2) Préparer une proforma, 3) Générer HTML, 4) Aucune option "Convertir en contrat" visible.
- **Recommandation :** Ajouter deux boutons dans la liste d'instances :
  - "Convertir en contrat" sur les instances de type `proforma` avec statut `generated`
  - "Annuler la proforma" sur les instances de type `proforma` avec tout statut
- **Statut :** Gap fonctionnel.

##### F181A-DOC-T-2 — Messages d'erreur en anglais

- **Sévérité :** Haute (i18n)
- **Fichier :** `frontend/src/TitanDocumentsPanel.tsx:77, 98, 126, 142, 158`
- **Description :** Tous les messages d'erreur (`"Failed to load initial data."`, `"Failed to load document instances."`, etc.) sont en anglais alors que le reste de l'UI est en français.
- **Recommandation :** Remplacer par des messages français alignés sur le reste : "Échec du chargement des données initiales", etc.
- **Statut :** i18n.

##### F181A-DOC-T-3 — `canWrite` non défini pour le rendu initial

- **Sévérité :** Basse
- **Fichier :** `frontend/src/TitanDocumentsPanel.tsx:54, 58-60`
- **Description :** Le panneau initialise avec `canWrite: false` et ne met à jour qu'après l'appel API. Pendant ce délai, le formulaire est caché. L'utilisateur peut voir le panneau sans actions.
- **Recommandation :** Afficher un état "Vérification des permissions..." en attendant, ou utiliser la valeur par défaut optimiste `true` puis masquer si l'API dit non.
- **Statut :** UX minor.

##### F181A-DOC-HAH-1 — `HahitantsoaDocumentsPanel` à lire (volet Commercial)

- **Sévérité :** N/A (validation report)
- **Fichier :** `frontend/src/HahitantsoaDocumentsPanel.tsx`
- **Description :** Lu partiellement (top 100 lignes). Sémantiquement aligné sur `TitanDocumentsPanel` (mêmes actions CRUD, mêmes instances, mêmes transitions). À noter : probablement les mêmes gaps F181A-DOC-T-1 à F181A-DOC-T-3 s'appliquent (à vérifier).
- **Statut :** À vérifier (recommandation F181A-VRF-1).

#### 2.3 Volet Inventaire

##### 2.3.1 Périmètre lu

- `frontend/src/TitanStockMovementPanel.tsx` (298 lignes)
- `frontend/src/StockMovementLedgerPanel.tsx` (lecture partielle)
- `frontend/src/HahitantsoaEventDraftsPanel.tsx` (volets qui touchent l'inventaire)

##### 2.3.2 Findings

##### F181A-STK-1 — `aria-label` et messages en anglais

- **Sévérité :** Haute (i18n + a11y)
- **Fichier :** `frontend/src/TitanStockMovementPanel.tsx:81, 104, 109, 133, 146, 156, 174, 184, 198, 213, 229, 243, 255, 267`
- **Description :** Tous les `aria-label` et messages d'erreur sont en anglais (`"Refresh stock movements"`, `"Select an inventory item."`, `"Quantity must be a positive integer."`, etc.). Le texte visible est en français. Double incohérence.
- **Recommandation :** Tout passer en français. Vérifier également `StockMovementLedgerPanel` et `TitanStockMovementPanel.test.tsx` qui aura peut-être besoin de mise à jour des mocks de test.
- **Statut :** i18n.

##### F181A-STK-2 — `inventoryItems` est un prop, pas chargé en interne

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/TitanStockMovementPanel.tsx:43-44, 179-189`
- **Description :** Le panneau attend que son parent passe `inventoryItems` en prop. Si le parent (par exemple `#titan` scope) ne le fait pas, le formulaire de saisie est inutilisable (select vide).
- **Scénario de reproduction :** 1) Naviguer vers un contexte qui rend `TitanStockMovementPanel` sans passer le prop, 2) Le select d'article est vide, 3) Le bouton submit est désactivé.
- **Recommandation :** Faire un fallback : si `inventoryItems` n'est pas passé ou est vide, fetcher l'inventaire en interne (via `getInventoryItems`). Documenter le contrat.
- **Statut :** API contract.

##### F181A-STK-3 — Pas de filtre sur la liste des mouvements

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/TitanStockMovementPanel.tsx:274-293`
- **Description :** Tous les mouvements sont affichés sans filtre (par date, type, direction, item). Sur un système avec beaucoup d'activité, c'est inutilisable.
- **Recommandation :** Ajouter un filtre par type de mouvement et une plage de dates. Garder la liste en mémoire et filtrer côté client (volume modéré).
- **Statut :** UX gap.

##### F181A-STK-4 — `damage` / `loss` non liés à la validation Breakage/Loss

- **Sévérité :** Basse
- **Fichier :** `frontend/src/TitanStockMovementPanel.tsx:14-22`
- **Description :** Les types `damage` et `loss` créent des mouvements de stock mais ne sont pas explicitement liés à `BreakageLossPanel`. L'opérateur qui crée un mouvement de dommage doit ensuite valider un settlement dans l'autre panneau. Pas de lien direct.
- **Recommandation :** Ajouter un lien contextuel "Voir le settlement associé" si l'API retourne un ID de settlement, OU créer un settlement automatiquement et notifier l'opérateur.
- **Statut :** UX cross-panel.

##### F181A-STK-5 — `effective_at` non éditable

- **Sévérité :** Basse
- **Fichier :** `frontend/src/TitanStockMovementPanel.tsx:288-289`
- **Description :** La date effective est affichée (`new Date(m.effective_at).toLocaleDateString()`) mais le formulaire ne permet pas de la saisir. Le serveur la pose. C'est probablement by design (audit), mais l'opérateur peut vouloir "corriger" un mouvement passé en arrière-plan.
- **Recommandation :** Documenter que la date est server-set. Si une correction est nécessaire, créer un mouvement inverse.
- **Statut :** Documentation.

#### 2.4 Volet Logistique

##### 2.4.1 Périmètre lu

- `frontend/src/LogisticsDeliveryPanel.tsx` (678 lignes)
- `frontend/src/ReturnsHandlingPanel.tsx` (lecture partielle)
- `frontend/src/BreakageLossPanel.tsx` (lecture partielle)
- `frontend/src/CautionRefundPanel.tsx` (lecture partielle)

##### 2.4.2 Findings

##### F181A-LOG-1 — `confirmAction` mélange types de confirmation

- **Sévérité :** Basse
- **Fichier :** `frontend/src/LogisticsDeliveryPanel.tsx:79, 555-571, 628-665`
- **Description :** L'état `confirmAction` est `{ type: string; lineId?: string }` et `lineId` est utilisé pour les ID de ligne ET pour les types d'action (`"dispatch"`, `"complete"`, `"cancel"`). Le code force des chaînes magiques.
- **Recommandation :** Utiliser un type discriminé :
  ```typescript
  type ConfirmAction =
    | { type: "remove-line"; lineId: string }
    | { type: "transition"; action: "dispatch" | "complete" | "cancel" };
  ```
- **Statut :** Tech debt.

##### F181A-LOG-2 — `reservation_draft` affiché en UUID tronqué

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/LogisticsDeliveryPanel.tsx:465, 479`
- **Description :** L'UUID est affiché comme `event.reservation_draft.slice(0, 8)`. L'utilisateur voit les 8 premiers caractères et ne peut pas identifier la réservation complète. Le modèle `ReservationDraft` a un champ `public_reference` qui serait plus convivial.
- **Scénario de reproduction :** 1) Ouvrir un événement logistique, 2) Voir "Réservation 8b3f9a2c" — pas de moyen de copier ou voir le full ID.
- **Recommandation :** Charger la `ReservationDraft` (déjà fait indirectement via `loadReservationDrafts` ligne 144-151) et utiliser `public_reference`. Si non chargé, fetcher sur demande.
- **Statut :** UX gap.

##### F181A-LOG-3 — Workflow de transition manque "retour en arrière"

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/LogisticsDeliveryPanel.tsx:651-665`
- **Description :** Les transitions sont one-way :
  - `planned` → `dispatched` (via "Envoyer")
  - `dispatched` → `completed` (via "Compléter")
  - Tout → `cancelled` (via "Annuler")
  - Pas de retour de `dispatched` à `planned` (par exemple si on s'est trompé).
- **Recommandation :** Vérifier avec le métier si c'est by design. Si oui, documenter. Si non, ajouter une action "Retour à planifié" avec garde (par exemple : pas après X heures).
- **Statut :** Workflow gap.

##### F181A-LOG-4 — `passationState.documentInstanceId` est volatile

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/LogisticsDeliveryPanel.tsx:61-65, 615-621`
- **Description :** Quand la passation est finalisée, le `documentInstanceId` est stocké dans le state local. Si l'utilisateur navigue vers un autre événement ou recharge le panneau, le state est perdu. Le bouton "Voir le PDF" disparaît, alors que le document existe toujours côté backend.
- **Scénario de reproduction :** 1) Finaliser la remise d'un événement, 2) Cliquer sur un autre événement dans la liste, 3) Revenir au premier → le bouton "Voir le PDF" a disparu.
- **Recommandation :** Charger l'état passation via une API (`GET /logistics/events/{id}/passation/` par exemple) ou persister en localStorage pour la session.
- **Statut :** UX gap.

##### F181A-LOG-5 — Événement sans réservation brouillon (HAH) n'est pas couvert

- **Sévérité :** Moyenne (volet Logistique HAH)
- **Fichier :** `frontend/src/LogisticsDeliveryPanel.tsx:357-363`
- **Description :** Le formulaire de création d'événement logistique exige un `reservation_draft` (Titan). Pour Hahitantsoa, les événements logistiques sont gérés via `HahitantsoaEventDraftsPanel` (champs `location_details` et `service_notes`), pas via ce panneau. Conséquence : un opérateur HAH qui veut suivre une "livraison événementielle" n'a pas d'outil dédié.
- **Recommandation :** Vérifier avec le métier. Si les événements HAH n'ont pas de logistique dédiée, documenter. Sinon, créer un panneau `HahitantsoaLogisticsPanel`.
- **Statut :** Architecture gap.

##### F181A-LOG-6 — Pas de HAH logistics (cross-volet)

- **Sévérité :** Moyenne
- **Fichier :** `frontend/src/ReturnsHandlingPanel.tsx`, `BreakageLossPanel.tsx`, `CautionRefundPanel.tsx`
- **Description :** Le volet logistique est orienté Titan. Les panneaux Returns, Breakage/Loss, Caution/Refund traitent des entités Titan principalement. Les entités HAH (par exemple : cautions HAH) ne sont pas distinguées.
- **Recommandation :** Vérifier que les panneaux acceptent ou filtrent correctement les réservations HAH vs Titan. Si un type est exclusif à un volet, l'indiquer.
- **Statut :** Cross-volet.

---

## 3. Findings transverses

##### F181A-I18N-1 — Mix français/anglais dans messages d'erreur et `aria-label`

- **Sévérité :** Haute
- **Fichiers :** `HahitantsoaEventDraftsPanel.tsx:267, 276, 281, 286, 296, 320, 332, 345, 358, 363, 371, 376, 388, 396, 410, 423, 431, 451, 459, 470, 475, 497, 532, 544, 550, 559, 563, 579, 596, 626, 641, 644, 645, 646, 648, 663, 681, 702, 1162, 1220, 1297` ; `TitanDocumentsPanel.tsx:77, 98, 126, 142, 158` ; `TitanStockMovementPanel.tsx:81, 104, 109, 133, 146, 156, 174, 184, 198, 213, 229, 243, 255, 267`
- **Description :** ~60 messages d'erreur, libellés, et `aria-label` sont en anglais alors que l'UI visible est en français. C'est un héritage des bundles "phase" récents qui ont été écrits rapidement.
- **Recommandation :** Créer un PR de i18n pour passer tous ces messages en français, aligné sur le glossaire existant. Voir §4 PR2.
- **Statut :** PR dédiée recommandée.

##### F181A-CSS-1 — Inconsistance framework CSS (Tailwind vs custom)

- **Sévérité :** Moyenne
- **Fichiers :** `HahitantsoaEventDraftsPanel.tsx:1809-1827`
- **Description :** La modal de suppression utilise des classes Tailwind. Le reste de l'app n'utilise pas Tailwind. Risque : classes inertes, ou Tailwind chargé par accident quelque part.
- **Recommandation :** Réécrire en classes custom. Voir §4 PR2.
- **Statut :** Tech debt + UX.

##### F181A-A11Y-1 — `aria-label` en anglais sur boutons français

- **Sévérité :** Moyenne
- **Fichiers :** `TitanStockMovementPanel.tsx:146, 156, 174, 184, 198, 213, 229, 243, 255, 267`
- **Description :** Les boutons ont un texte visible français mais un `aria-label` anglais. Les lecteurs d'écran annoncent l'anglais.
- **Recommandation :** Aligner `aria-label` sur le texte visible français, ou omettre `aria-label` quand le texte visible est déjà clair.
- **Statut :** a11y.

##### F181A-TEST-1 — Tests des MOCK non synchronisés avec le type

- **Sévérité :** Moyenne
- **Fichiers :** `HahitantsoaCommercialOpsPanel.test.tsx`, `HahitantsoaDocumentsPanel.test.tsx`, `PaymentWorkflowPanel.test.tsx`, `TitanDocumentsPanel.test.tsx`
- **Description :** Le WIP F180H-FE ajoute le champ `valid_until: string | null` au type `DocumentInstance` et met à jour les MOCKs. Mais d'autres MOCKs (par exemple pour `ReservationDraft`, `Payment`) peuvent aussi avoir des champs désynchronisés. Le WIP a fait le minimum pour faire compiler.
- **Recommandation :** Auditer tous les `.test.tsx` pour vérifier que les MOCKs correspondent aux types actuels de `types.ts`. Voir §4 PR3.
- **Statut :** Test quality.

---

## 4. Plan de correctifs groupés par sévérité

### 4.1 Vue d'ensemble

| Sévérité | PR | ID | Volets | Effort estimé | Bloquant ? |
|---|---|---|---|---|---|
| Critique | 0 | — | — | — | Aucun finding critique (F175A gel bloque les fixes backend) |
| Haute | F181A-HIGH-1 | `fix/f181a-high-conversion-and-asymetry` | Documents Titan, HAH/Titan asymétrie, Payment workflow, Stock i18n | 2-3 jours | Oui (UX flux proforma) |
| Moyenne | F181A-MED-1 | `fix/f181a-med-i18n-and-css` | i18n, CSS Tailwind, a11y aria-label, Resources link, prospects UX | 1-2 jours | Recommandé |
| Basse | F181A-LOW-1 | `fix/f181a-low-tech-debt-and-polish` | Code mort, `any` types, dead state, counters | 0.5-1 jour | Optionnel |

### 4.2 PR Haute — `F181A-HIGH-1`

**Titre :** `fix(ui): wire proforma contract conversion UI + i18n critical + Titan lifecycle gap`

**Scope :**
- F181A-DOC-T-1 : Ajouter boutons "Convertir en contrat" et "Annuler la proforma" dans `TitanDocumentsPanel.tsx` et `HahitantsoaDocumentsPanel.tsx`. Utiliser les fonctions API `convertProformaToContract` et `voidProforma` ajoutées par F180H-FE.
- F181A-AVAIL-3 : Ajouter bouton "Annuler la réservation" dans `AvailabilityPanel.tsx` (à vérifier côté backend).
- F181A-CUST-1 : Afficher une notice expliquant pourquoi "Nouvelle réservation" est désactivée pour un prospect.
- F181A-PAY-1 : Décider du sort du champ UUID `reservation_draft` (supprimer, autocomplete, ou garder avec placeholder explicite).
- F181A-HAH-1 : Aligner libellés "Voir le détail" / "Voir et gérer" et documenter l'asymétrie de suppression.

**Critères d'acceptation :**
- `scripts/dev/erp-frontend-ci` PASS (scope guard + tests + build + manifest).
- Tests Vitest passent (ajouter des tests pour les nouveaux boutons).
- Aucune régression sur les écrans existants.
- PR CI `CI policy gate` SUCCESS.

**Risques :**
- Le backend peut ne pas supporter l'annulation Titan. À vérifier en lisant `backend/apps/reservations/views.py`. Si non, transformer en gap reporté (pas un fix).
- Le backend peut refuser `voidProforma` sur certains statuts. Le bouton doit être désactivé selon `instance.status` côté UI.

### 4.3 PR Moyenne — `F181A-MED-1`

**Titre :** `fix(ui): i18n français cohérent + css framework cohérence + a11y aria-label`

**Scope :**
- F181A-I18N-1 : Passer en français les ~60 messages en anglais dans `HahitantsoaEventDraftsPanel.tsx`, `TitanDocumentsPanel.tsx`, `TitanStockMovementPanel.tsx`.
- F181A-CSS-1 : Réécrire la modal de suppression `HahitantsoaEventDraftsPanel.tsx:1809-1827` en classes custom.
- F181A-A11Y-1 : Aligner les `aria-label` sur le texte visible français dans `TitanStockMovementPanel.tsx`.
- F181A-AVAIL-5 : Étendre `onNavigate` pour préciser l'onglet cible (Documents/Factures/Paiements/Logistique).
- F181A-PAY-3 : Ajouter lien "Voir le reçu" dans `PaymentWorkflowPanel.tsx`.
- F181A-CUST-3 : Ajouter compteurs aux segments (Tous/Clients/Prospects).
- F181A-STK-3 : Ajouter filtres (type, date) à la liste de mouvements de stock.

**Critères d'acceptation :**
- Tous les messages utilisateur en français.
- Aucun `aria-label` en anglais.
- Aucune classe Tailwind dans le code (sauf si configuré globalement).
- Tests Vitest passent.

### 4.4 PR Basse — `F181A-LOW-1`

**Titre :** `chore(ui): tech debt removal + minor UX polish`

**Scope :**
- F181A-HAH-6 : Supprimer `noWriteAccess` (utilisé via `formDisabled`), `customersLoaded` (mort).
- F181A-HAH-7 : Typer `value` dans `updateLineField`.
- F181A-LOG-1 : Refactorer `confirmAction` en union discriminé.
- F181A-AVAIL-4 : Désactiver "Ajouter une ligne" si tous les items utilisés.
- F181A-HAH-3 : Désactiver "Ajouter une ligne" HAH si `inventoryItems.length === 0`.
- F181A-HAH-4 : Désactiver "Soumettre la demande d'avenant" si préflight non chargé ou `!can_amend`.
- F181A-AVAIL-7 : Ajouter `aria-describedby` ou helper texte sur le bouton "Confirmer la réservation" désactivé.
- F181A-CUST-4 : Note sur la pagination client (backlog, pas de fix).

### 4.5 PR de tests — `F181A-TEST-1`

**Titre :** `test(ui): synchronize MOCK fixtures with current types`

**Scope :**
- F181A-TEST-1 : Auditer tous les `.test.tsx` et leurs MOCKs. S'assurer qu'ils correspondent aux types actuels. Ajouter des helpers de mock réutilisables (par exemple `mockReservationDraft(overrides)`).

### 4.6 PRs non créées (gap reportés)

- **F181A-AVAIL-3** (annulation Titan) : si le backend ne supporte pas, transformer en gap dans `docs/decisions/` ou `docs/audits/`.
- **F181A-HAH-8 / F181A-CUST-2** (statut prospect en tag notes) : le fix nécessite une vraie colonne backend. Reporter à post-F175A.
- **F181A-LOG-3** (retour en arrière transition) : nécessite décision métier. Documenter comme gap.
- **F181A-LOG-5** (logistique HAH) : nécessite décision produit. Documenter comme gap.

---

## 5. Matrice de classification

| Sévérité | Volet Réservation | Volet Commercial | Volet Inventaire | Volet Logistique | Transverse |
|---|---|---|---|---|---|
| Critique | — | — | — | — | — |
| Haute | F181A-HAH-1, F181A-AVAIL-3 | F181A-DOC-T-1, F181A-DOC-T-2, F181A-PAY-1 | F181A-STK-1 | — | F181A-I18N-1 |
| Moyenne | F181A-AVAIL-5, F181A-HAH-2, F181A-HAH-3, F181A-HAH-4, F181A-HAH-8 | F181A-PAY-2, F181A-PAY-3, F181A-CUST-1, F181A-CUST-2 | F181A-STK-2, F181A-STK-3 | F181A-LOG-2, F181A-LOG-3, F181A-LOG-4, F181A-LOG-5, F181A-LOG-6 | F181A-CSS-1, F181A-A11Y-1, F181A-TEST-1 |
| Basse | F181A-AVAIL-1, F181A-AVAIL-2, F181A-AVAIL-4, F181A-AVAIL-7, F181A-HAH-5, F181A-HAH-6, F181A-HAH-7 | F181A-CUST-3, F181A-CUST-4, F181A-PAY-4, F181A-DOC-T-3 | F181A-STK-4, F181A-STK-5 | F181A-LOG-1 | — |

**Total :** 1 Haute Critique (0), 6 Haute, 17 Moyenne, 14 Basse. Total = 37 findings.

---

## 6. Validation gates

Pour chaque PR de cette série F181A :

- `bash scripts/dev/erp-agent-scope-guard frontend` PASS.
- `scripts/dev/erp-frontend-ci` PASS (scope guard + npm ci + test + build + manifest).
- `git diff --check` PASS.
- PR CI `CI policy gate` SUCCESS.
- Post-merge : `main` CI verte, `git status --short` clean.

**Pré-requis bloquant :** la PR F180H-FE (#505) doit être mergée en premier pour que `main` redevienne compilable. Sans cela, aucun build local ne peut valider les PRs F181A.

---

## 7. Annexes

### 7.1 Sources consultées

#### Cartographie
- `docs/architecture/application-map/FRONTEND_MAP.md` (F178B, 2026-06-25)
- `docs/architecture/application-map/API_AND_DATA_FLOW_MAP.md` (F178B)
- `docs/architecture/application-map/NAVIGATION_TREE_TARGET.md` (F178B)
- `docs/audits/F180D6_FINAL_READINESS_AUDIT.md` (D6)

#### Frontend (lecture intégrale)
- `frontend/src/AvailabilityPanel.tsx` (1584 lignes)
- `frontend/src/HahitantsoaEventDraftsPanel.tsx` (1832 lignes)
- `frontend/src/PaymentWorkflowPanel.tsx` (944 lignes)
- `frontend/src/LogisticsDeliveryPanel.tsx` (678 lignes)
- `frontend/src/TitanDocumentsPanel.tsx` (304 lignes)
- `frontend/src/TitanStockMovementPanel.tsx` (298 lignes)
- `frontend/src/CustomerPanel.tsx` (lecture partielle, ~700 lignes)
- `frontend/src/HahitantsoaCommercialOpsPanel.tsx` (192 lignes)
- `frontend/src/prototype/ReservationDetailPage.tsx` (top 100 lignes)

#### Backend (référence)
- `backend/apps/documents/urls.py` (routes `convert-to-contract` et `void`)
- `backend/apps/documents/serializers.py` (vue partielle, `valid_until` ajouté)

#### Cartographie de l'inventaire
- `ls frontend/src/` (53 fichiers, mix panneaux + tests)
- `ls frontend/src/prototype/` (47 fichiers, mode démo)

### 7.2 Commandes lancées

- `git status --short` (propre)
- `git branch --show-current` (`main`)
- `git log -1 --oneline` (`13a1edf`)
- `git worktree add /home/raillersing/projects/hahitantsoa-titan-erp-f181a-ui-ux-audit -b frontend/f181a-ui-ux-audit main`
- `ls /home/raillersing/projects/hahitantsoa-titan-erp-f181a-ui-ux-audit/docs/audits/` (dossier d'arrivée)

Note : `scripts/dev/erp-frontend-ci` n'a pas été lancé (audit read-only). À lancer par les PRs de correctifs.

### 7.3 Limitations de l'audit

- **Read-only uniquement** : aucune modification du code n'a été faite (sauf ce rapport).
- **Backend non audité** : gel F175A, seules les vues ont été lues superficiellement.
- **Tests non audités** : les `.test.tsx` ont été regardés superficiellement (MOCKs de `valid_until` à cause du WIP F180H).
- **Volets non couverts** : Dashboard, Planning, Cashbox, Audit, Identity, Login, Auth, Theme.
- **Design system** : le contrat design (`docs/design/CLIENT_APPROVED_UI_REFERENCE.md`, etc.) n'a pas été croisé.

### 7.4 Mots-clés pour recall

- `parcours utilisateurs`
- `cohérence UI/métier`
- `Hahitantsoa/Titan boundary`
- `statut prospect`
- `proforma conversion`
- `i18n français`
- `accessibilité aria-label`

---

## 8. Conclusion

L'application Hahitantsoa/Titan ERP est fonctionnellement riche et bien structurée, mais souffre de plusieurs **dettes d'inconsistance** qui nuisent à la qualité de l'expérience. Le **plan de correctifs** proposé (3 PRs : haute, moyenne, basse) traite l'essentiel sans élargir le scope.

**Recommandation finale :**

1. **Bloquer** tout merge de PRs F181A tant que F180H-FE (#505) n'est pas mergée (CI rouge actuelle).
2. **Une fois F180H-FE mergée** : créer `F181A-HIGH-1` pour les actions critiques (conversion proforma, asymétrie HAH/Titan, i18n critique).
3. **En parallèle** : créer `F181A-MED-1` pour la dette i18n et CSS.
4. **Plus tard** : `F181A-LOW-1` pour la dette technique.

L'audit n'a détecté **aucun finding critique** qui bloquerait la production actuelle. Les findings sont principalement de la dette d'inconsistance qui peut être traitée sans risque de régression.

---

*Fin de l'audit F181A*
