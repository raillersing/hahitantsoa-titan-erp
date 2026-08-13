from __future__ import annotations

from apps.notifications.models import NotificationType, SystemNotification


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
