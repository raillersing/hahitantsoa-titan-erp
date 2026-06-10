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
from apps.documents.serializers import DocumentTemplateDefinitionSerializer


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
