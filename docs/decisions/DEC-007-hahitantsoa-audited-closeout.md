# DEC-007 — Clôture Hahitantsoa auditée

Status: Accepted
Scope: R6 / prerequisite for R7
Type: Business-domain decision
Date: 2026-08-29

## Decision

Un événement Hahitantsoa confirmé doit avoir une clôture métier persistée, idempotente,
attribuée et auditée. La clôture est une preuve finale distincte de la confirmation :
elle ne remplace ni le statut `confirmed`, ni les documents, paiements, retours ou
écritures financières qui la justifient.

L'implémentation doit créer une preuve immuable liée directement à
`HahitantsoaEventDraft`. Elle ne doit jamais réutiliser une relation Titan ou une
`ReservationDraft` comme substitut d'appartenance.

## Éligibilité

La clôture est possible uniquement pour un événement confirmé, non supprimé, avec une
attribution durable de l'auteur et une autorisation backend explicite. Elle vérifie à
l'intérieur d'une transaction les faits opérationnels et financiers applicables.

### Cas sans logistique

Un événement `bare` ou une prestation sans ligne inventaire est clôturable sans sortie
ni retour de stock. Les obligations commerciales, documentaires et financières qui lui
sont applicables restent exigées.

### Cas avec logistique ou inventaire

Un événement ayant des lignes inventaire, une sortie ou une passation exige :

- logistique terminée ou annulée selon le dossier ;
- retour lié, validé et sans dépassement des quantités sorties ;
- règlement casse/perte validé puis exécuté lorsqu'il existe ;
- caution réglée ou annulée lorsqu'une obligation de restitution existe ;
- créance de casse/perte facturée et soldée, ou annulée avec sa justification durable.

## Finance, documents et signature

- Les factures ouvertes, paiements externes confirmés non réconciliés, anomalies de
  caisse et incohérences financières bloquent la clôture.
- Les documents finaux générés restent privés et conservent leur référence métier.
- La signature ou passation requise doit être présente. Une exception est admise
  seulement si elle est persistée avec motif, auteur et horodatage ; elle doit être
  visible dans la preuve de clôture.

## Annulation et immutabilité

Une annulation avant clôture suit son flux métier propre et n'est pas une clôture. Une
fois clôturée, la preuve ne peut pas être modifiée ni recréée avec une autre clé
d'idempotence. Un rejeu avec la même clé retourne la preuve existante sans réévaluer ou
muter les faits historiques.

## Exigences d'implémentation R7

R7-BE doit :

- conserver l'appartenance Hahitantsoa directe de tous les faits utilisés ;
- verrouiller l'événement et les dépendances qui déterminent son éligibilité ;
- recalculer les blocages dans la transaction ;
- enregistrer auteur, date, clé d'idempotence et snapshot immuable ;
- produire un audit après commit ;
- couvrir les cas positifs, négatifs, rejeu et frontières Hahitantsoa/Titan.

R7-FE consommera uniquement ce contrat backend validé et préservera les écrans
commerciaux existants.

## Hors périmètre

Cette décision ne modifie aucun modèle, API, statut runtime, document modèle, donnée de
simulation ou écran. Elle n'autorise pas de simplification de l'interface validée.

## Sources

- `docs/business-rules/billing-and-payments.md`
- `docs/decisions/DEC-001-titan-scope-validated.md`
- `docs/decisions/DEC-005-reservation-confirmation-domain-contract.md`
- `docs/decisions/DEC-006-reservation-sensitive-permissions-attribution-audit.md`
- `docs/adr/ADR-005-shared-inventory-between-business-scopes.md`
- validation humaine du 2026-08-29
