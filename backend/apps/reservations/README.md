# Reservations

Role prevu : accueillir le futur domaine de reservation/location.

F33 active `reservations` comme app Django technique via `ReservationsConfig`.

Ce domaine preparera plus tard la reservation/location de materiels, articles et packs materiels.

Les futures reservations devront utiliser les regles de disponibilite documentees dans [DEC-002-inventory-availability-domain.md](../../../docs/decisions/DEC-002-inventory-availability-domain.md).

Avant toute confirmation future, les reservations devront verifier `InventoryAvailability` et les conflits de disponibilite.

Titan reste strictement limite a :

- `material` ;
- `article` ;
- `material_pack`.

Titan exclut toujours :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

F33 ne cree :

- aucun modele ;
- aucune migration ;
- aucun serializer ;
- aucune view ;
- aucune URL ;
- aucun endpoint ;
- aucun admin ;
- aucun service metier complet ;
- aucun contrat ;
- aucune facture ;
- aucun paiement ;
- aucun client ;
- aucun frontend.

## Scope guard reservations

F34 ajoute `scope.py` comme garde-fou pur Python pour le futur domaine reservation/location.

Constantes exposees :

- `RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS` ;
- `RESERVATION_DISALLOWED_INVENTORY_ITEM_KINDS`.

Fonctions exposees :

- `is_reservable_inventory_item_kind(kind)` ;
- `assert_reservable_inventory_item_kind(kind)`.

Les kinds reservables pour Titan sont strictement :

- `material` ;
- `article` ;
- `material_pack`.

Les kinds interdits sont :

- `venue` ;
- `local` ;
- `room` ;
- `service` ;
- `event_service`.

Les kinds inconnus sont egalement refuses.

Ce garde-fou devra etre utilise plus tard par le futur module reservation/location avant toute creation ou confirmation de reservation Titan.

F34 ne cree aucune reservation. F34 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, service metier complet, contrat, facture, paiement, client ou frontend.

## Reservation periods

F35 ajoute `periods.py` comme socle de validation pure Python pour les futures periodes de reservation/location.

`ReservationPeriod` est une dataclass immuable qui porte :

- `start_at` ;
- `end_at`.

Helpers exposes :

- `is_aware_datetime(value)` ;
- `validate_reservation_period(start_at, end_at)` ;
- `make_reservation_period(start_at, end_at)`.

Regles de validation :

- `start_at` est obligatoire ;
- `end_at` est obligatoire ;
- `start_at` doit etre un datetime timezone-aware ;
- `end_at` doit etre un datetime timezone-aware ;
- `end_at` doit etre strictement superieur a `start_at`.

Les periodes sont interpretees comme des intervalles demi-ouverts `[start_at, end_at)`, en coherence avec [DEC-002-inventory-availability-domain.md](../../../docs/decisions/DEC-002-inventory-availability-domain.md).

F35 ne cree aucune reservation. F35 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, service metier complet, contrat, facture, paiement, client ou frontend.

## Reservation item validation

F36 ajoute `validation.py` comme helper pur Python pour valider une future demande de reservation item + periode.

`ReservationItemValidation` est une dataclass immuable qui porte :

- `inventory_item_kind` ;
- `period`.

Fonction exposee :

- `validate_reservation_item_request(inventory_item_kind, start_at, end_at)`.

Cette validation combine :

- `assert_reservable_inventory_item_kind` pour refuser tout kind non reservable ;
- `make_reservation_period` pour valider la periode.

Kinds autorises :

- `material` ;
- `article` ;
- `material_pack`.

`start_at` et `end_at` doivent etre des datetimes timezone-aware.

La periode doit respecter `end_at > start_at` et reste interpretee comme un intervalle demi-ouvert `[start_at, end_at)`.

F36 ne cree aucune reservation. F36 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, service metier complet, contrat, facture, paiement, client ou frontend.

## Reservation availability validation

F37 ajoute `availability.py` comme helper interne pour valider une future demande de reservation item + periode et verifier sa disponibilite.

Dataclasses exposees :

- `ReservationItemAvailabilityDetails` ;
- `ReservationItemAvailabilityValidation`.

Fonction exposee :

- `validate_reservation_item_availability_request(inventory_item, inventory_item_kind, start_at, end_at)`.

Cette validation combine :

- `validate_reservation_item_request` pour valider le kind reservable et la periode ;
- `get_inventory_availability_conflicts` pour lire les conflits `InventoryAvailability` existants.

Le helper retourne :

- `valid` ;
- `available` ;
- `errors` ;
- `inventory_unit_count` ;
- `details`.

`inventory_unit_count` reste `None` en F37, car aucun champ quantite, unite ou stock n'existe encore sur `InventoryItem`.

Le helper lit la DB uniquement pour verifier les conflits de disponibilite. Il ne cree aucune reservation et n'ecrit jamais en DB.

Kinds reservables :

- `material` ;
- `article` ;
- `material_pack`.

Titan exclut toujours :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

F37 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, service metier complet, contrat, facture, paiement, client ou frontend.

## Reservation preview service

F40 ajoute `services.py` comme couche service interne mince pour orchestrer la preview de reservation item.

Fonction exposee :

- `preview_reservation_item_service`.

Le service delegue a `preview_reservation_item_request` et ne duplique pas la logique F38.

Il ne cree aucune reservation persistante, n'ecrit jamais en DB et ne cree aucun endpoint API.

F40 ne cree aucun modele, migration, serializer, view, URL, admin, service metier complet, contrat, facture, paiement, client ou frontend.

## Reservation available items selector

F51 ajoute `selectors.py` comme couche interne de lecture pour lister les items inventory disponibles pour une future reservation.

Fonction exposee :

- `get_available_reservation_inventory_items_for_period`.

La fonction valide la periode avec `make_reservation_period`, puis delegue au selector inventory F50 `get_available_inventory_items_for_period`.

Elle retourne directement le `QuerySet[InventoryItem]` du selector inventory. Elle ne duplique pas la logique d'overlap `InventoryAvailability` et conserve les regles Titan deja appliquees par inventory :

- items actifs ;
- items non supprimes ;
- kinds `material`, `article`, `material_pack` ;
- exclusion des conflits `blocked` ou `reserved` sur `[start_at, end_at)`.

F51 reste read-only. Elle ne cree aucune API, serializer, view, URL, admin, frontend, modele, migration, reservation persistante, contrat, facture, paiement, client, stock, quantite ou ecriture DB.

## Reservation available items options service

F52 ajoute un service interne dans `services.py` pour preparer une liste structuree d'items Titan disponibles pour une future reservation.

Dataclass exposee :

- `ReservationAvailableItemsOptions`.

Champs exposes :

- `period` ;
- `items` ;
- `count`.

Fonction exposee :

- `get_reservation_available_items_options_service`.

La fonction valide la periode avec `make_reservation_period`, delegue au selector F51 `get_available_reservation_inventory_items_for_period`, materialise le resultat en `tuple[InventoryItem, ...]` et expose `count = len(items)`.

La logique d'overlap `InventoryAvailability` reste dans inventory/F50. F52 ne l'implemente pas et n'appelle pas directement le selector inventory.

F52 reste read-only. Elle ne cree aucune API, serializer, view, URL, admin, frontend, modele, migration, reservation persistante, contrat, facture, paiement, client, stock, quantite, unite, pricing ou ecriture DB.

## Reservation service consistency

F53 ajoute des tests de coherence entre :

- `preview_reservation_item_service` ;
- `get_reservation_available_items_options_service`.

Ces tests verifient que les chemins internes F40 et F52 restent alignes sur les memes regles Titan de disponibilite pour les items disponibles, les conflits `blocked` ou `reserved`, les kinds interdits et les periodes invalides.

F53 ne modifie pas la logique metier. F53 ne cree aucune API, serializer, view, URL, admin, frontend, modele, migration, reservation persistante, contrat, facture, paiement, client, stock, quantite, unite, pricing ou ecriture DB.

## Reservation available item previews service

F54 ajoute un service interne batch dans `services.py`.

Fonction exposee :

- `get_reservation_available_item_previews_service`.

La fonction appelle `get_reservation_available_items_options_service`, parcourt uniquement les `items` disponibles retournes par F52, puis appelle `preview_reservation_item_service` pour chaque item avec `inventory_item_kind=item.kind`.

Elle retourne un `tuple[ReservationItemPreview, ...]`. Elle ne duplique pas la logique d'overlap `InventoryAvailability` et n'appelle pas directement le selector inventory F50.

## Reservation service scope guards

## Reservation-sensitive authorization

F121B2 adds `authorization.py` as a narrow backend-only helper module for future sensitive reservation writes.

Helpers exposed:

- `is_reservation_sensitive_staff_actor(actor=...)`
- `require_reservation_sensitive_staff_actor(actor=...)`

Current F121B2 semantics remain intentionally small:

- unauthenticated actor: denied;
- anonymous actor: denied;
- inactive actor: denied when `is_active` is present and `False`;
- authenticated non-staff actor: denied;
- authenticated active staff actor: allowed.

This primitive does not create roles, groups, operators, managers, reviewers, broad RBAC, confirmation, audit persistence, attribution fields, contract prerequisites, or deposit prerequisites.

## Reservation-sensitive attribution

F121D adds `attribution.py` as a narrow backend-only foundation for future
reservation-sensitive writes.

`capture_reservation_sensitive_actor_attribution(actor=...)`:

- reuses the F121B2 reservation-sensitive staff actor authorization;
- requires an actor with a persistent identifier;
- captures that identifier with a timezone-aware attribution timestamp;
- returns an immutable `ReservationSensitiveActorAttribution` value object.

The value object does not persist anything by itself. A future approved sensitive-write
service must persist its actor identifier and timestamp atomically with its own durable
business state and may use F121C separately for transaction-safe success audit events.

F121D does not add confirmation, confirmation fields or status, audit events, inventory
blocking, contract or deposit prerequisites, roles, groups, endpoints, or frontend
behavior.

F54 ajoute des tests de garde-fou Titan scope sur les services reservations.

Les services reservations doivent traiter comme reservables uniquement :

- `material` ;
- `article` ;
- `material_pack`.

Les kinds suivants restent interdits ou invalides :

- `venue` ;
- `local` ;
- `room` ;
- `service` ;
- `event_service`.

F54 reste interne et read-only. F54 ne cree aucune API, serializer, view, URL, admin, frontend, modele, migration, reservation persistante, contrat, facture, paiement, client, stock, quantite, unite, pricing ou ecriture DB.

## Reservation service time rules and ordering

F55 ajoute des tests de robustesse temporelle et d'ordre deterministe pour les services reservations disponibles.

Les services doivent refuser les bornes naives, refuser `end_at <= start_at`, respecter les intervalles demi-ouverts `[start_at, end_at)` et conserver un ordre stable des items disponibles par `name` puis `id`.

F55 ne cree pas de service de resume de disponibilite. F55 ne cree aucune API, modele, migration, serializer, view, URL, endpoint, admin, frontend ou reservation persistante.

## Reservation availability summary service

F56 ajoute un service interne de resume de disponibilite reservations.

Dataclass exposee :

- `ReservationAvailabilitySummary`.

Fonction exposee :

- `get_reservation_availability_summary_service`.

Le service compose `get_reservation_available_items_options_service` et `get_reservation_available_item_previews_service`. Il expose la periode, le nombre d'items disponibles, le nombre de previews disponibles et les kinds disponibles dans l'ordre stable herite de F55.

F56 ne cree pas de compteur par kind. F56 reste interne et read-only. F56 ne cree aucune API, modele, migration, serializer, view, URL, endpoint, admin, frontend ou reservation persistante.

## Reservation service composition optimization

F57 optimise la composition interne des services reservations disponibles.

Un helper prive construit les previews a partir d'un `ReservationAvailableItemsOptions` deja calcule. Le service public de previews conserve son comportement F54, et le service de resume F56 evite de recalculer les options disponibles.

F57 ne change pas le comportement metier et ne change aucune signature publique. F57 reste interne, read-only, sans API, modele, migration, serializer, view, URL, endpoint, admin, frontend ou reservation persistante.

## Reservation services public contract

F58 ajoute des tests de contrat public interne pour les services reservations.

Services couverts :

- `preview_reservation_item_service` ;
- `get_reservation_available_items_options_service` ;
- `get_reservation_available_item_previews_service` ;
- `get_reservation_availability_summary_service`.

Les tests verifient les types de retour, les signatures keyword-only, le caractere read-only, le scope Titan et l'absence d'API reservations.

F58 ne change pas le comportement metier, ne teste pas directement le helper prive F57 et ne cree aucun compteur par kind.

F58 ne cree aucune API, modele, migration, serializer, view, URL, endpoint, admin, frontend ou reservation persistante.

## Reservation internal contract hardening

F59 durcit les tests de contrat interne des services reservations.

Les tests couvrent :

- l'immutabilite des dataclasses publiques `ReservationAvailableItemsOptions` et `ReservationAvailabilitySummary` ;
- la structure stable de leurs champs publics ;
- la coherence entre options disponibles, previews disponibles et resume de disponibilite.

F59 ne change aucun comportement metier, ne teste pas directement le helper prive F57 et ne cree aucun compteur par kind.

F59 ne cree aucune API, modele, migration, serializer, view, URL, endpoint, admin, frontend, reservation persistante, contrat, facture, paiement, client, stock, quantite, unite, pricing ou ecriture DB.

## Reservation MVP guard documentation

F60 clarifie que le domaine `reservations` reste interne et read-only avant toute autorisation explicite d'API ou de frontend.

Le domaine reservations ne contient toujours pas :

- `models.py` ;
- `serializers.py` ;
- `views.py` ;
- `urls.py` ;
- `admin.py` ;
- dossier de migrations metier ;
- reservation persistante.

Les tests existants couvrent ces garde-fous :

- `tests/backend/test_reservations_services_public_contract.py` verifie l'absence de fichiers API reservations et de migrations reservations ;
- `tests/backend/test_reservations_app_config.py` verifie que l'app reservations n'expose aucun modele Django.

F60 ne cree pas de test doublon. F60 ne change aucun comportement metier et ne cree aucune API, modele, migration, serializer, view, URL, endpoint, admin, frontend, reservation persistante, contrat, facture, paiement, client, stock, quantite, unite, pricing ou ecriture DB.

## Reservation availability summary API

F61 ajoute la premiere surface API reservations explicitement autorisee.

Endpoint expose :

- `GET /api/v1/reservations/availability-summary/`

Fichiers API autorises uniquement pour cet endpoint read-only :

- `serializers.py` ;
- `views.py` ;
- `urls.py`.

L'endpoint exige une session authentifiee, valide `start_at` et `end_at` comme datetimes ISO timezone-aware, puis appelle `get_reservation_availability_summary_service`.

La reponse reste volontairement minimale :

- `start_at` ;
- `end_at` ;
- `available_item_count` ;
- `available_preview_count` ;
- `available_item_kinds`.

F61 ne cree aucun `models.py`, aucun `admin.py`, aucun dossier `migrations/`, aucune reservation persistante et aucune API d'ecriture.

F61 ne cree aucun contrat, facture, paiement, client, stock, quantite, unite, pricing, workflow complet de reservation, logique Titan local/salle/venue/room/hall/service/event-service ou workflow commercial.

## Reservation available item previews API

F62 ajoute une seconde surface API reservations explicitement autorisee :

- `GET /api/v1/reservations/available-item-previews/`.

L'endpoint exige une session authentifiee, valide `start_at` et `end_at` comme datetimes ISO timezone-aware, puis appelle `get_reservation_available_item_previews_service`.

La reponse est une liste de DTO minimaux contenant uniquement :

- `inventory_item_id` ;
- `inventory_item_name` ;
- `inventory_item_kind` ;
- `start_at` ;
- `end_at` ;
- `status`.

L'endpoint n'expose ni conflits ni objets de validation internes. Il reste GET-only, n'ecrit jamais en DB et ne cree aucune reservation persistante.

F62 ne cree aucun `models.py`, aucun `admin.py`, aucun dossier `migrations/`, aucune API d'ecriture, aucun workflow frontend de reservation ou de login, aucun contrat, facture, paiement, client, stock, quantite, unite, pricing ou workflow commercial.

## Reservation item availability preview API

F69 ajoute une surface authentifiee et read-only pour inspecter la disponibilite d'un item Titan sur une periode :

- `GET /api/v1/reservations/items/<uuid:inventory_item_id>/availability-preview/`.

L'endpoint valide `start_at` et `end_at`, resout uniquement un `InventoryItem` actif et non supprime, puis delegue exclusivement a `preview_reservation_item_service`.

La reponse expose seulement l'identite minimale de l'item, la periode, le statut public `available` ou `unavailable`, et `conflict_count`. Les identifiants de conflits, notes, donnees d'audit, objets `InventoryAvailability` et objets de validation internes restent masques.

F69 reste GET-only et ne cree aucun `models.py`, `admin.py`, dossier `migrations/`, frontend, modele, migration, reservation persistante, API d'ecriture, contrat, facture, paiement, client, stock, quantite, unite, pricing ou workflow commercial.

## Frontend availability consumption

F63 ajoute uniquement un panneau frontend qui consomme les endpoints read-only F61 et F62. F63 ne modifie aucun serializer, view, URL, service ou comportement backend reservations.

Le panneau affiche une consultation de disponibilite et ne cree aucune reservation persistante. Il ne cree aucune API d'ecriture, logique de login frontend, workflow de reservation, contrat, facture, paiement, client, stock, quantite, unite, pricing ou workflow commercial.

## MVP local demo flow

F65 documente un parcours local qui combine les seeds techniques inventory et les endpoints reservations read-only existants. Il ne modifie aucun service, serializer, view ou URL reservations.

Une ligne `InventoryAvailability` avec le statut technique `reserved` ne constitue pas une reservation metier persistante. Le domaine reservations reste sans modele, migration, admin et API d'ecriture.

## Reservation item preview

F38 ajoute `preview.py` comme value object interne pour preparer une future demande de reservation item.

Objets exposes :

- `ReservationItemPreviewStatus` ;
- `ReservationItemPreview` ;
- `preview_reservation_item_request`.

Les statuts possibles sont :

- `invalid` ;
- `unavailable` ;
- `available`.

La preview compose uniquement le helper F37 `validate_reservation_item_availability_request`. Elle n'appelle pas directement les helpers inventory de conflits et ne double pas la lecture DB.

`period` vaut `None` lorsque la validation F37 echoue. `conflicts` vaut `()` lorsque F37 ne retourne pas de details. `inventory_unit_count` reste `None` tant qu'aucun champ quantite, unite ou stock n'existe sur `InventoryItem`.

F38 ne cree aucune reservation persistante, n'ecrit jamais en DB, ne fait aucun calcul commercial et ne cree aucun devis.

Titan reste strictement limite a :

- `material` ;
- `article` ;
- `material_pack`.

Titan exclut toujours :

- local ;
- salle ;
- lieu ;
- service annexe ;
- service evenementiel.

F38 ne cree aucun modele, migration, serializer, view, URL, endpoint, admin, service metier complet, contrat, facture, paiement, client ou frontend.

## Reservation draft foundation

F100 introduces persistent reservation drafts for the MVP.

The new draft foundation adds:

- `ReservationDraft`;
- `ReservationDraftLine`;
- authenticated draft list/create/detail endpoints;
- a DEBUG-only local demo seed command.

F100 allows draft-only creation through the API. It does not confirm reservations,
does not create invoices, does not create contracts, does not process payments,
does not generate PDFs and does not write `InventoryAvailability` rows.

Drafts are preparation records only. A draft line references an existing active
Titan `InventoryItem`, and a draft references an active `Customer`.

The allowed reservation draft status is currently only `draft`.

## Reservation confirmation preflight

F121E adds `confirmation.py` as a narrow internal read-only preflight helper for
future reservation confirmation.

Exposed dataclass:

- `ReservationDraftConfirmationPreflight`.

Exposed function:

- `get_reservation_draft_confirmation_preflight`.

The helper evaluates a persisted `ReservationDraft` and reports explicit
blockers for future confirmation readiness, including:

- reservation-sensitive staff actor authorization;
- actor attribution capture readiness;
- soft-deleted draft rejection;
- presence of active draft lines;
- availability revalidation through the existing reservations availability helper;
- still-missing signed contract prerequisite;
- still-missing deposit received prerequisite.

The blocker vocabulary intentionally stays aligned with the accepted
machine-readable confirmation categories from DEC-005, but this preflight
remains an internal advisory helper only. It must not be treated as authority
to confirm, and it must not be exposed as a public API contract without an
explicit later slice.

The preflight result reports only `attribution_ready`. It does not expose or
persist confirmation attribution metadata. Future confirmation must capture
durable attribution again inside the real transactional write.

F121E stays strictly backend-internal and read-only. It does not:

- confirm a reservation draft;
- create a confirmation endpoint, serializer, view or URL;
- add a confirmed status;
- write audit rows;
- create `InventoryAvailability` rows;
- add attribution fields to reservation models;
- add signed-contract or deposit/payment models.

## Confirmation prerequisite markers

F121F adds the smallest durable confirmation prerequisite markers directly on
`ReservationDraft`:

- `contract_signed_at`;
- `contract_signed_by`;
- `required_deposit_received_at`;
- `required_deposit_received_by`.

F121F also adds two internal transaction-safe write helpers in
`confirmation.py`:

- `mark_reservation_draft_contract_signed`;
- `mark_reservation_draft_required_deposit_received`.

These helpers:

- require reservation-sensitive staff authorization;
- require durable actor attribution capture;
- lock the draft row with `select_for_update()`;
- refuse soft-deleted or non-draft reservation drafts;
- persist only the smallest prerequisite markers.

F121F updates the existing preflight so contract/deposit blockers disappear only
when both timestamp and actor are durable for the corresponding prerequisite.

F121F deliberately does not implement the actual confirmation write. That part
is deferred because the repository does not yet expose a narrow, reviewed,
durable inventory-blocking primitive tied to reservation confirmation.

F121F does not add:

- confirmation endpoint, serializer, view or URL;
- confirmed status or durable confirmed reservation state;
- `InventoryAvailability` confirmation side effects;
- audit event writes for confirmation;
- contract PDF/document lifecycle;
- payment provider, invoice, receipt or accounting workflow.

## Transactional reservation confirmation

F121G adds the first backend-internal transactional reservation confirmation
write.

It adds:

- a durable confirmed reservation state on `ReservationDraft`;
- a narrow durable `InventoryAvailability -> ReservationDraft` link for
  confirmation blocking rows;
- `confirm_reservation_draft` in `confirmation.py`;
- success audit scheduling through the existing transaction-safe audit helper.

The confirmation flow:

- requires reservation-sensitive staff authorization;
- requires durable attribution capture;
- locks the reservation draft row;
- locks the active draft lines;
- locks the targeted inventory items before revalidating availability;
- reuses the existing preflight as the internal gate;
- creates durable `InventoryAvailability` rows with `reserved` status for each
  active line;
- persists the confirmed reservation state in the same transaction;
- schedules success audit only on commit.

F121G remains backend-internal only. It does not add:

- confirmation API, serializer, view or URL;
- admin UI;
- contract PDF/document lifecycle;
- payment/invoice/receipt/accounting workflow;
- quantity allocation, stock movement or inventory accounting model;
- frontend behavior.
