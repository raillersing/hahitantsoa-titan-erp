from dataclasses import asdict

from rest_framework import serializers

from apps.documents.registry import DocumentTemplateDefinition
from apps.reservations.serializers import ReservationDraftSerializer


class DocumentTemplateDefinitionSerializer(serializers.Serializer):
    key = serializers.CharField()
    business_scope = serializers.CharField()
    document_type = serializers.CharField()
    label = serializers.CharField()
    version = serializers.CharField()
    status = serializers.CharField()
    source_kind = serializers.CharField()
    source_reference = serializers.CharField()
    template_path = serializers.CharField()
    preview_path = serializers.CharField()
    validated_by_client = serializers.BooleanField()
    notes = serializers.CharField()

    def to_representation(self, instance: DocumentTemplateDefinition):
        return super().to_representation(asdict(instance))


class RuntimeDocumentScopeFlagsSerializer(serializers.Serializer):
    pdf_runtime_generated = serializers.BooleanField()
    reservation_confirmed = serializers.BooleanField()
    inventory_blocked = serializers.BooleanField()
    payment_created = serializers.BooleanField()
    invoice_created = serializers.BooleanField()
    contract_created = serializers.BooleanField()


class TitanProformaDraftPreviewSerializer(serializers.Serializer):
    document_type = serializers.CharField()
    business_scope = serializers.CharField()
    template_key = serializers.CharField()
    template = DocumentTemplateDefinitionSerializer()
    reservation_draft = ReservationDraftSerializer()
    scope_flags = RuntimeDocumentScopeFlagsSerializer()
