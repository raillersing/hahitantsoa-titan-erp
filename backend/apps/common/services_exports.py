from __future__ import annotations

import csv
import io
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from django.db.models import Q

from apps.billing.models import BillingInvoice
from apps.documents.models import DocumentInstance
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
) -> list[dict[str, Any]]:
    """Extract sales journal rows from official invoice document instances and billing invoices."""
    # Query invoice document instances
    doc_qs = (
        DocumentInstance.objects.select_related(
            "reservation_draft__customer",
            "hahitantsoa_event_draft__customer",
        )
        .filter(template_key__endswith=".invoice.v1")
        .exclude(status="voided")
    )

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

    rows: list[dict[str, Any]] = []
    seen_references: set[str] = set()

    for doc in doc_qs:
        ref = doc.document_reference or f"DOC-{doc.id.hex[:8]}"
        seen_references.add(ref)

        doc_date = doc.document_date
        if not doc_date and doc.issued_at:
            doc_date = doc.issued_at.date()
        if not doc_date:
            doc_date = doc.created_at.date()

        dossier_ref = doc.reservation_public_reference or ""
        scope_label = "Titan"
        total_amount = Decimal("0")

        if doc.reservation_draft:
            dossier_ref = doc.reservation_draft.public_reference or dossier_ref
            total_amount = doc.reservation_draft.total_amount
            scope_label = "Titan"
        elif doc.hahitantsoa_event_draft:
            dossier_ref = doc.hahitantsoa_event_draft.public_reference or dossier_ref
            total_amount = doc.hahitantsoa_event_draft.total_amount
            scope_label = "Hahitantsoa"

        # Calculate HT and TVA (assuming 20% standard VAT if not specified)
        amount_ht = (total_amount / Decimal("1.20")).quantize(Decimal("0.01"))
        amount_tva = total_amount - amount_ht

        rows.append(
            {
                "reference": ref,
                "date": doc_date.strftime("%Y-%m-%d"),
                "dossier_ref": dossier_ref,
                "scope": scope_label,
                "customer_name": doc.customer_display_name
                or (
                    doc.reservation_draft.customer.display_name
                    if doc.reservation_draft and doc.reservation_draft.customer
                    else ""
                ),
                "customer_nif": doc.customer_nif or "",
                "customer_stat": doc.customer_stat or "",
                "amount_ht": format_amount(amount_ht),
                "tva_rate": "20 %",
                "amount_tva": format_amount(amount_tva),
                "amount_ttc": format_amount(total_amount),
                "status": "Émise" if doc.status == "generated" else "Brouillon",
            }
        )

    # Also include any billing invoices (e.g. excess damage receivables)
    billing_qs = BillingInvoice.objects.select_related(
        "reservation_draft__customer",
        "hahitantsoa_event_draft__customer",
    ).exclude(invoice_status="cancelled")

    if start_date:
        billing_qs = billing_qs.filter(issued_at__date__gte=start_date)
    if end_date:
        billing_qs = billing_qs.filter(issued_at__date__lte=end_date)

    if scope == "titan":
        billing_qs = billing_qs.filter(reservation_draft__isnull=False)
    elif scope == "hahitantsoa":
        billing_qs = billing_qs.filter(hahitantsoa_event_draft__isnull=False)

    for bi in billing_qs:
        ref = bi.number or f"FA-BILL-{bi.id.hex[:8]}"
        if ref in seen_references:
            continue
        seen_references.add(ref)

        dossier_ref = ""
        customer_name = ""
        scope_label = "Titan"
        if bi.reservation_draft:
            dossier_ref = bi.reservation_draft.public_reference
            scope_label = "Titan"
            customer_name = (
                bi.reservation_draft.customer.display_name if bi.reservation_draft.customer else ""
            )
        elif bi.hahitantsoa_event_draft:
            dossier_ref = bi.hahitantsoa_event_draft.public_reference
            scope_label = "Hahitantsoa"
            customer_name = (
                bi.hahitantsoa_event_draft.customer.display_name
                if bi.hahitantsoa_event_draft.customer
                else ""
            )

        amount_ht = (bi.amount / Decimal("1.20")).quantize(Decimal("0.01"))
        amount_tva = bi.amount - amount_ht

        rows.append(
            {
                "reference": ref,
                "date": bi.issued_at.strftime("%Y-%m-%d"),
                "dossier_ref": dossier_ref,
                "scope": scope_label,
                "customer_name": customer_name,
                "customer_nif": "",
                "customer_stat": "",
                "amount_ht": format_amount(amount_ht),
                "tva_rate": "20 %",
                "amount_tva": format_amount(amount_tva),
                "amount_ttc": format_amount(bi.amount),
                "status": "Réglée" if bi.invoice_status == "settled" else "Ouverte",
            }
        )

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
