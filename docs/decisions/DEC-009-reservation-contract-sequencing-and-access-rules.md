# DEC-009 — Séquencement contractuel (Signature avant paiement), délai de validité paramétrable et horaires d'accès veille (Article 3)

Status: Accepted  
Scope: Hahitantsoa & Titan ERP / Transversal  
Type: Business-domain, Financial & Architecture Decision  
Date: 2026-11-07  

---

## Contexte

Dans les procédures initiales de réservation d'événements Hahitantsoa, le versement financier (qualifié historiquement d'« acompte ») pouvait parfois précéder la signature formelle du contrat, ou être enregistré en parallèle de la génération des documents.

Des directives impératives ont été arrêtées par le client pour clarifier et verrouiller les règles de gestion et décisions métiers applicables à l'ensemble du système :

1. **Séquencement strict : signature préalable obligatoire**  
   Après émission d'un devis / proforma, un contrat officiel peut être généré. Dès son émission, une période de réflexion est ouverte pour le client. **Le contrat doit être obligatoirement signé par le client avant que celui-ci ne puisse passer au paiement**. Aucun paiement (versement contractuel de réservation) ne peut être accepté ou enregistré dans le système tant que le contrat n'est pas formellement signé.

2. **Délai de validité du contrat paramétrable et caducité**  
   Il peut exister un temps d'attente entre l'émission du contrat et sa signature. Si le client ne signe pas le contrat, la réservation n'est pas effective. Tout contrat émis dispose d'un délai de validité paramétrable dans la configuration commerciale (`contract_validity_days`, fixé par défaut à 15 jours). Un contrat dont la date de validité est dépassée est **expiré (caduc)** : il ne peut plus être signé et ne peut plus recevoir de paiement. Une nouvelle révision du contrat doit être générée pour réenclencher la procédure.

3. **Validation définitive de la réservation**  
   Ce n'est qu'après la signature du contrat ET l'encaissement du versement contractuel requis que la réservation est définitivement confirmée et validée (avec recontrôle transactionnel des disponibilités et archivage automatique des options concurrentes).

4. **Bannissement du terme « acompte » au profit de « versement contractuel »**  
   Dans les procédures Hahitantsoa, il n'y a pas d'« acompte » au sens comptable standard d'un pourcentage indéterminé : un montant forfaitaire a déjà été établi par contrat (Article 5 : `1 000 000 Ar` en formule location nue, `1 500 000 Ar` en formule location + logistique). Les libellés d'interface, bannières, reçus et textes contractuels doivent employer exclusivement « Versement contractuel » / « Versement de réservation ».

5. **Règles d'accès aux locaux selon l'occupation de la veille (Article 3 du contrat Hahitantsoa)**  
   Dans le contrat officiel Hahitantsoa, l'horaire auquel les intervenants et prestataires du client peuvent accéder aux locaux pour les préparatifs dépend strictement de l'occupation de la veille ($J-1$) :
   - **Cas 1 — Aucun événement la veille ($J-1$)** :  
     Texte Article 3 : `« Les intervenants du client peuvent accéder aux locaux à 15 heures 30 »`
   - **Cas 2 — Événement la veille ($J-1$) Fête de jour** (fin à 22h00 / sortie 23h00) :  
     Texte Article 3 : `« Les intervenants du client peuvent accéder aux locaux à 23 heures 30 »`
   - **Cas 3 — Événement la veille ($J-1$) Utilisation de nuit Option 1** (fin à 21h00 / sortie 22h30) :  
     Texte Article 3 : `« Les intervenants du client peuvent accéder aux locaux à le jour-J à 07 heures »`
   - **Cas 4 — Événement la veille ($J-1$) Utilisation de nuit Option 2** (fin à 00h00 / sortie 03h30) :  
     Texte Article 3 : `« Les intervenants du client peuvent accéder aux locaux à le jour-J à 07 heures »`

---

## Décisions d'Architecture et Invariants Métier

### 1. Invariant de séquencement (INV-SEQ-01)
- L'émission d'un contrat positionne un attribut `valid_until = prepared_at + timedelta(days=contract_validity_days)`.
- La transition `mark_contract_signed` requiert strictement `valid_until >= now()`. Si `valid_until < now()`, la signature est rejetée avec le code `contract_expired`.
- L'enregistrement d'un paiement de réservation (`PaymentKind.DEPOSIT` ou `PaymentKind.DATE_RESERVATION`) et le marquage du versement requis requièrent strictement :
  1. `contract_signed_at is not null` (le contrat est signé)
  2. `latest_contract.valid_until >= now()` (le contrat n'est pas expiré)
  Si l'une de ces conditions n'est pas remplie, l'opération est rejetée avec `contract_signature_required_before_payment` ou `contract_expired`.

### 2. Modèle de données et paramétrage
- Le modèle `HahitantsoaCommercialTerms` intègre `contract_validity_days = PositiveIntegerField(default=15)`.
- L'interface d'administration commerciale (`HahitantsoaCommercialTermsPage`) permet de modifier ce paramètre (entier $\ge 1$).

### 3. Calcul dynamique de l'accès veille dans le moteur de documents
- Le service `get_hahitantsoa_contract_article_3_access_text` inspecte l'état effectif des réservations confirmées sur la même salle au jour $J-1$ (`start_at.date() - timedelta(days=1)`).
- Le texte calculé est injecté dans le contexte du template Jinja `hahitantsoa_contract.html` via la variable `article_3_access_text`.

### 4. Interface utilisateur & Ergonomie commerciale
- Les boutons d'encaissement et de saisie de paiement sur les brouillons de réservation sont désactivés avec infobulle explicative tant que le contrat n'est pas signé.
- Si le contrat est expiré, une alerte proéminente `contract-expired-alert` informe l'utilisateur et propose immédiatement le bouton « Générer nouvelle révision ».
- Les mentions textuelles dans le studio de confirmation et les synthèses financières sont alignées sur « Versement contractuel ».

---

## Conséquences et Conformité

- **Sécurité contractuelle** : L'établissement est protégé contre tout encaissement d'argent sans engagement contractuel préalable signé.
- **Transparence opérationnelle** : Les horaires d'accès aux locaux sont contractualisés de manière exacte dès l'émission du document, éliminant tout litige sur les préparatifs de décoration ou traiteur.
- **Intégrité de la base** : Les contraintes sont appliquées au niveau des services backend (`apps.payments.services`, `apps.hahitantsoa.services`, `apps.reservations.confirmation`) et répercutées dans l'interface React.
