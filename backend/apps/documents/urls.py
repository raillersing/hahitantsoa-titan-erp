from django.urls import path

from apps.documents.views import (
    DocumentTemplateDefinitionAPIView,
    DocumentTemplateRegistryAPIView,
)

urlpatterns = [
    path(
        "templates/",
        DocumentTemplateRegistryAPIView.as_view(),
        name="document-template-registry",
    ),
    path(
        "templates/<str:template_key>/",
        DocumentTemplateDefinitionAPIView.as_view(),
        name="document-template-definition",
    ),
]
