from django.http import Http404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documents.registry import (
    get_document_template_definition,
    list_document_template_definitions,
)
from apps.documents.serializers import (
    DocumentTemplateDefinitionSerializer,
    TitanProformaDraftPreviewSerializer,
)
from apps.reservations.models import ReservationDraft

TITAN_PROFORMA_TEMPLATE_KEY = "titan.proforma.v1"


def active_reservation_drafts_for_document_preview():
    return (
        ReservationDraft.objects.filter(is_deleted=False)
        .select_related("customer")
        .prefetch_related("lines__inventory_item")
        .order_by("-created_at", "public_reference")
    )


def runtime_document_scope_flags() -> dict[str, bool]:
    return {
        "pdf_runtime_generated": False,
        "reservation_confirmed": False,
        "inventory_blocked": False,
        "payment_created": False,
        "invoice_created": False,
        "contract_created": False,
    }


class DocumentTemplateRegistryAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses=inline_serializer(
            name="DocumentTemplateRegistryResponse",
            fields={
                "items": DocumentTemplateDefinitionSerializer(many=True),
                "count": serializers.IntegerField(),
            },
        )
    )
    def get(self, request):
        templates = list_document_template_definitions()
        serialized_templates = DocumentTemplateDefinitionSerializer(
            templates,
            many=True,
        ).data

        return Response(
            {
                "items": serialized_templates,
                "count": len(serialized_templates),
            }
        )


class DocumentTemplateDefinitionAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=DocumentTemplateDefinitionSerializer)
    def get(self, request, template_key: str):
        template_definition = get_document_template_definition(template_key)
        if template_definition is None:
            raise Http404("Document template definition not found.")

        serializer = DocumentTemplateDefinitionSerializer(template_definition)
        return Response(serializer.data)


class TitanProformaDraftPreviewAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=TitanProformaDraftPreviewSerializer)
    def get(self, request, reservation_draft_id):
        template_definition = get_document_template_definition(TITAN_PROFORMA_TEMPLATE_KEY)
        if template_definition is None:
            raise Http404("Titan proforma template definition not found.")

        reservation_draft = (
            active_reservation_drafts_for_document_preview().filter(id=reservation_draft_id).first()
        )
        if reservation_draft is None:
            raise Http404("Reservation draft not found.")

        serializer = TitanProformaDraftPreviewSerializer(
            {
                "document_type": "proforma",
                "business_scope": "titan",
                "template_key": TITAN_PROFORMA_TEMPLATE_KEY,
                "template": template_definition,
                "reservation_draft": reservation_draft,
                "scope_flags": runtime_document_scope_flags(),
            }
        )
        return Response(serializer.data)
