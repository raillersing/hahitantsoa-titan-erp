from django.urls import path

from apps.documents.views import (
    DocumentInstancePrivateArtifactAPIView,
    DocumentTemplateDefinitionAPIView,
    DocumentTemplateRegistryAPIView,
    TitanProformaDraftPreviewAPIView,
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
    path(
        "titan/proforma-drafts/<uuid:reservation_draft_id>/preview/",
        TitanProformaDraftPreviewAPIView.as_view(),
        name="titan-proforma-draft-preview",
    ),
    path(
        "instances/<uuid:id>/artifact/",
        DocumentInstancePrivateArtifactAPIView.as_view(),
        name="document-instance-private-artifact",
    ),
]
