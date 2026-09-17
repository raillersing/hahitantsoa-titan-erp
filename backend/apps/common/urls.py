from django.urls import path

from .views_exports import (
    BreakageRegisterExportAPIView,
    CautionsBalanceExportAPIView,
    PaymentsJournalExportAPIView,
    SalesJournalExportAPIView,
)
from .views_reporting import ReportDataAPIView

urlpatterns = [
    path(
        "exports/sales/",
        SalesJournalExportAPIView.as_view(),
        name="report-export-sales",
    ),
    path(
        "exports/payments/",
        PaymentsJournalExportAPIView.as_view(),
        name="report-export-payments",
    ),
    path(
        "exports/cautions/",
        CautionsBalanceExportAPIView.as_view(),
        name="report-export-cautions",
    ),
    path(
        "exports/breakage/",
        BreakageRegisterExportAPIView.as_view(),
        name="report-export-breakage",
    ),
    path(
        "<str:category>/",
        ReportDataAPIView.as_view(),
        name="report-category",
    ),
    path(
        "<str:category>/<str:kpi>/",
        ReportDataAPIView.as_view(),
        name="report-kpi",
    ),
]
