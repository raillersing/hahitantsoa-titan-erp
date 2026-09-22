from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.selectors import user_effective_role_slugs

from .reports import ReportCategory, can_role_export_report
from .services_exports import (
    BREAKAGE_REGISTER_HEADERS,
    CAUTIONS_BALANCE_HEADERS,
    PAYMENTS_JOURNAL_HEADERS,
    SALES_JOURNAL_HEADERS,
    export_breakage_register,
    export_cautions_balance,
    export_payments_journal,
    export_sales_journal,
    generate_csv,
    parse_date_param,
)


class CSVRenderer(BaseRenderer):
    """Custom renderer supporting CSV export and bypassing DRF's URL_FORMAT_OVERRIDE 404."""

    media_type = "text/csv"
    format = "csv"
    charset = "utf-8"

    def render(
        self,
        data: Any,
        accepted_media_type: str | None = None,
        renderer_context: dict[str, Any] | None = None,
    ) -> Any:
        return data


def _check_export_permission(request: Request, categories: list[str]) -> bool:
    """Verify that the user is staff or has export permission for at least one of the categories."""
    if getattr(request.user, "is_staff", False) is True:
        return True
    user_roles = user_effective_role_slugs(user=request.user)
    return any(
        can_role_export_report(role_slug=role, category=cat)
        for role in user_roles
        for cat in categories
    )


class SalesJournalExportAPIView(APIView):
    """Export sales journal (Facturier des ventes) in CSV or JSON format."""

    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer, CSVRenderer]

    def get(self, request: Request) -> HttpResponse | Response:
        if not _check_export_permission(request, [ReportCategory.SALES_BILLING.value]):
            return Response(
                {"detail": "Vous n'avez pas l'autorisation d'exporter le journal des ventes."},
                status=403,
            )

        start_date = parse_date_param(request.query_params.get("start_date"))
        end_date = parse_date_param(request.query_params.get("end_date"))
        scope = request.query_params.get("scope", "all").lower()
        export_format = request.query_params.get("format", "csv").lower()
        tva_rate_raw = request.query_params.get("tva_rate") or request.query_params.get("tva")
        tva_rate: Decimal | None = None
        if tva_rate_raw is not None:
            try:
                val = Decimal(tva_rate_raw)
                if val > Decimal("1.00"):
                    tva_rate = val / Decimal("100")
                else:
                    tva_rate = val
            except Exception:
                tva_rate = None
        include_drafts_raw = request.query_params.get("include_drafts")
        include_drafts = (
            include_drafts_raw.lower() not in ("false", "0", "no")
            if include_drafts_raw is not None
            else True
        )

        rows = export_sales_journal(
            start_date=start_date,
            end_date=end_date,
            scope=scope,
            tva_rate=tva_rate,
            include_drafts=include_drafts,
        )

        if export_format == "json":
            return Response({"count": len(rows), "results": rows})

        csv_content = generate_csv(SALES_JOURNAL_HEADERS, rows)
        filename = f"journal-ventes-{datetime.now().strftime('%Y%m%d')}.csv"
        response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class PaymentsJournalExportAPIView(APIView):
    """Export cash and payments journal in CSV or JSON format."""

    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer, CSVRenderer]

    def get(self, request: Request) -> HttpResponse | Response:
        if not _check_export_permission(
            request, [ReportCategory.PAYMENTS.value, ReportCategory.SALES_BILLING.value]
        ):
            return Response(
                {"detail": "Vous n'avez pas l'autorisation d'exporter le journal des paiements."},
                status=403,
            )

        start_date = parse_date_param(request.query_params.get("start_date"))
        end_date = parse_date_param(request.query_params.get("end_date"))
        method = request.query_params.get("method")
        scope = request.query_params.get("scope", "all").lower()
        export_format = request.query_params.get("format", "csv").lower()

        rows = export_payments_journal(
            start_date=start_date, end_date=end_date, method=method, scope=scope
        )

        if export_format == "json":
            return Response({"count": len(rows), "results": rows})

        csv_content = generate_csv(PAYMENTS_JOURNAL_HEADERS, rows)
        filename = f"journal-encaissements-{datetime.now().strftime('%Y%m%d')}.csv"
        response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class CautionsBalanceExportAPIView(APIView):
    """Export caution deposit balances and refund retentions in CSV or JSON format."""

    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer, CSVRenderer]

    def get(self, request: Request) -> HttpResponse | Response:
        if not _check_export_permission(
            request, [ReportCategory.SALES_BILLING.value, ReportCategory.PAYMENTS.value]
        ):
            return Response(
                {"detail": "Vous n'avez pas l'autorisation d'exporter la balance des cautions."},
                status=403,
            )

        start_date = parse_date_param(request.query_params.get("start_date"))
        end_date = parse_date_param(request.query_params.get("end_date"))
        scope = request.query_params.get("scope", "all").lower()
        export_format = request.query_params.get("format", "csv").lower()

        rows = export_cautions_balance(start_date=start_date, end_date=end_date, scope=scope)

        if export_format == "json":
            return Response({"count": len(rows), "results": rows})

        csv_content = generate_csv(CAUTIONS_BALANCE_HEADERS, rows)
        filename = f"balance-cautions-{datetime.now().strftime('%Y%m%d')}.csv"
        response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class BreakageRegisterExportAPIView(APIView):
    """Export breakage and damage settlement register in CSV or JSON format."""

    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer, CSVRenderer]

    def get(self, request: Request) -> HttpResponse | Response:
        if not _check_export_permission(
            request,
            [
                ReportCategory.LOGISTICS.value,
                ReportCategory.INVENTORY.value,
                ReportCategory.SALES_BILLING.value,
            ],
        ):
            return Response(
                {"detail": "Vous n'avez pas l'autorisation d'exporter le registre des dommages."},
                status=403,
            )

        start_date = parse_date_param(request.query_params.get("start_date"))
        end_date = parse_date_param(request.query_params.get("end_date"))
        scope = request.query_params.get("scope", "all").lower()
        export_format = request.query_params.get("format", "csv").lower()

        rows = export_breakage_register(start_date=start_date, end_date=end_date, scope=scope)

        if export_format == "json":
            return Response({"count": len(rows), "results": rows})

        csv_content = generate_csv(BREAKAGE_REGISTER_HEADERS, rows)
        filename = f"registre-casse-{datetime.now().strftime('%Y%m%d')}.csv"
        response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
