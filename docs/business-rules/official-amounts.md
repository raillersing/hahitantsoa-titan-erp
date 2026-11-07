# Règles Métier et Conditions Financières Officielles (Hahitantsoa & Titan)

Sources prioritaires :
- `docs/references/source/hahitantsoa-contrat-template.html` (Modèle officiel de contrat Hahitantsoa)
- `docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf`
- `docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf`
- Décisions d'audit transverse du 2026-09-23 / 2026-09-24

---

## 1. Identifiants Légaux et Administratifs

Les documents officiels émis par l'entreprise (contrats, factures, proformas, reçus) portent obligatoirement les mentions légales canoniques suivantes :

- **Raison sociale / Enseigne** : Espace Événementiel Hahitantsoa / Titan Location
- **NIF** : `6003298583`
- **STAT** : `77290 11 2019 010 215`
- **Siège / Adresse d'exploitation** : Antananarivo, Madagascar

---

## 2. Versements Contractuels et Verrouillage de Réservation (Article 5)

La réservation Hahitantsoa suit un régime de confirmation transactionnelle stricte :

- **Montants contractuels établis (Article 5)** :
  - **Location nue (espace seul)** : `1 000 000 Ar`
  - **Location avec logistique (espace + matériel/mobilier)** : `1 500 000 Ar`
- **Terminologie officielle** :
  - Le terme « acompte » est proscrit des procédures Hahitantsoa au profit de « versement contractuel » / « versement de réservation ». Les montants sont forfaitairement établis par contrat et ne constituent pas un pourcentage variable ad-hoc.
- **Règle de séquencement, validité et encaissement (DEC-009)** :
  - Après émission du proforma, un contrat officiel est généré avec une date de validité paramétrable (`contract_validity_days`, défaut 15 jours).
  - Le contrat doit obligatoirement être signé par le client avant que tout paiement ne soit accepté ou enregistré.
  - Si le contrat n'est pas signé ou s'il expire, la réservation n'est pas effective et aucun paiement ne peut être reçu.
  - La réservation n'est **définitivement confirmée** que lorsque le contrat est signé ET que 100 % du versement contractuel requis a été encaissé (espèces, chèque encaissé, virement reçu ou référence Mobile Money vérifiée).
- **Verrouillage exclusif et archivage des options concurrentes** :
  - Dès confirmation de l'événement Hahitantsoa, la date et le lieu sont verrouillés de façon exclusive. Aucun autre événement ne peut occuper le même lieu à la même date.
  - Toutes les autres options / brouillons concurrents positionnés sur la même date et le même lieu sont automatiquement basculés au statut `archived`.
  - Ces dossiers archivés ne sont jamais détruits : ils restent consultables dans l'historique et peuvent être réactivés par un opérateur s'ils sont repositionnés sur une nouvelle date libre.
- **Régime Titan (Location de matériels)** :
  - Titan autorise la multi-location de matériels sur une même date tant que le stock physique disponible le permet.

---

## 3. Horaires d'Accès Préparatoires aux Locaux (Article 3 du contrat)

Conformément à la décision [`DEC-009`](../decisions/DEC-009-reservation-contract-sequencing-and-access-rules.md), l'horaire contractuel d'accès aux locaux pour les intervenants et prestataires du client est calculé dynamiquement selon l'occupation de la veille ($J-1$) :

1. **Aucun événement la veille ($J-1$)** :
   - Mention contractuelle : `« Les intervenants du client peuvent accéder aux locaux à 15 heures 30 »`
2. **Événement la veille ($J-1$) — Fête de jour** (libération à 22h00 / sortie 23h00) :
   - Mention contractuelle : `« Les intervenants du client peuvent accéder aux locaux à 23 heures 30 »`
3. **Événement la veille ($J-1$) — Option Nuit 1** (libération à 21h00 / sortie 22h30) :
   - Mention contractuelle : `« Les intervenants du client peuvent accéder aux locaux à le jour-J à 07 heures »`
4. **Événement la veille ($J-1$) — Option Nuit 2** (libération à 00h00 / sortie 03h30) :
   - Mention contractuelle : `« Les intervenants du client peuvent accéder aux locaux à le jour-J à 07 heures »`

---

## 4. Dépôt de Garantie / Caution (Article 7)

- **Montant standard** : `500 000 Ar`
- **Origine des données** : Le montant affiché et exigé est lu dynamiquement depuis la configuration commerciale serveur (`terms.caution_amount`). Aucun écran ou composant ne doit figer ce montant en dur.
- **Exigibilité** : Versée au plus tard à J-10 de l'événement ou le jour de la mise à disposition / passation.
- **Restitution et imputation** :
  - Restituable sous un délai maximum de 8 jours ouvrés après l'événement, sous réserve de la conformité de l'état des lieux de sortie contradictoire.
  - Tout dommage, casse, dégradation ou perte constatée lors du retour fait l'objet d'une déduction directe sur la caution.
  - Si le coût des réparations ou remplacements excède la caution, un complément de facturation est émis à l'ordre du client.

---

## 5. Horaires d'Occupation et Pénalités de Retard (Article 4)

- **Heure limite standard de libération des lieux** : `02h00` du matin.
- **Pénalité de dépassement horaire** : `100 000 Ar` par heure entamée au-delà de 02h00 du matin.
- Cette pénalité est imputable sur la caution ou facturée lors de la clôture du dossier.

---

## 6. Grille Tarifaire des Casses et Pertes

- Tout matériel loué (Titan) ou mis à disposition (Hahitantsoa) détérioré, cassé ou manquant au retour fait l'objet d'un constat contradictoire (procès-verbal de retour).
- La facturation s'effectue selon le coût de remplacement à neuf de l'article (valeur catalogue) ou selon le devis de remise en état fourni par un prestataire agréé.
- L'émission du document officiel « Facture de casse et réparation » (`hahitantsoa.breakage_repair_invoice.v1`) fait foi pour le règlement.

---

## 7. Régime Fiscal (TVA)

- **Taux standard de TVA** : `20 %` applicable aux prestations imposables.
- Les devis et proformas distinguent le montant Hors Taxes (HT), la TVA (20 %) et le montant Toutes Taxes Comprises (TTC) selon le profil fiscal de l'entité facturatrice.

---

## 8. Modalités d'Annulation (Article 8)

Conformément aux stipulations expresses du contrat d'engagement :

- **Conditions d'annulation** : Un événement Hahitantsoa confirmé ne peut être annulé qu'en cas de **force majeure** dûment justifiée (décès au premier degré, catastrophe naturelle majeure, arrêté préfectoral ou gouvernemental d'interdiction).
- **Non-remboursement strict** : **Aucun remboursement** des sommes déjà versées (versement contractuel initial, tranches intermédiaires) ne sera consenti au client. Les sommes versées restent acquises à l'entreprise à titre de dédommagement d'immobilisation de l'espace.
- **Traçabilité logicielle** : Toute annulation d'un événement confirmé dans l'ERP requiert la saisie d'un motif très détaillé et explicite (`cancellation_reason`). L'action est enregistrée de manière immuable dans le journal d'audit avec identité de l'opérateur et horodatage.
- **Libération des ressources** : L'annulation libère le verrou d'occupation de la salle pour la date concernée.

---

## 9. Traitement des Paiements Mobile Money (MVola, Orange Money, Airtel Money)

- **Fonctionnement opérationnel** :
  - Il n'y a pas d'intégration directe par passerelle API télécoms automatisée in-app dans l'état actuel de la plateforme.
  - Le client effectue son transfert directement vers le numéro officiel / téléphone de l'entreprise.
  - L'opérateur responsable vérifie la réception effective du SMS de confirmation sur le téléphone de l'entreprise.
  - L'opérateur saisit ensuite manuellement dans l'ERP :
    - Le mode de paiement (`mobile_money` / `mvola`),
    - Le montant reçu,
    - La référence de transaction officielle communiquée par l'opérateur télécom.
- **Multi-modalité** : Le paiement fractionné multimodal est supporté (ex: une partie en espèces à la caisse, une partie par virement bancaire, le solde par référence Mobile Money). Chaque versement génère son reçu horodaté.
