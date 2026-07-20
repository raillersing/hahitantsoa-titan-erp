from django.urls import path

from apps.excel_import.views import (
    ImportJobListCreateAPIView,
    ImportJobMappingUpdateAPIView,
    ImportJobValidateAPIView,
)

urlpatterns = [
    path(
        "",
        ImportJobListCreateAPIView.as_view(),
        name="import-job-list",
    ),
    path(
        "<uuid:id>/mapping/",
        ImportJobMappingUpdateAPIView.as_view(),
        name="import-job-mapping",
    ),
    path(
        "<uuid:id>/validate/",
        ImportJobValidateAPIView.as_view(),
        name="import-job-validate",
    ),
]
