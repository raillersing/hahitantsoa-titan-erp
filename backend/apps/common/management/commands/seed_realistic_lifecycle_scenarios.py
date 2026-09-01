"""Create realistic, service-backed lifecycle scenarios for local acceptance checks."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.billing.services import (
    issue_billing_invoice_for_excess_receivable,
    settle_billing_invoice,
)
from apps.customers.models import (
    Customer,
    CustomerContactKind,
    CustomerContactPoint,
    CustomerLifecycleStatus,
    CustomerPartyType,
    ProspectStatus,
)
from apps.customers.services import transition_prospect_status
from apps.documents.services import (
    create_document_instance_from_hahitantsoa_event_draft,
    create_document_instance_from_reservation_draft,
    generate_document_instance_pdf,
    generate_hahitantsoa_event_draft_document_instance_html,
    generate_reservation_draft_document_instance_html,
)
from apps.hahitantsoa.commercial_terms import recalculate_hahitantsoa_event_draft_totals
from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventDraftLine
from apps.hahitantsoa.services import (
    confirm_hahitantsoa_event_draft,
    mark_hahitantsoa_event_draft_contract_signed,
    mark_hahitantsoa_event_draft_required_deposit_received,
)
from apps.inventory.models import InventoryItem
from apps.inventory.services import (
    create_inventory_damage_loss_settlement,
    create_inventory_damage_loss_settlement_execution,
    create_inventory_return_operation,
    execute_inventory_damage_loss_settlement_execution,
    validate_inventory_damage_loss_settlement,
    validate_inventory_return_operation,
)
from apps.logistics.models import LogisticsEventStatus, LogisticsEventType, LogisticsOperationKind
from apps.logistics.services import (
    add_item_line_to_logistics_event,
    complete_handover_passation,
    create_logistics_event,
    transition_logistics_event_status,
)
from apps.payments.models import PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.services import confirm_payment, create_payment
from apps.reservations.closeout import closeout_reservation_draft
from apps.reservations.commercial import recalculate_reservation_draft_totals
from apps.reservations.confirmation import (
    confirm_reservation_draft,
    mark_reservation_draft_contract_signed,
    mark_reservation_draft_required_deposit_received,
)
from apps.reservations.models import ReservationDraft, ReservationDraftLine


class Command(BaseCommand):
    help = "Seed local realistic Titan and Hahitantsoa lifecycle scenarios."

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG:
            raise CommandError("Refusing realistic lifecycle scenarios when DEBUG is False.")

        actor = get_user_model().objects.filter(is_active=True).order_by("id").first()
        if actor is None:
            raise CommandError("A preserved active user is required for lifecycle attribution.")
        items = tuple(
            InventoryItem.objects.filter(is_active=True, is_deleted=False)
            .filter(kind__in=("material", "article", "material_pack"))
            .order_by("name", "id")
        )
        if len(items) < 2:
            raise CommandError("At least two active rental inventory items are required.")

        with transaction.atomic():
            self._seed_titan_prospect(actor=actor, item=items[0])
            self._seed_titan_confirmed(actor=actor, item=items[1])
            self._seed_hahitantsoa_confirmed(actor=actor, item=items[0])
            self._seed_titan_closed(actor=actor, item=items[0])
            self._seed_titan_damage_follow_up(actor=actor, item=items[1])

        self.stdout.write(self.style.SUCCESS("Realistic lifecycle base scenarios created."))

    @staticmethod
    def _safe_future_start(*, days: int):
        local = timezone.localtime(timezone.now()) + timedelta(days=days)
        while local.weekday() == 6:
            local += timedelta(days=1)
        return local.replace(hour=10, minute=0, second=0, microsecond=0)

    @staticmethod
    def _safe_past_start(*, days: int):
        return Command._safe_future_start(days=-abs(days))

    @staticmethod
    def _customer(*, display_name: str, **defaults) -> Customer:
        customer, _ = Customer.objects.update_or_create(
            display_name=display_name,
            defaults={"is_deleted": False, "deleted_at": None, **defaults},
        )
        return customer

    @staticmethod
    def _contact(*, customer: Customer, kind: str, value: str, label: str, primary: bool) -> None:
        CustomerContactPoint.objects.update_or_create(
            customer=customer,
            kind=kind,
            value=value,
            defaults={"label": label, "is_primary": primary},
        )

    def _emit_titan_document(self, *, draft, actor, template_key: str) -> None:
        instance = create_document_instance_from_reservation_draft(
            reservation_draft=draft,
            template_key=template_key,
            actor=actor,
            notes="Simulation de parcours réaliste.",
        )
        instance = generate_reservation_draft_document_instance_html(
            reservation_draft=draft,
            document_instance_id=instance.id,
            actor=actor,
        )
        generate_document_instance_pdf(document_instance=instance, actor=actor)

    def _emit_hahitantsoa_document(self, *, event, actor, template_key: str) -> None:
        instance = create_document_instance_from_hahitantsoa_event_draft(
            event_draft=event,
            template_key=template_key,
            actor=actor,
            notes="Simulation de parcours réaliste.",
        )
        instance = generate_hahitantsoa_event_draft_document_instance_html(
            event_draft=event,
            document_instance_id=instance.id,
            actor=actor,
        )
        generate_document_instance_pdf(document_instance=instance, actor=actor)

    @staticmethod
    def _emit_payment_receipt_pdf(*, payment, actor) -> None:
        payment.refresh_from_db()
        generate_document_instance_pdf(document_instance=payment.receipt_document, actor=actor)

    def _seed_titan_prospect(self, *, actor, item: InventoryItem) -> None:
        customer = self._customer(
            display_name="Orange Madagascar S.A.",
            lifecycle_status=CustomerLifecycleStatus.PROSPECT,
            party_type=CustomerPartyType.COMPANY,
            email="achats@orange.mg",
            phone="+261 34 00 000 01",
            address="Ankorondrano, Antananarivo",
            nif="2000000001",
            stat="62001 11 2024 0 00001",
            representative_name="Voahirana Ravelomanantsoa",
            representative_role="Responsable achats",
        )
        self._contact(
            customer=customer,
            kind=CustomerContactKind.EMAIL,
            value=customer.email,
            label="Achats",
            primary=True,
        )
        self._contact(
            customer=customer,
            kind=CustomerContactKind.PHONE,
            value=customer.phone,
            label="Standard",
            primary=True,
        )
        customer = transition_prospect_status(
            customer=customer,
            target_status=ProspectStatus.CONTACTED,
            actor=actor,
            reason="Qualification commerciale avant émission de proforma.",
        )
        transition_prospect_status(
            customer=customer,
            target_status=ProspectStatus.QUALIFIED,
            actor=actor,
            reason="Besoin matériel et période qualifiés.",
        )
        start_at = self._safe_future_start(days=21)
        draft, _ = ReservationDraft.objects.update_or_create(
            public_reference="T-001/2026",
            defaults={
                "customer": customer,
                "start_at": start_at,
                "end_at": start_at + timedelta(hours=8),
                "notes": "Proforma pour sonorisation d'une conférence interne.",
                "created_by": actor,
                "updated_by": actor,
                "is_deleted": False,
                "deleted_at": None,
            },
        )
        ReservationDraftLine.objects.update_or_create(
            reservation_draft=draft,
            inventory_item=item,
            defaults={
                "quantity": 2,
                "unit_rental_price": Decimal("250000.00"),
                "created_by": actor,
                "updated_by": actor,
            },
        )
        recalculate_reservation_draft_totals(reservation_draft=draft)
        self._emit_titan_document(draft=draft, actor=actor, template_key="titan.proforma.v1")

    def _seed_titan_confirmed(self, *, actor, item: InventoryItem) -> None:
        customer = self._customer(
            display_name="Andry Rakotomalala",
            lifecycle_status=CustomerLifecycleStatus.CLIENT,
            party_type=CustomerPartyType.INDIVIDUAL,
            email="andry.rakotomalala@example.mg",
            phone="+261 34 12 345 67",
            address="Lot II K 42, Ambohijatovo, Antananarivo",
            civilite="M.",
            id_type="CIN",
            id_number="101 231 456 789",
        )
        self._contact(
            customer=customer,
            kind=CustomerContactKind.EMAIL,
            value=customer.email,
            label="Personnel",
            primary=True,
        )
        self._contact(
            customer=customer,
            kind=CustomerContactKind.PHONE,
            value=customer.phone,
            label="Mobile",
            primary=True,
        )
        start_at = self._safe_future_start(days=28)
        draft, _ = ReservationDraft.objects.update_or_create(
            public_reference="T-002/2026",
            defaults={
                "customer": customer,
                "start_at": start_at,
                "end_at": start_at + timedelta(hours=12),
                "notes": "Location de matériel pour réception familiale.",
                "created_by": actor,
                "updated_by": actor,
                "is_deleted": False,
                "deleted_at": None,
            },
        )
        ReservationDraftLine.objects.update_or_create(
            reservation_draft=draft,
            inventory_item=item,
            defaults={
                "quantity": 3,
                "unit_rental_price": Decimal("180000.00"),
                "created_by": actor,
                "updated_by": actor,
            },
        )
        recalculate_reservation_draft_totals(reservation_draft=draft)
        self._emit_titan_document(draft=draft, actor=actor, template_key="titan.proforma.v1")
        self._emit_titan_document(
            draft=draft, actor=actor, template_key="titan.material_contract.v1"
        )
        mark_reservation_draft_contract_signed(reservation_draft=draft, actor=actor)
        payment = create_payment(
            actor=actor,
            reservation_draft=draft,
            payment_kind=PaymentKind.DEPOSIT,
            payment_method=PaymentMethod.MOBILE_MONEY,
            payment_status=PaymentStatus.PENDING,
            amount=draft.required_deposit_amount,
            source_label="Acompte contractuel Titan",
        )
        confirm_payment(payment=payment, actor=actor, external_reference="MVOLA-T002-2026")
        self._emit_payment_receipt_pdf(payment=payment, actor=actor)
        mark_reservation_draft_required_deposit_received(reservation_draft=draft, actor=actor)
        confirm_reservation_draft(reservation_draft=draft, actor=actor)

    def _seed_hahitantsoa_confirmed(self, *, actor, item: InventoryItem) -> None:
        customer = self._customer(
            display_name="Hanta Rasoanirina",
            lifecycle_status=CustomerLifecycleStatus.CLIENT,
            party_type=CustomerPartyType.INDIVIDUAL,
            email="hanta.rasoanirina@example.mg",
            phone="+261 33 45 678 90",
            address="Ambohidratrimo, Antananarivo",
            civilite="Mme",
        )
        self._contact(
            customer=customer,
            kind=CustomerContactKind.EMAIL,
            value=customer.email,
            label="Personnel",
            primary=True,
        )
        self._contact(
            customer=customer,
            kind=CustomerContactKind.PHONE,
            value=customer.phone,
            label="Mobile",
            primary=True,
        )
        start_at = self._safe_future_start(days=35)
        event, _ = HahitantsoaEventDraft.objects.update_or_create(
            public_reference="H-001/2026",
            defaults={
                "customer": customer,
                "event_name": "Mariage de Hanta et Tovo",
                "event_type": "wedding",
                "rental_type": "logistics",
                "guest_count": 250,
                "venue_name": "Hahitantsoa, Ambohidratrimo",
                "start_at": start_at,
                "end_at": start_at + timedelta(hours=10),
                "space_rental_amount": Decimal("12000000.00"),
                "required_deposit_amount": Decimal("10000000.00"),
                "notes": "Mariage avec matériel et coordination logistique.",
                "created_by": actor,
                "updated_by": actor,
                "is_deleted": False,
                "deleted_at": None,
            },
        )
        HahitantsoaEventDraftLine.objects.update_or_create(
            event_draft=event,
            inventory_item=item,
            defaults={
                "quantity": 4,
                "unit_rental_price": Decimal("300000.00"),
                "created_by": actor,
                "updated_by": actor,
            },
        )
        recalculate_hahitantsoa_event_draft_totals(event_draft=event)
        event.required_deposit_amount = Decimal("10000000.00")
        event.save(update_fields=["required_deposit_amount", "updated_at"])
        self._emit_hahitantsoa_document(
            event=event, actor=actor, template_key="hahitantsoa.proforma.v1"
        )
        self._emit_hahitantsoa_document(
            event=event, actor=actor, template_key="hahitantsoa.contract.v1"
        )
        mark_hahitantsoa_event_draft_contract_signed(event_draft=event, actor=actor)
        payment = create_payment(
            actor=actor,
            hahitantsoa_event_draft=event,
            payment_kind=PaymentKind.DEPOSIT,
            payment_method=PaymentMethod.BANK_TRANSFER,
            payment_status=PaymentStatus.PENDING,
            amount=event.required_deposit_amount,
            source_label="Acompte contractuel Hahitantsoa",
        )
        confirm_payment(payment=payment, actor=actor, external_reference="BNI-H001-2026")
        self._emit_payment_receipt_pdf(payment=payment, actor=actor)
        mark_hahitantsoa_event_draft_required_deposit_received(event_draft=event, actor=actor)
        confirm_hahitantsoa_event_draft(event_draft=event, actor=actor)

    def _confirmed_titan_draft(
        self,
        *,
        actor,
        item: InventoryItem,
        reference: str,
        customer: Customer,
        start_at,
        notes: str,
    ) -> ReservationDraft:
        draft = ReservationDraft.objects.create(
            public_reference=reference,
            customer=customer,
            start_at=start_at,
            end_at=start_at + timedelta(hours=8),
            notes=notes,
            created_by=actor,
            updated_by=actor,
        )
        ReservationDraftLine.objects.create(
            reservation_draft=draft,
            inventory_item=item,
            quantity=2,
            unit_rental_price=Decimal("225000.00"),
            created_by=actor,
            updated_by=actor,
        )
        recalculate_reservation_draft_totals(reservation_draft=draft)
        self._emit_titan_document(draft=draft, actor=actor, template_key="titan.proforma.v1")
        self._emit_titan_document(
            draft=draft, actor=actor, template_key="titan.material_contract.v1"
        )
        mark_reservation_draft_contract_signed(reservation_draft=draft, actor=actor)
        payment = create_payment(
            actor=actor,
            reservation_draft=draft,
            payment_kind=PaymentKind.DEPOSIT,
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PENDING,
            amount=draft.required_deposit_amount,
            source_label="Acompte contractuel Titan",
        )
        confirm_payment(payment=payment, actor=actor, external_reference=f"ESP-{reference}")
        self._emit_payment_receipt_pdf(payment=payment, actor=actor)
        mark_reservation_draft_required_deposit_received(reservation_draft=draft, actor=actor)
        confirm_reservation_draft(reservation_draft=draft, actor=actor)
        return draft

    def _complete_titan_handover(self, *, actor, draft: ReservationDraft, item: InventoryItem):
        scheduled_at = draft.start_at - timedelta(days=1)
        while timezone.localtime(scheduled_at).weekday() == 6:
            scheduled_at -= timedelta(days=1)
        event = create_logistics_event(
            actor=actor,
            reservation_draft=draft,
            event_type=LogisticsEventType.HANDOVER,
            scheduled_at=scheduled_at,
            address=draft.customer.address,
            contact_name=draft.customer.display_name,
            contact_phone=draft.customer.phone,
            notes="Passation de la simulation après événement.",
            signature_required=True,
        )
        add_item_line_to_logistics_event(actor=actor, event=event, inventory_item=item, quantity=2)
        event = transition_logistics_event_status(
            actor=actor, event=event, new_status=LogisticsEventStatus.DISPATCHED
        )
        event = transition_logistics_event_status(
            actor=actor,
            event=event,
            new_status=LogisticsEventStatus.COMPLETED,
            executed_at=scheduled_at,
        )
        event, delivery_document = complete_handover_passation(
            actor=actor,
            event=event,
            signed_at=scheduled_at,
        )
        return event, delivery_document

    def _return_titan_items(
        self,
        *,
        actor,
        draft: ReservationDraft,
        handover_event,
        delivery_document,
        item: InventoryItem,
        damaged_quantity: int = 0,
        notes: str,
    ):
        return_scheduled_at = draft.end_at + timedelta(hours=1)
        return_event = create_logistics_event(
            actor=actor,
            reservation_draft=draft,
            event_type=LogisticsEventType.PICKUP,
            operation=LogisticsOperationKind.RETURN,
            scheduled_at=return_scheduled_at,
            address=draft.customer.address,
            contact_name=draft.customer.display_name,
            contact_phone=draft.customer.phone,
            notes="Collecte après location pour contrôle contradictoire.",
        )
        return_event = transition_logistics_event_status(
            actor=actor,
            event=return_event,
            new_status=LogisticsEventStatus.DISPATCHED,
        )
        return_event = transition_logistics_event_status(
            actor=actor,
            event=return_event,
            new_status=LogisticsEventStatus.COMPLETED,
            executed_at=return_scheduled_at,
        )
        condition_status = (
            "intact" if damaged_quantity == 0 else "damaged" if damaged_quantity == 2 else "mixed"
        )
        operation = create_inventory_return_operation(
            actor=actor,
            reservation_draft=draft,
            logistics_event=return_event,
            document_instance=delivery_document,
            idempotency_key=f"simulation-return-{draft.public_reference}",
            notes=notes,
            lines=[
                {
                    "inventory_item_id": item.id,
                    "expected_quantity": 2,
                    "returned_quantity": 2,
                    "damaged_quantity": damaged_quantity,
                    "missing_quantity": 0,
                    "condition_status": condition_status,
                    "notes": notes,
                }
            ],
        )
        # ponytail: the validation service returns the locked, persisted instance;
        # downstream settlement creation must use that validated state rather than
        # the pre-validation in-memory draft instance.
        operation = validate_inventory_return_operation(
            return_operation=operation, actor=actor
        ).return_operation
        self._emit_titan_document(draft=draft, actor=actor, template_key="shared.return_note.v1")
        return operation

    def _seed_titan_closed(self, *, actor, item: InventoryItem) -> None:
        customer = self._customer(
            display_name="Agence Blue Event SARL",
            lifecycle_status=CustomerLifecycleStatus.CLIENT,
            party_type=CustomerPartyType.COMPANY,
            email="operations@blue-event.mg",
            phone="+261 32 11 223 34",
            address="Ivandry, Antananarivo",
            nif="2000000043",
            stat="82301 11 2025 0 00022",
            representative_name="Mamy Randriamihaja",
            representative_role="Gérant",
        )
        self._contact(
            customer=customer,
            kind=CustomerContactKind.EMAIL,
            value=customer.email,
            label="Opérations",
            primary=True,
        )
        self._contact(
            customer=customer,
            kind=CustomerContactKind.PHONE,
            value=customer.phone,
            label="Mobile",
            primary=True,
        )
        draft = self._confirmed_titan_draft(
            actor=actor,
            item=item,
            reference="T-003/2026",
            customer=customer,
            start_at=self._safe_past_start(days=28),
            notes="Location clôturée après retour conforme.",
        )
        handover_event, delivery_document = self._complete_titan_handover(
            actor=actor, draft=draft, item=item
        )
        self._return_titan_items(
            actor=actor,
            draft=draft,
            handover_event=handover_event,
            delivery_document=delivery_document,
            item=item,
            notes="Retour contrôlé conforme.",
        )
        self._emit_titan_document(draft=draft, actor=actor, template_key="titan.invoice.v1")
        closeout_reservation_draft(
            reservation_draft=draft,
            actor=actor,
            idempotency_key="simulation-closeout-T-003-2026",
        )

    def _seed_titan_damage_follow_up(self, *, actor, item: InventoryItem) -> None:
        customer = self._customer(
            display_name="Faly Ranaivo",
            lifecycle_status=CustomerLifecycleStatus.CLIENT,
            party_type=CustomerPartyType.INDIVIDUAL,
            email="faly.ranaivo@example.mg",
            phone="+261 34 98 765 43",
            address="Andraharo, Antananarivo",
            civilite="M.",
            id_type="CIN",
            id_number="101 458 922 345",
        )
        self._contact(
            customer=customer,
            kind=CustomerContactKind.EMAIL,
            value=customer.email,
            label="Personnel",
            primary=True,
        )
        self._contact(
            customer=customer,
            kind=CustomerContactKind.PHONE,
            value=customer.phone,
            label="Mobile",
            primary=True,
        )
        draft = self._confirmed_titan_draft(
            actor=actor,
            item=item,
            reference="T-004/2026",
            customer=customer,
            start_at=self._safe_past_start(days=14),
            notes="Retour avec avarie et dédommagement client.",
        )
        handover_event, delivery_document = self._complete_titan_handover(
            actor=actor, draft=draft, item=item
        )
        operation = self._return_titan_items(
            actor=actor,
            draft=draft,
            handover_event=handover_event,
            delivery_document=delivery_document,
            item=item,
            damaged_quantity=1,
            notes="Une enceinte présente une avarie constatée contradictoirement.",
        )
        settlement = create_inventory_damage_loss_settlement(
            actor=actor,
            return_operation=operation,
            notes="Dédommagement pour avarie constatée.",
            lines=[
                {
                    "return_operation_line": operation.lines.get(),
                    "settlement_line_kind": "damage",
                    "quantity": 1,
                    "unit_amount": Decimal("100000.00"),
                    "notes": "Réparation de l'enceinte endommagée.",
                }
            ],
        )
        # ponytail: execution must receive the locked, persisted settlement returned
        # by validation, not the pre-validation in-memory draft instance.
        settlement = validate_inventory_damage_loss_settlement(
            settlement=settlement, actor=actor
        ).settlement
        execution = create_inventory_damage_loss_settlement_execution(
            settlement=settlement, actor=actor
        )
        execution_result = execute_inventory_damage_loss_settlement_execution(
            execution=execution, actor=actor
        )
        invoice = issue_billing_invoice_for_excess_receivable(
            excess_receivable=execution_result.excess_receivable,
            actor=actor,
            notes="Facture de dédommagement casse et dégradation.",
        )
        generate_document_instance_pdf(document_instance=invoice.document_instance, actor=actor)
        payment = create_payment(
            actor=actor,
            reservation_draft=draft,
            payment_kind=PaymentKind.BALANCE,
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PENDING,
            amount=invoice.amount,
            source_label="Règlement de la facture de dédommagement",
        )
        confirm_payment(payment=payment, actor=actor, external_reference="ESP-T004-FC")
        self._emit_payment_receipt_pdf(payment=payment, actor=actor)
        settle_billing_invoice(invoice=invoice, payment=payment, actor=actor)
