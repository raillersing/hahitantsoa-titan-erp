from dataclasses import asdict

from rest_framework import serializers

from apps.documents.registry import DocumentTemplateDefinition


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
        if isinstance(instance, dict):
            return super().to_representation(instance)
        return super().to_representation(asdict(instance))


class RuntimeDocumentScopeFlagsSerializer(serializers.Serializer):
    pdf_runtime_generated = serializers.BooleanField()
    reservation_confirmed = serializers.BooleanField()
    inventory_blocked = serializers.BooleanField()
    payment_created = serializers.BooleanField()
    invoice_created = serializers.BooleanField()
    contract_created = serializers.BooleanField()


class TitanProformaDraftPreviewLineSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    inventory_item_id = serializers.UUIDField()
    inventory_item_name = serializers.CharField()
    inventory_item_kind = serializers.CharField()
    quantity = serializers.IntegerField()
    notes = serializers.CharField()


class TitanProformaDraftPreviewReservationSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    public_reference = serializers.CharField()
    status = serializers.CharField()
    customer_id = serializers.UUIDField()
    customer_display_name = serializers.CharField()
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
    notes = serializers.CharField()
    lines = TitanProformaDraftPreviewLineSerializer(many=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class TitanProformaDraftPreviewSerializer(serializers.Serializer):
    document_type = serializers.CharField()
    business_scope = serializers.CharField()
    template_key = serializers.CharField()
    template = DocumentTemplateDefinitionSerializer()
    reservation_draft = TitanProformaDraftPreviewReservationSerializer()
    scope_flags = RuntimeDocumentScopeFlagsSerializer()
