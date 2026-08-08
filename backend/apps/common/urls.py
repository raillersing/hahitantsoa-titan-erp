from django.urls import path

from .views_reporting import ReportDataAPIView

urlpatterns = [
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
