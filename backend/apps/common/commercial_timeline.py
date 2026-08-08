"""Commercial timeline aggregator for a unified customer chronology."""

from uuid import UUID

from django.db.models import Q

from apps.audit.models import AuditEvent
from apps.billing.models import BillingInvoice
from apps.customers.models import ProspectStatus
from apps.documents.models import DocumentInstance
from apps.logistics.models import LogisticsEvent
from apps.payments.models import Payment
from apps.reservations.models import ReservationDraft
from apps.visits.models import VisitAppointment


def _safe_dt(value):
    return value.isoformat() if value else None


def _prospect_transitions(customer_id: UUID) -> list[dict]:
    events = []
    # Audit events for prospect status changes on this customer
    audit_events = AuditEvent.objects.filter(
        action="customer.prospect_status_changed",
        target_type="customer",
        target_id=str(customer_id),
    ).order_by("created_at")
    for audit in audit_events:
        meta = audit.metadata or {}
        prev = meta.get("previous_status", "")
        new = meta.get("new_status", "")
        events.append(
            {
                "date": _safe_dt(audit.created_at),
                "type": "prospect_transition",
                "title": (
                    f"Prospect : {ProspectStatus(prev).label if prev else prev}"
                    f" → {ProspectStatus(new).label if new else new}"
                ),
                "description": meta.get("reason", ""),
                "metadata": {
                    "previous_status": prev,
                    "new_status": new,
                    "actor_id": str(audit.actor_id) if audit.actor_id else None,
                },
            }
        )
    return events


def _proformas(customer_id: UUID) -> list[dict]:
    events = []
    docs = DocumentInstance.objects.filter(
        Q(customer_id=customer_id) | Q(reservation_draft__customer_id=customer_id),
    ).order_by("created_at")
    for doc in docs:
        events.append(
            {
                "date": _safe_dt(doc.created_at),
                "type": "proforma",
                "title": f"Proforma {doc.template_label}",
                "description": f"Statut : {doc.status}",
                "metadata": {
                    "document_id": str(doc.id),
                    "template_key": doc.template_key,
                    "status": doc.status,
                    "reservation_public_reference": doc.reservation_public_reference,
                },
            }
        )
    return events


def _reservations(customer_id: UUID) -> list[dict]:
    events = []
    drafts = ReservationDraft.objects.filter(customer_id=customer_id).order_by("created_at")
    for draft in drafts:
        events.append(
            {
                "date": _safe_dt(draft.created_at),
                "type": "reservation",
                "title": f"Réservation {draft.public_reference}",
                "description": (
                    f"Du {draft.start_at:%Y-%m-%d %H:%M}"
                    f" au {draft.end_at:%Y-%m-%d %H:%M}"
                ),
                "metadata": {
                    "reservation_draft_id": str(draft.id),
                    "public_reference": draft.public_reference,
                    "status": draft.status,
                    "start_at": _safe_dt(draft.start_at),
                    "end_at": _safe_dt(draft.end_at),
                },
            }
        )
        if draft.confirmed_at:
            events.append(
                {
                    "date": _safe_dt(draft.confirmed_at),
                    "type": "reservation_confirmed",
                    "title": f"Réservation {draft.public_reference} confirmée",
                    "description": "",
                    "metadata": {
                        "reservation_draft_id": str(draft.id),
                        "public_reference": draft.public_reference,
                        "confirmed_by_id": (
                            str(draft.confirmed_by_id) if draft.confirmed_by_id else None
                        ),
                    },
                }
            )
        if draft.cancelled_at:
            events.append(
                {
                    "date": _safe_dt(draft.cancelled_at),
                    "type": "reservation_cancelled",
                    "title": f"Réservation {draft.public_reference} annulée",
                    "description": "",
                    "metadata": {
                        "reservation_draft_id": str(draft.id),
                        "public_reference": draft.public_reference,
                        "cancelled_by_id": (
                            str(draft.cancelled_by_id) if draft.cancelled_by_id else None
                        ),
                    },
                }
            )
    return events


def _invoices(customer_id: UUID) -> list[dict]:
    events = []
    invoices = BillingInvoice.objects.filter(
        Q(reservation_draft__customer_id=customer_id) | Q(excess_receivable__isnull=False),
    ).select_related("reservation_draft").order_by("created_at")
    for inv in invoices:
        # Only include invoices linked to this customer's reservations or directly
        if inv.reservation_draft_id and str(inv.reservation_draft.customer_id) != str(customer_id):
            continue
        events.append(
            {
                "date": _safe_dt(inv.created_at),
                "type": "invoice",
                "title": f"Facture {inv.number or inv.id}",
                "description": f"Montant : {inv.amount} — {inv.invoice_status}",
                "metadata": {
                    "invoice_id": str(inv.id),
                    "number": inv.number,
                    "amount": str(inv.amount),
                    "status": inv.invoice_status,
                    "reservation_draft_id": (
                        str(inv.reservation_draft_id) if inv.reservation_draft_id else None
                    ),
                },
            }
        )
        if inv.settled_at:
            events.append(
                {
                    "date": _safe_dt(inv.settled_at),
                    "type": "invoice_settled",
                    "title": f"Facture {inv.number or inv.id} réglée",
                    "description": "",
                    "metadata": {
                        "invoice_id": str(inv.id),
                        "settled_by_id": str(inv.settled_by_id) if inv.settled_by_id else None,
                    },
                }
            )
    return events


def _payments(customer_id: UUID) -> list[dict]:
    events = []
    payments = Payment.objects.filter(
        Q(reservation_draft__customer_id=customer_id)
        | Q(hahitantsoa_event_draft__customer_id=customer_id),
    ).select_related(
        "reservation_draft", "hahitantsoa_event_draft"
    ).order_by("created_at")
    for payment in payments:
        events.append(
            {
                "date": _safe_dt(payment.created_at),
                "type": "payment",
                "title": f"Paiement {payment.payment_kind}",
                "description": (
                    f"{payment.amount} via {payment.payment_method}"
                    f" — {payment.payment_status}"
                ),
                "metadata": {
                    "payment_id": str(payment.id),
                    "amount": str(payment.amount),
                    "kind": payment.payment_kind,
                    "method": payment.payment_method,
                    "status": payment.payment_status,
                    "paid_at": _safe_dt(payment.paid_at),
                },
            }
        )
    return events


def _visits(customer_id: UUID) -> list[dict]:
    events = []
    visits = VisitAppointment.objects.filter(customer_id=customer_id).order_by("created_at")
    for visit in visits:
        events.append(
            {
                "date": _safe_dt(visit.scheduled_at),
                "type": "visit",
                "title": f"Visite {visit.get_reason_display()}",
                "description": f"Lieu : {visit.location} — Statut : {visit.status}",
                "metadata": {
                    "visit_id": str(visit.id),
                    "reason": visit.reason,
                    "status": visit.status,
                    "location": visit.location,
                    "completed_at": _safe_dt(visit.completed_at),
                    "cancelled_at": _safe_dt(visit.cancelled_at),
                },
            }
        )
        if visit.reminder_at:
            events.append(
                {
                    "date": _safe_dt(visit.reminder_at),
                    "type": "visit_reminder",
                    "title": f"Rappel visite {visit.get_reason_display()}",
                    "description": f"Rappel planifié le {visit.reminder_at:%Y-%m-%d %H:%M}",
                    "metadata": {
                        "visit_id": str(visit.id),
                        "reason": visit.reason,
                        "reminder_sent_at": _safe_dt(visit.reminder_sent_at),
                    },
                }
            )
    return events


def _logistics(customer_id: UUID) -> list[dict]:
    events = []
    log_events = LogisticsEvent.objects.filter(
        reservation_draft__customer_id=customer_id,
    ).select_related("reservation_draft").order_by("created_at")
    for le in log_events:
        events.append(
            {
                "date": _safe_dt(le.scheduled_at or le.created_at),
                "type": "logistics",
                "title": f"Logistique : {le.get_event_type_display()}",
                "description": (
                    f"Statut : {le.status}"
                    f" — Réservation {le.reservation_draft.public_reference}"
                ),
                "metadata": {
                    "logistics_event_id": str(le.id),
                    "event_type": le.event_type,
                    "status": le.status,
                    "reservation_draft_id": str(le.reservation_draft_id),
                    "executed_at": _safe_dt(le.executed_at),
                    "signature_required": le.signature_required,
                    "signature_received": le.signature_received,
                },
            }
        )
    return events


def _follow_ups(customer_id: UUID) -> list[dict]:
    """Capture prospect follow-up events (next_follow_up, to_recall transitions)."""
    events = []
    audit_events = AuditEvent.objects.filter(
        action="customer.prospect_status_changed",
        target_type="customer",
        target_id=str(customer_id),
    ).order_by("created_at")
    for audit in audit_events:
        meta = audit.metadata or {}
        if meta.get("new_status") == ProspectStatus.TO_RECALL:
            events.append(
                {
                    "date": _safe_dt(audit.created_at),
                    "type": "follow_up",
                    "title": "Relance commerciale",
                    "description": f"Raison : {meta.get('reason', '')}",
                    "metadata": {
                        "actor_id": str(audit.actor_id) if audit.actor_id else None,
                        "new_status": ProspectStatus.TO_RECALL,
                    },
                }
            )
    return events


def get_commercial_timeline(customer_id: UUID) -> list[dict]:
    """Return a unified chronological commercial timeline for a customer."""
    timeline: list[dict] = []
    timeline.extend(_prospect_transitions(customer_id))
    timeline.extend(_proformas(customer_id))
    timeline.extend(_reservations(customer_id))
    timeline.extend(_invoices(customer_id))
    timeline.extend(_payments(customer_id))
    timeline.extend(_follow_ups(customer_id))
    timeline.extend(_visits(customer_id))
    timeline.extend(_logistics(customer_id))

    def _sort_key(item: dict):
        date_val = item.get("date") or ""
        return date_val

    timeline.sort(key=_sort_key, reverse=True)
    return timeline
