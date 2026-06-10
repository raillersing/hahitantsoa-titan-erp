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
        return super().to_representation(asdict(instance))
