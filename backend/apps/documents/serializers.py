from dataclasses import asdict

from rest_framework import serializers

from apps.documents.models import DocumentInstance, DocumentTemplate, DocumentTemplateVersion
from apps.documents.registry import DocumentTemplateDefinition
from apps.documents.services import get_supported_reservation_draft_document_template_keys


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


class DocumentInstanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentInstance
        fields = (
            "id",
            "reservation_draft",
            "hahitantsoa_event_draft",
            "customer",
            "template_key",
            "template_version",
            "template_label",
            "business_scope",
            "document_type",
            "template_status",
            "template_source_kind",
            "template_source_reference",
            "template_path",
            "template_preview_path",
            "template_validated_by_client",
            "template_notes",
            "reservation_public_reference",
            "reservation_status",
            "customer_display_name",
            "customer_email",
            "customer_phone",
            "customer_address",
            "status",
            "prepared_at",
            "prepared_by",
            "voided_at",
            "voided_by",
            "void_reason",
            "content_checksum",
            "storage_path",
            "generated_content_size_bytes",
            "pdf_storage_path",
            "pdf_generated_at",
            "pdf_content_checksum",
            "proforma_validity_days",
            "issued_at",
            "valid_until",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class DocumentInstanceCreateSerializer(serializers.Serializer):
    template_key = serializers.ChoiceField(
        choices=tuple(get_supported_reservation_draft_document_template_keys())
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    proforma_validity_days = serializers.IntegerField(required=False, min_value=1, max_value=365)


class DocumentInstanceGenerateSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    status = serializers.CharField()
    content_checksum = serializers.CharField()
    storage_path = serializers.CharField()
    generated_content_size_bytes = serializers.IntegerField()


class DocumentInstancePDFSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    status = serializers.CharField()
    pdf_storage_path = serializers.CharField()
    pdf_generated_at = serializers.DateTimeField()
    pdf_content_checksum = serializers.CharField()
    issued_at = serializers.DateTimeField(required=False, allow_null=True)
    valid_until = serializers.DateTimeField(required=False, allow_null=True)


class DocumentTemplateCRUDSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentTemplate
        fields = (
            "id",
            "code",
            "name",
            "description",
            "family",
            "business_scope",
            "document_type",
            "status",
        )
        read_only_fields = ("id",)


class DocumentTemplateVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentTemplateVersion
        fields = (
            "id",
            "template",
            "version",
            "status",
            "body_html",
            "header_html",
            "footer_html",
            "css",
            "variables_schema",
            "created_at",
        )
        read_only_fields = ("id", "created_at")
