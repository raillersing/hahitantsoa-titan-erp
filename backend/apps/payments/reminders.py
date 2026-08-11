from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal
from urllib.parse import quote

from django.utils import timezone

from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.payments.models import CONFIRMED_PAYMENT_STATUS_VALUES, Payment, PaymentKind
from apps.reservations.models import ReservationDraft

_DIGITS_ONLY = re.compile(r"\D+")


@dataclass(frozen=True)
class PaymentReminder:
    business_scope: str
    draft_id: str
    reference: str
    customer_name: str
    customer_phone: str
    event_label: str
    start_at: object
    end_at: object
    confirmed_payment_count: int
    confirmed_amount: Decimal
    refunded_amount: Decimal
    net_amount: Decimal
    payments: tuple[dict[str, object], ...]
    message: str
    whatsapp_url: str | None


def _format_amount(amount: Decimal) -> str:
    return f"{amount:,.2f}".replace(",", " ").replace(".", ",")


def _format_datetime(value) -> str:
    return timezone.localtime(value).strftime("%d/%m/%Y à %H:%M")


def _international_whatsapp_number(phone: str) -> str | None:
    normalized = (phone or "").strip()
    if normalized.startswith("+"):
        normalized = normalized[1:]
    elif normalized.startswith("00"):
        normalized = normalized[2:]
    else:
        return None
    digits = _DIGITS_ONLY.sub("", normalized)
    if len(digits) < 8 or len(digits) > 15 or digits.startswith("0"):
        return None
    return digits


def _payment_rows(*, payments: list[Payment]) -> tuple[dict[str, object], ...]:
    return tuple(
        {
            "id": str(payment.id),
            "kind": payment.get_payment_kind_display(),
            "method": payment.get_payment_method_display(),
            "amount": str(payment.amount),
            "status": payment.payment_status,
            "paid_at": payment.paid_at,
            "external_reference": payment.external_reference,
        }
        for payment in payments
    )


def _build_reminder(*, business_scope: str, draft, payments: list[Payment]) -> PaymentReminder:
    customer = draft.customer
    confirmed_amount = sum(
        (payment.amount for payment in payments if payment.payment_kind != PaymentKind.REFUND),
        Decimal("0.00"),
    )
    refunded_amount = sum(
        (payment.amount for payment in payments if payment.payment_kind == PaymentKind.REFUND),
        Decimal("0.00"),
    )
    net_amount = confirmed_amount - refunded_amount
    if business_scope == "titan":
        event_label = "réservation de matériel Titan"
    else:
        event_label = f"événement Hahitantsoa — {draft.event_name}"

    lines = [
        f"Bonjour {customer.display_name},",
        f"Voici le rappel de paiement pour votre {event_label}.",
        f"Dossier : {draft.public_reference}",
        f"Période : {_format_datetime(draft.start_at)} au {_format_datetime(draft.end_at)}",
        "",
        "Paiements enregistrés :",
    ]
    if payments:
        lines.extend(
            f"- {payment.get_payment_kind_display()} ({payment.get_payment_method_display()}) : "
            f"{_format_amount(payment.amount)} MGA"
            + (f" le {_format_datetime(payment.paid_at)}" if payment.paid_at else "")
            for payment in payments
        )
    else:
        lines.append("- Aucun paiement confirmé à ce jour.")
    lines.extend(
        [
            "",
            f"Total confirmé : {_format_amount(confirmed_amount)} MGA",
            f"Remboursements : {_format_amount(refunded_amount)} MGA",
            f"Net enregistré : {_format_amount(net_amount)} MGA",
            "Merci de nous contacter pour toute question.",
        ]
    )
    message = "\n".join(lines)
    whatsapp_number = _international_whatsapp_number(customer.phone)
    whatsapp_url = (
        f"https://wa.me/{whatsapp_number}?text={quote(message)}" if whatsapp_number else None
    )
    return PaymentReminder(
        business_scope=business_scope,
        draft_id=str(draft.id),
        reference=draft.public_reference,
        customer_name=customer.display_name,
        customer_phone=customer.phone,
        event_label=event_label,
        start_at=draft.start_at,
        end_at=draft.end_at,
        confirmed_payment_count=len(payments),
        confirmed_amount=confirmed_amount,
        refunded_amount=refunded_amount,
        net_amount=net_amount,
        payments=_payment_rows(payments=payments),
        message=message,
        whatsapp_url=whatsapp_url,
    )


def _payments_for_draft(
    *, reservation_draft_id=None, hahitantsoa_event_draft_id=None
) -> list[Payment]:
    return list(
        Payment.objects.filter(
            reservation_draft_id=reservation_draft_id,
            hahitantsoa_event_draft_id=hahitantsoa_event_draft_id,
            payment_status__in=CONFIRMED_PAYMENT_STATUS_VALUES,
        ).order_by("paid_at", "created_at", "id")
    )


def build_reservation_payment_reminder(*, reservation_draft: ReservationDraft) -> PaymentReminder:
    return _build_reminder(
        business_scope="titan",
        draft=reservation_draft,
        payments=_payments_for_draft(reservation_draft_id=reservation_draft.id),
    )


def build_hahitantsoa_payment_reminder(
    *, hahitantsoa_event_draft: HahitantsoaEventDraft
) -> PaymentReminder:
    return _build_reminder(
        business_scope="hahitantsoa",
        draft=hahitantsoa_event_draft,
        payments=_payments_for_draft(hahitantsoa_event_draft_id=hahitantsoa_event_draft.id),
    )
