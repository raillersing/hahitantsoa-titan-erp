from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.notifications.models import (
    NotificationType,
    PaymentReminderDispatch,
    SystemNotification,
)
from apps.payments.reminders import (
    build_hahitantsoa_payment_reminder,
    build_reservation_payment_reminder,
)
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.reservations.models import ReservationDraft


def create_payment_confirmation_notification(*, payment, recipient=None) -> SystemNotification:
    """Create the internal notification for a successfully confirmed payment."""
    link = f"/payments/{payment.id}"
    recipient_id = getattr(recipient, "pk", None)
    if recipient_id is None:
        recipient_id = getattr(payment, "confirmed_by_id", None)
    reference = ""
    if payment.reservation_draft_id and payment.reservation_draft is not None:
        reference = payment.reservation_draft.public_reference
    elif payment.hahitantsoa_event_draft_id and payment.hahitantsoa_event_draft is not None:
        reference = payment.hahitantsoa_event_draft.public_reference

    context = f" pour {reference}" if reference else ""
    notification, _ = SystemNotification.objects.get_or_create(
        notification_type=NotificationType.PAYMENT,
        link=link,
        recipient_id=recipient_id,
        defaults={
            "title": "Paiement confirmé",
            "message": (
                f"Le paiement de {payment.amount} MGA a été confirmé"
                f"{context} ({payment.payment_method})."
            ),
            "severity": "success",
        },
    )
    return notification


@transaction.atomic
def prepare_payment_reminder_dispatch(
    *,
    actor,
    reservation_draft: ReservationDraft | None = None,
    hahitantsoa_event_draft: HahitantsoaEventDraft | None = None,
    reminder_key: str = "payment_due",
) -> PaymentReminderDispatch:
    if bool(reservation_draft) == bool(hahitantsoa_event_draft):
        raise ValueError("A reminder must target exactly one business draft.")
    if reservation_draft is not None:
        reminder = build_reservation_payment_reminder(reservation_draft=reservation_draft)
    else:
        reminder = build_hahitantsoa_payment_reminder(
            hahitantsoa_event_draft=hahitantsoa_event_draft
        )
    defaults = {
        "message": reminder.message,
        "whatsapp_url": reminder.whatsapp_url or "",
        "prepared_by": actor,
        "prepared_at": timezone.now(),
    }
    lookup = {
        "reservation_draft": reservation_draft,
        "hahitantsoa_event_draft": hahitantsoa_event_draft,
        "reminder_key": reminder_key,
    }
    dispatch, created = PaymentReminderDispatch.objects.select_for_update().get_or_create(
        **lookup, defaults=defaults
    )
    if not created:
        dispatch.message = reminder.message
        dispatch.whatsapp_url = reminder.whatsapp_url or ""
        dispatch.prepared_by = actor
        dispatch.prepared_at = timezone.now()
        dispatch.save(
            update_fields=["message", "whatsapp_url", "prepared_by", "prepared_at", "updated_at"]
        )
    reference = reminder.reference
    recipient = getattr(actor, "pk", None)
    SystemNotification.objects.get_or_create(
        recipient_id=recipient,
        notification_type=NotificationType.PAYMENT,
        link=f"/payment-reminders/{dispatch.id}",
        defaults={
            "title": "Rappel de paiement prêt",
            "message": f"Le rappel du dossier {reference} est prêt à être relu et envoyé.",
            "severity": "info",
        },
    )
    return dispatch
