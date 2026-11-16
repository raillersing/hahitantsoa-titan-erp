from __future__ import annotations

from typing import Any

from django.http import Http404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .reports import (
    CATEGORY_KPIS,
    KPI_CALCULATORS,
    ReportCategory,
    categories_for_user_roles,
)


class ReportDataAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, category: str, kpi: str | None = None) -> Response:
        if category not in {c.value for c in ReportCategory}:
            raise Http404("Unknown report category.")

        allowed_categories = categories_for_user_roles(request.user)
        if category not in allowed_categories:
            return Response(
                {"detail": "You do not have permission to view this report category."},
                status=403,
            )

        period = request.query_params.get("period", "month")
        if period not in {"today", "week", "month", "quarter", "year"}:
            period = "month"

        allowed_kpis = CATEGORY_KPIS.get(category, [])
        if kpi is not None:
            if kpi not in allowed_kpis:
                raise Http404("Unknown KPI for this category.")
            calculator = KPI_CALCULATORS.get(kpi)
            if calculator is None:
                raise Http404("KPI calculator not implemented.")
            result: dict[str, Any] = calculator(period)
            return Response(
                {
                    "category": category,
                    "kpi": kpi,
                    "period": period,
                    "data": result,
                }
            )

        data: dict[str, Any] = {}
        for k in allowed_kpis:
            calculator = KPI_CALCULATORS.get(k)
            if calculator is not None:
                data[k] = calculator(period)

        return Response(
            {
                "category": category,
                "period": period,
                "kpis": data,
            }
        )
