from __future__ import annotations

import csv
import io
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from django.db.models import Q

from apps.billing.models import (
    BillingCreditNoteStatus,
    BillingInvoice,
    BillingInvoiceStatus,
)
from apps.customers.models import CustomerPartyType
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.inventory.models import (
    InventoryDamageLossSettlement,
    InventoryDamageLossSettlementLine,
)
from apps.payments.models import CONFIRMED_PAYMENT_STATUS_VALUES, Payment


def parse_date_param(val: str | None) -> date | None:
    """Parse a date string formatted as YYYY-MM-DD."""
    if not val:
        return None
    try:
        return datetime.strptime(val, "%Y-%m-%d").date()
    except ValueError, TypeError:
        return None


def format_amount(val: Any) -> str:
    """Format decimal amount as a standardized French number string with 2 decimal places."""
    if val is None:
        return "0,00"
    try:
        dec = Decimal(str(val))
        return f"{dec:.2f}".replace(".", ",")
    except Exception:
        return str(val)


def generate_csv(headers: list[tuple[str, str]], rows: list[dict[str, Any]]) -> str:
    """Generate a semicolon-delimited CSV string with UTF-8 BOM for seamless Excel opening."""
    output = io.StringIO()
    # Write UTF-8 BOM
    output.write("\ufeff")
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)

    # Header labels
    writer.writerow([label for _, label in headers])

    # Rows
    for row in rows:
        writer.writerow([row.get(key, "") for key, _ in headers])

    return output.getvalue()


def _compute_tax_breakdown(
    total_amount: Decimal,
    *,
    tva_rate_override: Decimal | None = None,
    customer_nif: str = "",
    customer_party_type: str = "",
) -> tuple[str, Decimal, Decimal]:
    """Compute (tva_rate_label, amount_ht, amount_tva) from frozen total_amount.

    If tva_rate_override is specified, uses that rate.
    Otherwise, if the customer has a NIF or is a registered company, applies standard 20% VAT.
    For non-assujetti / exempt individuals without NIF, applies 0% VAT.
    """
    if tva_rate_override is not None:
        rate = tva_rate_override
    elif (
        customer_nif and customer_nif.strip()
    ) or customer_party_type == CustomerPartyType.COMPANY:
        rate = Decimal("0.20")
    else:
        rate = Decimal("0.00")

    pct = rate * 100
    rate_label = f"{int(pct)} %" if pct == int(pct) else f"{pct:.1f} %"

    if rate > Decimal("0.00"):
        amount_ht = (total_amount / (Decimal("1.00") + rate)).quantize(Decimal("0.01"))
        amount_tva = total_amount - amount_ht
    else:
        amount_ht = total_amount
        amount_tva = Decimal("0.00")

    return rate_label, amount_ht, amount_tva


# ----------------------------------------------------------------------
# 1. Journal des Ventes (Facturier)
# ----------------------------------------------------------------------
SALES_JOURNAL_HEADERS: list[tuple[str, str]] = [
    ("reference", "N° Facture"),
    ("date", "Date Facture"),
    ("dossier_ref", "Réf. Dossier"),
    ("scope", "Volet"),
    ("customer_name", "Client"),
    ("customer_nif", "NIF"),
    ("customer_stat", "STAT"),
    ("amount_ht", "Montant HT (Ar)"),
    ("tva_rate", "Taux TVA"),
    ("amount_tva", "Montant TVA (Ar)"),
    ("amount_ttc", "Montant TTC (Ar)"),
    ("status", "Statut Facture"),
]


def export_sales_journal(
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    scope: str = "all",
    tva_rate: Decimal | None = None,
    include_drafts: bool = True,
) -> list[dict[str, Any]]:
    """Extract sales journal rows from official billing invoices and document instances."""
    rows: list[dict[str, Any]] = []
    seen_references: set[str] = set()
    seen_doc_ids: set[Any] = set()

    # 1. Query official billing invoices (canonical accounting source for sales)
    billing_qs = (
        BillingInvoice.objects.select_related(
            "reservation_draft__customer",
            "hahitantsoa_event_draft__customer",
            "document_instance",
        )
        .prefetch_related("credit_notes")
        .order_by("-issued_at", "-created_at")
    )

    if start_date:
        billing_qs = billing_qs.filter(issued_at__date__gte=start_date)
    if end_date:
        billing_qs = billing_qs.filter(issued_at__date__lte=end_date)

    if scope == "titan":
        billing_qs = billing_qs.filter(reservation_draft__isnull=False)
    elif scope == "hahitantsoa":
        billing_qs = billing_qs.filter(hahitantsoa_event_draft__isnull=False)

    for bi in billing_qs:
        ref = (
            bi.number
            or (
                bi.document_instance.document_reference
                if bi.document_instance and bi.document_instance.document_reference
                else ""
            )
            or f"FA-BILL-{bi.id.hex[:8]}"
        )
        seen_references.add(ref)
        if bi.document_instance_id:
            seen_doc_ids.add(bi.document_instance_id)
            if bi.document_instance.document_reference:
                seen_references.add(bi.document_instance.document_reference)

        dossier_ref = ""
        customer_name = ""
        customer_nif = ""
        customer_stat = ""
        customer_party_type = ""
        scope_label = "Titan"

        if bi.document_instance:
            doc = bi.document_instance
            customer_name = doc.customer_display_name or ""
            customer_nif = doc.customer_nif or ""
            customer_stat = doc.customer_stat or ""
            customer_party_type = doc.customer_party_type or ""
            dossier_ref = doc.reservation_public_reference or ""

        if bi.reservation_draft:
            scope_label = "Titan"
            dossier_ref = bi.reservation_draft.public_reference or dossier_ref
            if not customer_name and bi.reservation_draft.customer:
                customer_name = bi.reservation_draft.customer.display_name
            if not customer_nif and bi.reservation_draft.customer:
                customer_nif = bi.reservation_draft.customer.nif
            if not customer_stat and bi.reservation_draft.customer:
                customer_stat = bi.reservation_draft.customer.stat
            if not customer_party_type and bi.reservation_draft.customer:
                customer_party_type = bi.reservation_draft.customer.party_type
        elif bi.hahitantsoa_event_draft:
            scope_label = "Hahitantsoa"
            dossier_ref = bi.hahitantsoa_event_draft.public_reference or dossier_ref
            if not customer_name and bi.hahitantsoa_event_draft.customer:
                customer_name = bi.hahitantsoa_event_draft.customer.display_name
            if not customer_nif and bi.hahitantsoa_event_draft.customer:
                customer_nif = bi.hahitantsoa_event_draft.customer.nif
            if not customer_stat and bi.hahitantsoa_event_draft.customer:
                customer_stat = bi.hahitantsoa_event_draft.customer.stat
            if not customer_party_type and bi.hahitantsoa_event_draft.customer:
                customer_party_type = bi.hahitantsoa_event_draft.customer.party_type

        # Use the frozen immutable amount from the billing invoice
        total_amount = bi.amount
        tva_label, amount_ht, amount_tva = _compute_tax_breakdown(
            total_amount,
            tva_rate_override=tva_rate,
            customer_nif=customer_nif,
            customer_party_type=customer_party_type,
        )

        if bi.invoice_status == BillingInvoiceStatus.CANCELLED:
            status_label = "Annulée"
        elif bi.invoice_status == BillingInvoiceStatus.SETTLED:
            status_label = "Réglée"
        elif (
            bi.document_instance and bi.document_instance.status == DocumentInstanceStatus.GENERATED
        ):
            status_label = "Émise"
        else:
            status_label = "Ouverte"

        rows.append(
            {
                "reference": ref,
                "date": bi.issued_at.strftime("%Y-%m-%d"),
                "dossier_ref": dossier_ref,
                "scope": scope_label,
                "customer_name": customer_name,
                "customer_nif": customer_nif,
                "customer_stat": customer_stat,
                "amount_ht": format_amount(amount_ht),
                "tva_rate": tva_label,
                "amount_tva": format_amount(amount_tva),
                "amount_ttc": format_amount(total_amount),
                "status": status_label,
            }
        )

        # Include credit notes (avoirs) explicitly
        for cn in bi.credit_notes.all():
            if cn.status not in (BillingCreditNoteStatus.ISSUED, BillingCreditNoteStatus.APPLIED):
                continue
            cn_date = cn.issued_at.date()
            if start_date and cn_date < start_date:
                continue
            if end_date and cn_date > end_date:
                continue
            cn_ref = f"AV-{cn.id.hex[:8]}"
            cn_tva_label, cn_ht, cn_tva = _compute_tax_breakdown(
                cn.amount,
                tva_rate_override=tva_rate,
                customer_nif=customer_nif,
                customer_party_type=customer_party_type,
            )
            rows.append(
                {
                    "reference": cn_ref,
                    "date": cn.issued_at.strftime("%Y-%m-%d"),
                    "dossier_ref": dossier_ref,
                    "scope": scope_label,
                    "customer_name": customer_name,
                    "customer_nif": customer_nif,
                    "customer_stat": customer_stat,
                    "amount_ht": format_amount(-cn_ht),
                    "tva_rate": cn_tva_label,
                    "amount_tva": format_amount(-cn_tva),
                    "amount_ttc": format_amount(-cn.amount),
                    "status": "Avoir",
                }
            )

    # 2. Query invoice document instances (complementing billing invoices without duplicating)
    doc_qs = (
        DocumentInstance.objects.select_related(
            "reservation_draft__customer",
            "hahitantsoa_event_draft__customer",
            "billing_invoice",
        )
        .prefetch_related(
            "reservation_draft__billing_invoices",
            "hahitantsoa_event_draft__billing_invoices",
        )
        .filter(
            Q(template_key__endswith=".invoice.v1")
            | Q(template_key__contains="credit_note")
            | Q(template_key__contains="avoir")
            | Q(document_type__in=["invoice", "credit_note"])
        )
    )

    if not include_drafts:
        doc_qs = doc_qs.exclude(status=DocumentInstanceStatus.PREPARED)

    if start_date:
        doc_qs = doc_qs.filter(
            Q(document_date__gte=start_date)
            | Q(document_date__isnull=True, issued_at__date__gte=start_date)
            | Q(
                document_date__isnull=True, issued_at__isnull=True, created_at__date__gte=start_date
            )
        )
    if end_date:
        doc_qs = doc_qs.filter(
            Q(document_date__lte=end_date)
            | Q(document_date__isnull=True, issued_at__date__lte=end_date)
            | Q(document_date__isnull=True, issued_at__isnull=True, created_at__date__lte=end_date)
        )

    if scope == "titan":
        doc_qs = doc_qs.filter(reservation_draft__isnull=False)
    elif scope == "hahitantsoa":
        doc_qs = doc_qs.filter(hahitantsoa_event_draft__isnull=False)

    doc_qs = doc_qs.order_by("-created_at")

    for doc in doc_qs:
        if doc.id in seen_doc_ids:
            continue
        ref = doc.document_reference or f"DOC-{doc.id.hex[:8]}"
        if ref in seen_references:
            continue
        seen_references.add(ref)

        doc_date = doc.document_date
        if not doc_date and doc.issued_at:
            doc_date = doc.issued_at.date()
        if not doc_date:
            doc_date = doc.created_at.date()

        dossier_ref = doc.reservation_public_reference or ""
        scope_label = "Titan"
        customer_name = doc.customer_display_name or ""
        customer_nif = doc.customer_nif or ""
        customer_stat = doc.customer_stat or ""
        customer_party_type = doc.customer_party_type or ""

        # Determine frozen invoice amount: prefer linked billing invoice,
        # then draft billing invoices, then draft total
        total_amount = Decimal("0.00")
        if hasattr(doc, "billing_invoice") and doc.billing_invoice:
            total_amount = doc.billing_invoice.amount
        elif doc.reservation_draft:
            dossier_ref = doc.reservation_draft.public_reference or dossier_ref
            scope_label = "Titan"
            bi_match = doc.reservation_draft.billing_invoices.exclude(
                invoice_status=BillingInvoiceStatus.CANCELLED
            ).first()
            if bi_match:
                total_amount = bi_match.amount
            else:
                total_amount = doc.reservation_draft.total_amount
            if not customer_name and doc.reservation_draft.customer:
                customer_name = doc.reservation_draft.customer.display_name
            if not customer_nif and doc.reservation_draft.customer:
                customer_nif = doc.reservation_draft.customer.nif
            if not customer_stat and doc.reservation_draft.customer:
                customer_stat = doc.reservation_draft.customer.stat
            if not customer_party_type and doc.reservation_draft.customer:
                customer_party_type = doc.reservation_draft.customer.party_type
        elif doc.hahitantsoa_event_draft:
            dossier_ref = doc.hahitantsoa_event_draft.public_reference or dossier_ref
            scope_label = "Hahitantsoa"
            bi_match = doc.hahitantsoa_event_draft.billing_invoices.exclude(
                invoice_status=BillingInvoiceStatus.CANCELLED
            ).first()
            if bi_match:
                total_amount = bi_match.amount
            else:
                total_amount = doc.hahitantsoa_event_draft.total_amount
            if not customer_name and doc.hahitantsoa_event_draft.customer:
                customer_name = doc.hahitantsoa_event_draft.customer.display_name
            if not customer_nif and doc.hahitantsoa_event_draft.customer:
                customer_nif = doc.hahitantsoa_event_draft.customer.nif
            if not customer_stat and doc.hahitantsoa_event_draft.customer:
                customer_stat = doc.hahitantsoa_event_draft.customer.stat
            if not customer_party_type and doc.hahitantsoa_event_draft.customer:
                customer_party_type = doc.hahitantsoa_event_draft.customer.party_type

        is_avoir = (
            getattr(doc, "document_type", "") == "credit_note"
            or "credit_note" in doc.template_key
            or "avoir" in doc.template_key
            or ref.endswith("-AV")
            or ref.startswith("AV-")
        )
        if is_avoir:
            total_amount = -abs(total_amount)

        tva_label, amount_ht, amount_tva = _compute_tax_breakdown(
            total_amount,
            tva_rate_override=tva_rate,
            customer_nif=customer_nif,
            customer_party_type=customer_party_type,
        )

        if is_avoir:
            status_label = "Avoir"
        elif doc.status == DocumentInstanceStatus.VOIDED:
            status_label = "Annulée"
        elif doc.status == DocumentInstanceStatus.GENERATED:
            status_label = "Émise"
        else:
            status_label = "Brouillon"

        rows.append(
            {
                "reference": ref,
                "date": doc_date.strftime("%Y-%m-%d"),
                "dossier_ref": dossier_ref,
                "scope": scope_label,
                "customer_name": customer_name,
                "customer_nif": customer_nif,
                "customer_stat": customer_stat,
                "amount_ht": format_amount(amount_ht),
                "tva_rate": tva_label,
                "amount_tva": format_amount(amount_tva),
                "amount_ttc": format_amount(total_amount),
                "status": status_label,
            }
        )

    # Sort rows by date descending
    rows.sort(key=lambda r: r["date"], reverse=True)
    return rows


# ----------------------------------------------------------------------
# 2. Journal des Règlements & Encaissements (Trésorerie)
# ----------------------------------------------------------------------
PAYMENTS_JOURNAL_HEADERS: list[tuple[str, str]] = [
    ("payment_id", "ID Paiement"),
    ("date", "Date / Heure"),
    ("receipt_ref", "N° Reçu"),
    ("dossier_ref", "Réf. Dossier"),
    ("scope", "Volet"),
    ("customer_name", "Client"),
    ("payment_nature", "Nature"),
    ("payment_method", "Mode de Règlement"),
    ("bank_name", "Banque"),
    ("check_number", "N° Chèque / Trans."),
    ("amount", "Montant (Ar)"),
    ("status", "Statut"),
    ("is_reconciled", "Rapproché"),
]


def export_payments_journal(
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    method: str | None = None,
    scope: str = "all",
) -> list[dict[str, Any]]:
    """Extract payments journal rows covering confirmed/reconciled receipts and refunds."""
    qs = (
        Payment.objects.select_related(
            "reservation_draft__customer",
            "hahitantsoa_event_draft__customer",
            "receipt_document",
            "refund_obligation",
            "billing_refund_obligation",
        )
        .filter(payment_status__in=CONFIRMED_PAYMENT_STATUS_VALUES)
        .order_by("-created_at")
    )

    if start_date:
        qs = qs.filter(created_at__date__gte=start_date)
    if end_date:
        qs = qs.filter(created_at__date__lte=end_date)

    if method and method != "all":
        qs = qs.filter(payment_method__iexact=method)

    if scope == "titan":
        qs = qs.filter(reservation_draft__isnull=False)
    elif scope == "hahitantsoa":
        qs = qs.filter(hahitantsoa_event_draft__isnull=False)

    rows: list[dict[str, Any]] = []

    for p in qs:
        dossier_ref = ""
        customer_name = ""
        scope_label = "Titan"

        if p.reservation_draft:
            dossier_ref = p.reservation_draft.public_reference
            scope_label = "Titan"
            customer_name = (
                p.reservation_draft.customer.display_name if p.reservation_draft.customer else ""
            )
        elif p.hahitantsoa_event_draft:
            dossier_ref = p.hahitantsoa_event_draft.public_reference
            scope_label = "Hahitantsoa"
            customer_name = (
                p.hahitantsoa_event_draft.customer.display_name
                if p.hahitantsoa_event_draft.customer
                else ""
            )

        is_refund = bool(p.refund_obligation or p.billing_refund_obligation)
        nature = "Remboursement caution" if is_refund else "Encaissement règlement"

        receipt_num = ""
        if p.receipt_document and p.receipt_document.document_reference:
            receipt_num = p.receipt_document.document_reference
        elif p.receipt_document_id:
            receipt_num = f"REC-{p.receipt_document_id[:8]}"
        else:
            receipt_num = f"REC-{p.id.hex[:8]}"

        rows.append(
            {
                "payment_id": str(p.id)[:8],
                "date": p.created_at.strftime("%Y-%m-%d %H:%M"),
                "receipt_ref": receipt_num,
                "dossier_ref": dossier_ref,
                "scope": scope_label,
                "customer_name": customer_name,
                "payment_nature": nature,
                "payment_method": p.payment_method.upper(),
                "bank_name": p.bank_name or "",
                "check_number": p.check_number or "",
                "amount": format_amount(p.amount),
                "status": "Confirmé" if p.payment_status == "confirmed" else "Rapproché",
                "is_reconciled": "Oui" if p.payment_status == "reconciled" else "Non",
            }
        )

    return rows


# ----------------------------------------------------------------------
# 3. Balance et Suivi des Cautions (Dépôts de Garantie)
# ----------------------------------------------------------------------
CAUTIONS_BALANCE_HEADERS: list[tuple[str, str]] = [
    ("settlement_id", "ID Règlement"),
    ("date", "Date Constat"),
    ("dossier_ref", "Réf. Dossier"),
    ("scope", "Volet"),
    ("customer_name", "Client"),
    ("caution_available", "Caution Déposée (Ar)"),
    ("caution_applied", "Retenue Casse (Ar)"),
    ("refund_due", "Restitution Dûe (Ar)"),
    ("excess_due", "Excédent Réclamé (Ar)"),
    ("settlement_status", "Statut"),
]


def export_cautions_balance(
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    scope: str = "all",
) -> list[dict[str, Any]]:
    """Extract caution deposit balances, damage retentions, and refund obligations."""
    qs = (
        InventoryDamageLossSettlement.objects.select_related(
            "return_operation__reservation_draft__customer",
            "return_operation__hahitantsoa_event_draft__customer",
        )
        .exclude(settlement_status="cancelled")
        .order_by("-created_at")
    )

    if start_date:
        qs = qs.filter(created_at__date__gte=start_date)
    if end_date:
        qs = qs.filter(created_at__date__lte=end_date)

    if scope == "titan":
        qs = qs.filter(return_operation__reservation_draft__isnull=False)
    elif scope == "hahitantsoa":
        qs = qs.filter(return_operation__hahitantsoa_event_draft__isnull=False)

    rows: list[dict[str, Any]] = []

    for s in qs:
        dossier_ref = ""
        customer_name = ""
        scope_label = "Titan"

        ro = s.return_operation
        if ro.reservation_draft:
            dossier_ref = ro.reservation_draft.public_reference
            scope_label = "Titan"
            customer_name = (
                ro.reservation_draft.customer.display_name if ro.reservation_draft.customer else ""
            )
        elif ro.hahitantsoa_event_draft:
            dossier_ref = ro.hahitantsoa_event_draft.public_reference
            scope_label = "Hahitantsoa"
            customer_name = (
                ro.hahitantsoa_event_draft.customer.display_name
                if ro.hahitantsoa_event_draft.customer
                else ""
            )

        status_label = {
            "draft": "Brouillon",
            "validated": "Validé",
            "cancelled": "Annulé",
        }.get(s.settlement_status, s.settlement_status)

        rows.append(
            {
                "settlement_id": str(s.id)[:8],
                "date": s.created_at.strftime("%Y-%m-%d"),
                "dossier_ref": dossier_ref,
                "scope": scope_label,
                "customer_name": customer_name,
                "caution_available": format_amount(s.caution_available),
                "caution_applied": format_amount(s.caution_applied),
                "refund_due": format_amount(s.refund_due),
                "excess_due": format_amount(s.excess_due),
                "settlement_status": status_label,
            }
        )

    return rows


# ----------------------------------------------------------------------
# 4. Registre des Déclarations de Casse, Avaries et Pertes
# ----------------------------------------------------------------------
BREAKAGE_REGISTER_HEADERS: list[tuple[str, str]] = [
    ("date", "Date Constat"),
    ("dossier_ref", "Réf. Dossier"),
    ("scope", "Volet"),
    ("item_name", "Article"),
    ("kind", "Type Constat"),
    ("quantity", "Quantité"),
    ("unit_price", "Prix Unitaire (Ar)"),
    ("total_amount", "Total Indemnité (Ar)"),
    ("settlement_status", "Statut"),
    ("notes", "Notes"),
]


def export_breakage_register(
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    scope: str = "all",
) -> list[dict[str, Any]]:
    """Extract itemized breakage, loss, and damage lines with catalog indemnity amounts."""
    qs = (
        InventoryDamageLossSettlementLine.objects.select_related(
            "settlement__return_operation__reservation_draft",
            "settlement__return_operation__hahitantsoa_event_draft",
            "return_operation_line",
        )
        .exclude(settlement__settlement_status="cancelled")
        .order_by("-created_at")
    )

    if start_date:
        qs = qs.filter(created_at__date__gte=start_date)
    if end_date:
        qs = qs.filter(created_at__date__lte=end_date)

    if scope == "titan":
        qs = qs.filter(settlement__return_operation__reservation_draft__isnull=False)
    elif scope == "hahitantsoa":
        qs = qs.filter(settlement__return_operation__hahitantsoa_event_draft__isnull=False)

    rows: list[dict[str, Any]] = []

    for line in qs:
        s = line.settlement
        ro = s.return_operation
        dossier_ref = ""
        scope_label = "Titan"

        if ro.reservation_draft:
            dossier_ref = ro.reservation_draft.public_reference
            scope_label = "Titan"
        elif ro.hahitantsoa_event_draft:
            dossier_ref = ro.hahitantsoa_event_draft.public_reference
            scope_label = "Hahitantsoa"

        item_label = line.manual_label or (
            str(line.return_operation_line.inventory_item)
            if hasattr(line.return_operation_line, "inventory_item")
            else "Article loué"
        )

        kind_label = {
            "damage": "Casse / Dégradation",
            "loss": "Perte / Manquant",
        }.get(line.settlement_line_kind, line.settlement_line_kind)

        status_label = {
            "draft": "Brouillon",
            "validated": "Validé",
        }.get(s.settlement_status, s.settlement_status)

        rows.append(
            {
                "date": line.created_at.strftime("%Y-%m-%d"),
                "dossier_ref": dossier_ref,
                "scope": scope_label,
                "item_name": item_label,
                "kind": kind_label,
                "quantity": line.quantity,
                "unit_price": format_amount(line.unit_amount),
                "total_amount": format_amount(line.total_amount),
                "settlement_status": status_label,
                "notes": line.notes or "",
            }
        )

    return rows
